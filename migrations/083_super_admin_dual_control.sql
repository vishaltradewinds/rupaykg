-- Two-person approval queue for high-risk RBAC and reserved administrator changes.
create table if not exists admin_change_requests (
 id uuid primary key default gen_random_uuid(),
 action_type text not null check (action_type in ('ROLE_PERMISSION_CHANGE','RESERVED_MEMBERSHIP_GRANT','RESERVED_MEMBERSHIP_RESTORE')),
 target_type text not null check (target_type in ('role','organization_membership')),
 target_id uuid not null,
 organization_id uuid references organizations(id),
 requested_by_identity_id uuid not null references identities(id),
 approved_by_identity_id uuid references identities(id),
 rejected_by_identity_id uuid references identities(id),
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 reason text not null check (length(trim(reason)) between 8 and 1000),
 status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','EXECUTED','FAILED')),
 review_reason text,
 execution_result jsonb,
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 executed_at timestamptz,
 check (approved_by_identity_id is null or approved_by_identity_id <> requested_by_identity_id),
 check (rejected_by_identity_id is null or rejected_by_identity_id <> requested_by_identity_id)
);
create index if not exists admin_change_requests_queue_idx on admin_change_requests(status, created_at desc);
create index if not exists admin_change_requests_actor_idx on admin_change_requests(requested_by_identity_id, created_at desc);
