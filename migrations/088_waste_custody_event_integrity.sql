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
    'TRANSPORT_DEPARTURE',
    'TRANSPORT_CHECKPOINT',
    'TRANSPORT_ARRIVAL',
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
          'TRANSPORTER_ACCEPTANCE','TRANSPORT_DEPARTURE','TRANSPORT_ARRIVAL',
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
begin
  -- Preserve legacy rows; only new typed custody events use the strict contract.
  if new.event_type is null then
    if tg_op = 'INSERT' then
      return new;
    end if;
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

    select exists (
      select 1
        from organization_memberships om
       where om.identity_id = new.recorded_by_identity_id
         and om.organization_id = new.actor_organization_id
         and om.status = 'VERIFIED'
    ) into membership_valid;
    if not membership_valid then
      raise exception 'custody event actor must have verified membership in actor organization';
    end if;

    if new.counterparty_organization_id is not null
       and not exists (select 1 from organizations o where o.id = new.counterparty_organization_id) then
      raise exception 'custody event counterparty organization does not exist';
    end if;

    if new.supersedes_link_id is not null then
      select resource_flow_id into prior_flow_id
        from chain_of_custody_links
       where id = new.supersedes_link_id;
      if prior_flow_id is distinct from new.resource_flow_id then
        raise exception 'custody correction must supersede an event in the same resource flow';
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
