-- Authentication and organization membership foundation.
-- External identity providers remain authoritative for credential issuance.
-- RupayKg stores only provider subject mappings and hashed opaque sessions.

create type membership_status as enum ('INVITED','ACTIVE','SUSPENDED','REVOKED');

create table organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  identity_id uuid not null references identities(id),
  role_id uuid references roles(id),
  status membership_status not null default 'INVITED',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  unique(organization_id, identity_id)
);

create table auth_sessions (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references identities(id),
  token_hash text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'
);

create index organization_memberships_identity_idx on organization_memberships(identity_id, status);
create index organization_memberships_org_idx on organization_memberships(organization_id, status);
create index auth_sessions_identity_idx on auth_sessions(identity_id, revoked_at);
create index auth_sessions_expiry_idx on auth_sessions(expires_at);

alter table identities add column if not exists email text;
alter table identities add column if not exists provider text;
alter table identities add column if not exists last_authenticated_at timestamptz;
create unique index identities_provider_subject_idx on identities(provider, external_subject) where provider is not null and external_subject is not null;
