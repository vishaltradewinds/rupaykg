-- Additive, append-only waste custody event support on the canonical resource-flow ledger.
-- Legacy rows remain explicitly unclassified; new events are unverified assertions pending review.

create table resource_flow_participants (
  id uuid primary key default gen_random_uuid(),
  resource_flow_id uuid not null references resource_flows(id),
  organization_id uuid not null references organizations(id),
  status text not null default 'INVITED'
    check (status in ('INVITED','ACTIVE','SUSPENDED','REVOKED')),
  invited_by_identity_id uuid not null references identities(id),
  accepted_by_identity_id uuid references identities(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  unique (resource_flow_id, organization_id),
  check ((status <> 'ACTIVE') or (accepted_by_identity_id is not null and accepted_at is not null))
);

create index resource_flow_participants_org_status_idx
  on resource_flow_participants(organization_id, status, resource_flow_id);

alter table chain_of_custody_links
  add column event_type text not null default 'LEGACY_UNCLASSIFIED'
    check (event_type in (
      'LEGACY_UNCLASSIFIED','GENERATOR_HANDOVER','COLLECTOR_RECEIPT',
      'TRANSPORT_DISPATCH','TRANSPORT_CHECKPOINT','PROCESSOR_RECEIPT',
      'PARTIAL_ACCEPTANCE','REJECTION','QUANTITY_DISPUTE','WEIGHMENT_CAPTURED',
      'PROCESSING_INPUT','CORRECTION'
    )),
  add column idempotency_key text,
  add column actor_identity_id uuid references identities(id),
  add column counterparty_organization_id uuid references organizations(id),
  add column quantity_basis text not null default 'DECLARED'
    check (quantity_basis in ('DECLARED','ESTIMATED','MEASURED')),
  add column quantity_source text not null default 'LEGACY_UNSPECIFIED',
  add column measurement_method text,
  add column instrument_id text,
  add column reason_code text,
  add column supersedes_event_id uuid references chain_of_custody_links(id),
  add column event_payload jsonb,
  add column event_payload_hash text,
  add column review_status text not null default 'PENDING_REVIEW'
    check (review_status in ('PENDING_REVIEW','VERIFIED','DISPUTED','REJECTED')),
  add column created_at timestamptz not null default now();

create unique index chain_custody_flow_idempotency_idx
  on chain_of_custody_links(resource_flow_id, idempotency_key)
  where idempotency_key is not null;

create table chain_of_custody_event_evidence (
  custody_event_id uuid not null references chain_of_custody_links(id),
  evidence_id uuid not null references evidence(id),
  linked_at timestamptz not null default now(),
  primary key (custody_event_id, evidence_id)
);

create index custody_event_evidence_evidence_idx
  on chain_of_custody_event_evidence(evidence_id, custody_event_id);

create or replace function enforce_waste_custody_event_integrity()
returns trigger language plpgsql as $$
declare
  superseded_flow_id uuid;
begin
  if new.event_type = 'LEGACY_UNCLASSIFIED' then
    return new;
  end if;

  if new.idempotency_key is null or length(btrim(new.idempotency_key)) = 0
     or length(new.idempotency_key) > 200
     or new.actor_identity_id is null
     or new.actor_organization_id is null
     or new.event_payload is null then
    raise exception 'new custody event requires idempotency, actor identity/organization and payload';
  end if;

  if new.quantity_basis = 'MEASURED'
     and (new.measurement_method is null or btrim(new.measurement_method) = ''
       or new.instrument_id is null or btrim(new.instrument_id) = '') then
    raise exception 'measured custody quantity requires method and instrument';
  end if;

  if new.event_type = 'WEIGHMENT_CAPTURED' and new.quantity_basis <> 'MEASURED' then
    raise exception 'weighment custody event must be measured';
  end if;

  if new.event_type in ('PARTIAL_ACCEPTANCE','REJECTION','QUANTITY_DISPUTE','CORRECTION')
     and (new.reason_code is null or btrim(new.reason_code) = '') then
    raise exception 'partial, rejected, disputed and correction events require a reason';
  end if;

  if new.event_type = 'CORRECTION' then
    if new.supersedes_event_id is null then
      raise exception 'custody correction must reference a superseded event';
    end if;
    select resource_flow_id into superseded_flow_id
      from chain_of_custody_links where id = new.supersedes_event_id;
    if superseded_flow_id is null or superseded_flow_id <> new.resource_flow_id then
      raise exception 'custody correction must supersede an event on the same resource flow';
    end if;
  elsif new.supersedes_event_id is not null then
    raise exception 'only correction events may reference a superseded custody event';
  end if;

  new.event_payload_hash := encode(digest(new.event_payload::text, 'sha256'), 'hex');
  return new;
end;
$$;

drop trigger if exists waste_custody_event_integrity_guard on chain_of_custody_links;
create trigger waste_custody_event_integrity_guard
before insert on chain_of_custody_links
for each row execute function enforce_waste_custody_event_integrity();

create or replace function reject_waste_custody_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'waste custody history is append-only; create a correction event instead';
end;
$$;

drop trigger if exists chain_custody_append_only_guard on chain_of_custody_links;
create trigger chain_custody_append_only_guard
before update or delete on chain_of_custody_links
for each row execute function reject_waste_custody_mutation();

drop trigger if exists chain_custody_event_evidence_append_only_guard on chain_of_custody_event_evidence;
create trigger chain_custody_event_evidence_append_only_guard
before update or delete on chain_of_custody_event_evidence
for each row execute function reject_waste_custody_mutation();

create or replace function enforce_resource_flow_participant_lifecycle()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.resource_flow_id is distinct from old.resource_flow_id
       or new.organization_id is distinct from old.organization_id
       or new.invited_by_identity_id is distinct from old.invited_by_identity_id
       or new.created_at is distinct from old.created_at then
      raise exception 'resource-flow participant identity is immutable';
    end if;

    if old.status = new.status then
      return new;
    end if;

    if not (
      (old.status = 'INVITED' and new.status in ('ACTIVE','REVOKED')) or
      (old.status = 'ACTIVE' and new.status in ('SUSPENDED','REVOKED')) or
      (old.status = 'SUSPENDED' and new.status in ('ACTIVE','REVOKED'))
    ) then
      raise exception 'invalid resource-flow participant transition: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists resource_flow_participant_lifecycle_guard on resource_flow_participants;
create trigger resource_flow_participant_lifecycle_guard
before update on resource_flow_participants
for each row execute function enforce_resource_flow_participant_lifecycle();

-- This schema records claims and review state only. It does not confer statutory
-- authorization or make any custody event eligible for settlement, EPR or carbon claims.
