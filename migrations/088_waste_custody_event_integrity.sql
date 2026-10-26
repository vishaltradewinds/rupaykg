-- Extend the existing canonical chain_of_custody_links ledger with event provenance.
-- Legacy rows remain readable. New typed events are append-only and idempotent.
-- This migration does not grant legal authority or create a parallel waste ledger.

alter table chain_of_custody_links
  add column if not exists event_type text,
  add column if not exists idempotency_key text,
  add column if not exists counterparty_organization_id uuid references organizations(id),
  add column if not exists occurred_at timestamptz,
  add column if not exists quantity_basis text,
  add column if not exists quantity_source text,
  add column if not exists measurement_method text,
  add column if not exists instrument_id text,
  add column if not exists reason_code text,
  add column if not exists supersedes_link_id uuid references chain_of_custody_links(id),
  add column if not exists evidence_ids uuid[] not null default '{}',
  add column if not exists recorded_by_identity_id uuid references identities(id),
  add column if not exists event_hash text;

create unique index if not exists custody_flow_idempotency_key_uq
  on chain_of_custody_links(resource_flow_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists custody_actor_org_recorded_idx
  on chain_of_custody_links(actor_organization_id, recorded_at desc);

alter table chain_of_custody_links
  add constraint custody_event_type_known
  check (event_type is null or event_type in (
    'GENERATOR_HANDOVER',
    'COLLECTOR_RECEIPT',
    'AGGREGATOR_HANDOVER',
    'TRANSPORTER_ACCEPTANCE',
    'TRANSPORT_DISPATCH',
    'TRANSPORT_CHECKPOINT',
    'PROCESSOR_RECEIPT',
    'PARTIAL_ACCEPTANCE',
    'REJECTION',
    'QUANTITY_DISPUTE',
    'WEIGHMENT_CAPTURED',
    'PROCESSING_INPUT',
    'CORRECTION'
  ));

alter table chain_of_custody_links
  add constraint custody_event_provenance_complete
  check (
    event_type is null
    or (
      idempotency_key is not null and length(btrim(idempotency_key)) between 1 and 200
      and actor_organization_id is not null
      and recorded_by_identity_id is not null
      and occurred_at is not null
      and quantity_basis is not null
      and quantity_basis in ('DECLARED','ESTIMATED','MEASURED')
      and quantity_source is not null and length(btrim(quantity_source)) > 0
      and (
        quantity_basis <> 'MEASURED'
        or (
          measurement_method is not null and length(btrim(measurement_method)) > 0
          and instrument_id is not null and length(btrim(instrument_id)) > 0
        )
      )
      and (
        event_type not in ('GENERATOR_HANDOVER','COLLECTOR_RECEIPT','AGGREGATOR_HANDOVER',
          'TRANSPORTER_ACCEPTANCE','TRANSPORT_DISPATCH',
          'PROCESSOR_RECEIPT','PARTIAL_ACCEPTANCE','REJECTION','QUANTITY_DISPUTE')
        or counterparty_organization_id is not null
      )
      and (
        event_type not in ('PARTIAL_ACCEPTANCE','REJECTION','QUANTITY_DISPUTE','CORRECTION')
        or (reason_code is not null and length(btrim(reason_code)) > 0)
      )
      and (event_type <> 'WEIGHMENT_CAPTURED' or quantity_basis = 'MEASURED')
      and (event_type <> 'CORRECTION' or supersedes_link_id is not null)
      and (supersedes_link_id is null or supersedes_link_id <> id)
    )
  );

create or replace function enforce_custody_event_integrity()
returns trigger language plpgsql as $$
declare
  evidence_ref uuid;
  prior_flow_id uuid;
  expected_sequence integer;
  membership_valid boolean;
  flow_organization_id uuid;
  latest_actor_organization_id uuid;
  latest_counterparty_organization_id uuid;
  superseded_actor_organization_id uuid;
  superseded_event_type text;
begin
  -- Preserve legacy rows; only new typed custody events use the strict contract.
  if new.event_type is null then
    if tg_op = 'INSERT' then
      raise exception 'new custody links must be typed events with complete provenance';
    end if;
    -- Preserve legacy rows already present before this migration.
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Serialize sequence assignment per resource flow to make event order deterministic.
    perform pg_advisory_xact_lock(hashtextextended(new.resource_flow_id::text, 0));
    select coalesce(max(sequence_no), -1) + 1
      into expected_sequence
      from chain_of_custody_links
     where resource_flow_id = new.resource_flow_id;
    new.sequence_no := expected_sequence;
    -- Server receipt time is distinct from the source-reported occurrence time.
    new.recorded_at := clock_timestamp();

    select exists (
      select 1
        from organization_memberships om
        join roles r on r.id = om.role_id
        join identities i on i.id = om.identity_id
        join organizations o on o.id = om.organization_id
       where om.identity_id = new.recorded_by_identity_id
         and om.organization_id = new.actor_organization_id
         and om.status = 'VERIFIED'
         and i.status = 'VERIFIED'
         and i.suspended_at is null
         and o.status = 'VERIFIED'
         and exists (
           select 1
             from jsonb_array_elements_text(r.permissions) permission
            where permission = 'waste:record'
         )
    ) into membership_valid;
    if not membership_valid then
      raise exception 'custody event actor requires verified membership and waste:record permission';
    end if;

    if new.from_geography_id is not null
       and not organization_has_geography_scope(new.actor_organization_id, new.from_geography_id) then
      raise exception 'custody event source geography is outside actor organization scope';
    end if;
    if new.to_geography_id is not null
       and not organization_has_geography_scope(new.actor_organization_id, new.to_geography_id) then
      raise exception 'custody event destination geography is outside actor organization scope';
    end if;

    if new.counterparty_organization_id is not null
       and not exists (select 1 from organizations o where o.id = new.counterparty_organization_id and o.status = 'VERIFIED') then
      raise exception 'custody event counterparty organization is missing or not verified';
    end if;

    if new.event_type = 'CORRECTION' then
      select resource_flow_id, actor_organization_id, event_type
        into prior_flow_id, superseded_actor_organization_id, superseded_event_type
        from chain_of_custody_links
       where id = new.supersedes_link_id;
      if prior_flow_id is distinct from new.resource_flow_id
         or superseded_actor_organization_id is distinct from new.actor_organization_id
         or superseded_event_type = 'CORRECTION' then
        raise exception 'custody correction must supersede a non-correction event in the same flow from the same actor organization';
      end if;
    else
      select organization_id into flow_organization_id
        from resource_flows where id = new.resource_flow_id;
      select actor_organization_id, counterparty_organization_id
        into latest_actor_organization_id, latest_counterparty_organization_id
        from chain_of_custody_links
       where resource_flow_id = new.resource_flow_id and event_type is not null and event_type <> 'CORRECTION'
       order by sequence_no desc limit 1;
      if not found then
        if new.actor_organization_id is distinct from flow_organization_id then
          raise exception 'first custody event must be recorded by the resource flow originating organization';
        end if;
      elsif new.actor_organization_id is distinct from latest_actor_organization_id
         and new.actor_organization_id is distinct from latest_counterparty_organization_id then
        raise exception 'custody event actor must be a participant in the latest handover';
      end if;
    end if;

    foreach evidence_ref in array new.evidence_ids loop
      if not exists (select 1 from evidence e where e.id = evidence_ref) then
        raise exception 'custody event evidence reference does not exist';
      end if;
    end loop;

    new.event_hash := encode(digest(
      (to_jsonb(new) - 'event_hash')::text,
      'sha256'
    ), 'hex');
    return new;
  end if;

  raise exception 'typed custody events are append-only';
end;
$$;

drop trigger if exists custody_event_integrity_guard on chain_of_custody_links;
create trigger custody_event_integrity_guard
before insert or update on chain_of_custody_links
for each row execute function enforce_custody_event_integrity();

-- Typed events cannot be updated or deleted; legacy rows retain their existing
-- behavior until separately reconciled. This avoids retroactively breaking
-- historical rows while ensuring all new event records are immutable.
create or replace function reject_typed_custody_event_mutation()
returns trigger language plpgsql as $$
begin
  if old.event_type is not null then
    raise exception 'typed custody events are append-only';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists custody_typed_event_append_only on chain_of_custody_links;
create trigger custody_typed_event_append_only
before update or delete on chain_of_custody_links
for each row execute function reject_typed_custody_event_mutation();
