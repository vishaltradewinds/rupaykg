-- RupayKg core schema. PostgreSQL is authoritative for business state.

create extension if not exists pgcrypto;

create type lifecycle_status as enum (
  'DRAFT','SUBMITTED','ACCEPTED','COMPLETED','REJECTED',
  'CAPTURED','UNDER_REVIEW','VERIFIED',
  'REQUESTED','IN_REVIEW','APPROVED',
  'ELIGIBLE','ISSUED','ACTIVE','TRANSFERRED','RETIRED',
  'OPEN','EVIDENCE_PENDING','COMPLIANT','NON_COMPLIANT',
  'CREATED','AUTHORIZED','EXECUTING','RECONCILING','SETTLED','FAILED','CANCELLED'
);

create type geography_kind as enum (
  'COUNTRY','STATE_UT','DISTRICT','SUB_DISTRICT','ULB','WARD','LOCALITY',
  'GRAM_PANCHAYAT','VILLAGE','CLUSTER'
);

create type evidence_status as enum ('CAPTURED','SUBMITTED','UNDER_REVIEW','VERIFIED','REJECTED');
create type verification_decision as enum ('APPROVED','REJECTED');
create type record_status as enum ('VERIFIED','PENDING','REJECTED','UNAVAILABLE','DEMO','SIMULATED');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null,
  status record_status not null default 'VERIFIED',
  created_at timestamptz not null default now()
);

create table geography (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references geography(id),
  kind geography_kind not null,
  code text,
  name text not null,
  source text,
  source_version text,
  valid_from timestamptz,
  valid_to timestamptz,
  unique(kind, code)
);

create table identities (
  id uuid primary key default gen_random_uuid(),
  external_subject text unique,
  display_name text not null,
  status record_status not null default 'VERIFIED',
  created_at timestamptz not null default now()
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  permissions jsonb not null default '[]',
  geography_scope jsonb not null default '[]',
  unique(organization_id, name)
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  actor_identity_id uuid references identities(id),
  geography_id uuid references geography(id),
  activity_type text not null,
  status lifecycle_status not null default 'DRAFT',
  occurred_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table measurements (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id),
  value numeric(20,6) not null check (value >= 0),
  unit text not null,
  method text not null,
  source text not null,
  measured_at timestamptz not null,
  quality_status record_status not null default 'PENDING',
  metadata jsonb not null default '{}'
);

create table evidence (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references activities(id),
  measurement_id uuid references measurements(id),
  evidence_type text not null,
  status evidence_status not null default 'CAPTURED',
  captured_at timestamptz not null,
  content_uri text,
  content_hash text,
  metadata jsonb not null default '{}'
);

create table verifications (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid references evidence(id),
  activity_id uuid references activities(id),
  verifier_identity_id uuid not null references identities(id),
  decision verification_decision not null,
  scope text not null,
  rationale text,
  decided_at timestamptz not null default now()
);

create table methodology_versions (
  id uuid primary key default gen_random_uuid(),
  methodology_code text not null,
  version text not null,
  effective_from timestamptz,
  rules jsonb not null,
  unique(methodology_code, version)
);

create table carbon_calculations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id),
  methodology_version_id uuid not null references methodology_versions(id),
  inputs jsonb not null,
  result numeric(20,6),
  unit text,
  status text not null default 'DRAFT',
  calculated_at timestamptz
);

create table obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  jurisdiction_id uuid references geography(id),
  obligation_type text not null,
  period_start date not null,
  period_end date not null,
  required_quantity numeric(20,6),
  status lifecycle_status not null default 'OPEN'
);

create table credentials (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references activities(id),
  issuer_organization_id uuid not null references organizations(id),
  trust_root_id text not null,
  status lifecycle_status not null default 'ELIGIBLE',
  credential_uri text,
  issued_at timestamptz
);

create table registry_events (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references credentials(id),
  event_type text not null,
  from_owner_id uuid references organizations(id),
  to_owner_id uuid references organizations(id),
  external_reference text,
  event_hash text not null,
  created_at timestamptz not null default now()
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid references obligations(id),
  credential_id uuid references credentials(id),
  payer_id uuid references organizations(id),
  payee_id uuid references organizations(id),
  amount numeric(20,2) not null check (amount >= 0),
  currency char(3) not null,
  status lifecycle_status not null default 'ELIGIBLE',
  external_reference text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_identity_id uuid references identities(id),
  organization_id uuid references organizations(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  request_id text,
  previous_hash text,
  event_hash text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activities_org_geo_idx on activities(organization_id, geography_id);
create index measurements_activity_idx on measurements(activity_id);
create index evidence_activity_idx on evidence(activity_id);
create index audit_target_idx on audit_events(target_type, target_id);
create index audit_created_idx on audit_events(created_at);
