-- Identity, organization membership and device authorization foundation.
-- No credentials or passwords are stored here; external_subject is the identity-provider subject.

create table organization_memberships (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references identities(id),
  organization_id uuid not null references organizations(id),
  role_id uuid not null references roles(id),
  status record_status not null default 'VERIFIED',
  created_at timestamptz not null default now(),
  unique(identity_id, organization_id, role_id)
);

create table identity_sessions (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references identities(id),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  token_hash text not null unique,
  request_context jsonb not null default '{}'
);

alter table field_devices add column if not exists registered_by_identity_id uuid references identities(id);
alter table field_devices add column if not exists last_seen_at timestamptz;

create index memberships_identity_idx on organization_memberships(identity_id);
create index memberships_org_idx on organization_memberships(organization_id);
create index sessions_identity_idx on identity_sessions(identity_id);
create index sessions_active_idx on identity_sessions(expires_at) where revoked_at is null;
