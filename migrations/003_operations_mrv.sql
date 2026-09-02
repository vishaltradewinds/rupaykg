-- Field operations, chain-of-custody and MRV evidence extensions.
-- These tables preserve the distinction between intake, authoritative activity,
-- measurement, evidence and verification.

create type operation_sync_status as enum ('RECEIVED','ACCEPTED','REJECTED','CONFLICT');

create table devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  device_identifier text not null unique,
  platform text,
  app_version text,
  status record_status not null default 'VERIFIED',
  registered_at timestamptz not null default now()
);

create table operation_sync_envelopes (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  actor_identity_id uuid not null references identities(id),
  device_id uuid not null references devices(id),
  client_sequence bigint,
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  payload_hash text,
  status operation_sync_status not null default 'RECEIVED',
  conflict_reason text,
  processed_at timestamptz
);

create index operation_sync_device_sequence_idx on operation_sync_envelopes(device_id, client_sequence);
create index operation_sync_status_idx on operation_sync_envelopes(status);

create table resource_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  origin_type text not null,
  resource_form text not null,
  material_code text not null,
  declared_quantity numeric(20,6) not null check (declared_quantity > 0),
  unit text not null,
  source_geography_id uuid references geography(id),
  destination_geography_id uuid references geography(id),
  status lifecycle_status not null default 'DRAFT',
  created_at timestamptz not null default now()
);

create table chain_of_custody_links (
  id uuid primary key default gen_random_uuid(),
  resource_flow_id uuid not null references resource_flows(id),
  sequence_no integer not null check (sequence_no >= 0),
  actor_organization_id uuid references organizations(id),
  activity_id uuid references activities(id),
  quantity numeric(20,6) not null check (quantity > 0),
  unit text not null,
  from_geography_id uuid references geography(id),
  to_geography_id uuid references geography(id),
  recorded_at timestamptz not null,
  evidence_id uuid references evidence(id),
  unique(resource_flow_id, sequence_no)
);

create index resource_flows_org_idx on resource_flows(organization_id);
create index custody_flow_idx on chain_of_custody_links(resource_flow_id, sequence_no);

create table mrv_observations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id),
  measurement_id uuid references measurements(id),
  parameter_code text not null,
  observed_value numeric(20,8) not null,
  unit text not null,
  method text not null,
  instrument_id text,
  observed_at timestamptz not null,
  uncertainty numeric(20,8),
  quality_status record_status not null default 'PENDING',
  metadata jsonb not null default '{}'
);

create table evidence_verification_requirements (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id),
  requirement_code text not null,
  required boolean not null default true,
  satisfied boolean not null default false,
  satisfied_by_evidence_id uuid references evidence(id),
  satisfied_by_verification_id uuid references verifications(id),
  unique(activity_id, requirement_code)
);

create index mrv_observations_activity_idx on mrv_observations(activity_id);
create index evidence_requirements_activity_idx on evidence_verification_requirements(activity_id);

alter table geography add column if not exists external_code text;
alter table geography add column if not exists metadata jsonb not null default '{}';
create index geography_parent_idx on geography(parent_id);
create index geography_external_code_idx on geography(external_code);

alter table measurements add constraint measurements_positive_value check (value > 0);
alter table evidence add constraint evidence_has_reference check (content_uri is not null or content_hash is not null);
