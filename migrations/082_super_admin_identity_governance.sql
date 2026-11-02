-- Super Admin identity and access lifecycle controls.
-- Suspension metadata is separate from identity verification status.
alter table identities
  add column if not exists suspended_at timestamptz,
  add column if not exists last_suspended_by_identity_id uuid references identities(id),
  add column if not exists last_suspension_reason text;

alter table organization_memberships
  add column if not exists last_revoked_at timestamptz,
  add column if not exists last_revoked_by_identity_id uuid references identities(id),
  add column if not exists last_revocation_reason text;

create index if not exists identities_active_status_idx
  on identities(status, suspended_at);
create index if not exists memberships_role_status_idx
  on organization_memberships(role_id, status);
create index if not exists audit_action_created_idx
  on audit_events(action, created_at desc);
