-- Explicit two-person approval for platform-reserved role grants and Super Admin restoration.
create table if not exists platform_access_change_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('GRANT_RESERVED_ROLE','RESTORE_SUPER_ADMIN')),
  target_identity_id uuid not null references identities(id),
  organization_id uuid not null references organizations(id),
  role_id uuid not null references roles(id),
  membership_id uuid references organization_memberships(id),
  requester_identity_id uuid not null references identities(id),
  approver_identity_id uuid references identities(id),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  reason text not null check (length(btrim(reason)) between 8 and 1000),
  decision_reason text,
  request_hash text not null,
  created_at timestamptz not null default clock_timestamp(),
  decided_at timestamptz,
  applied_at timestamptz,
  constraint platform_access_change_request_shape check (
    (request_type = 'GRANT_RESERVED_ROLE' and membership_id is null)
    or (request_type = 'RESTORE_SUPER_ADMIN' and membership_id is not null)
  ),
  constraint platform_access_change_distinct_approver check (
    approver_identity_id is null or approver_identity_id <> requester_identity_id
  ),
  constraint platform_access_change_decision_shape check (
    (status = 'PENDING' and approver_identity_id is null and decided_at is null and applied_at is null)
    or (status = 'REJECTED' and approver_identity_id is not null and decided_at is not null and applied_at is null)
    or (status = 'APPROVED' and approver_identity_id is not null and decided_at is not null and applied_at is not null)
  )
);

create unique index if not exists platform_access_change_pending_unique_idx
  on platform_access_change_requests(
    request_type,
    target_identity_id,
    coalesce(membership_id, role_id)
  )
  where status = 'PENDING';

create index if not exists platform_access_change_queue_idx
  on platform_access_change_requests(status, created_at desc);
