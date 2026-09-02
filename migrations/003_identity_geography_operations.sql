-- Identity, geography reference data, and field-operation primitives.
-- Reference data is source-versioned; do not seed invented LGD records.

create table geography_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_uri text,
  source_version text not null,
  retrieved_at timestamptz not null default now(),
  checksum text,
  status record_status not null default 'VERIFIED',
  unique(source_name, source_version)
);

alter table geography
  add column if not exists source_id uuid references geography_sources(id),
  add column if not exists external_code text,
  add column if not exists metadata jsonb not null default '{}';

create index if not exists geography_parent_idx on geography(parent_id);
create index if not exists geography_external_code_idx on geography(external_code);

create table identity_credentials (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references identities(id),
  credential_type text not null,
  credential_subject text not null,
  issuer text,
  verified_at timestamptz,
  expires_at timestamptz,
  status record_status not null default 'PENDING',
  metadata jsonb not null default '{}',
  unique(credential_type, credential_subject)
);

create table activity_assignments (
  activity_id uuid not null references activities(id),
  identity_id uuid not null references identities(id),
  role_id uuid references roles(id),
  assigned_at timestamptz not null default now(),
  primary key(activity_id, identity_id)
);

create table operation_sync_envelopes (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  actor_identity_id uuid references identities(id),
  device_id text,
  client_sequence bigint,
  captured_at timestamptz,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  payload_hash text,
  status text not null default 'RECEIVED' check (status in ('RECEIVED','APPLIED','REJECTED','CONFLICT')),
  rejection_reason text,
  applied_at timestamptz
);

create index operation_sync_actor_idx on operation_sync_envelopes(actor_identity_id, received_at desc);
create index operation_sync_status_idx on operation_sync_envelopes(status, received_at);

create table field_devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  identity_id uuid references identities(id),
  organization_id uuid references organizations(id),
  last_seen_at timestamptz,
  status record_status not null default 'PENDING',
  metadata jsonb not null default '{}'
);

-- Every accepted field operation can be traced to a deterministic request key.
alter table activities
  add column if not exists idempotency_key text unique,
  add column if not exists captured_at timestamptz,
  add column if not exists device_id text;

alter table evidence
  add column if not exists captured_by_identity_id uuid references identities(id),
  add column if not exists device_id text,
  add column if not exists evidence_hash_algorithm text default 'sha256';

alter table measurements
  add column if not exists captured_by_identity_id uuid references identities(id),
  add column if not exists device_id text,
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists location_accuracy_m numeric(12,3);

create index if not exists activities_idempotency_idx on activities(idempotency_key);
create index if not exists evidence_hash_idx on evidence(content_hash);
