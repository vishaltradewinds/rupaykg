-- Evidence-backed, two-person approval for organization-to-stakeholder authorization.
create table if not exists organization_stakeholder_authorization_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  stakeholder_type text not null check (stakeholder_type in (
    'BWG','WASTE_FACILITY','ULB','DISTRICT_PANCHAYAT','GRAM_PANCHAYAT',
    'COLLECTOR_TRANSPORTER','PROCESSOR'
  )),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  evidence_reference text not null check (length(trim(evidence_reference)) between 1 and 1000),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  request_reason text not null check (length(trim(request_reason)) between 8 and 1000),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  requested_by_identity_id uuid not null references identities(id),
  decided_by_identity_id uuid references identities(id),
  decision_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  applied_at timestamptz,
  check (
    (status = 'PENDING' and decided_by_identity_id is null and decided_at is null and applied_at is null)
    or (status = 'REJECTED' and decided_by_identity_id is not null and decided_at is not null and applied_at is null)
    or (status = 'APPROVED' and decided_by_identity_id is not null and decided_at is not null and applied_at is not null)
  )
);
create unique index if not exists organization_stakeholder_authorization_pending_unique_idx
  on organization_stakeholder_authorization_requests(organization_id, stakeholder_type)
  where status = 'PENDING';
alter table organization_stakeholder_authorizations
  add column if not exists approval_request_id uuid unique
  references organization_stakeholder_authorization_requests(id);

create or replace function enforce_stakeholder_authorization_dual_control()
returns trigger language plpgsql as $$
declare approval record;
begin
  if new.status <> 'VERIFIED' then
    return new;
  end if;
  if new.approval_request_id is null then
    raise exception 'STAKEHOLDER_AUTHORIZATION_REQUIRES_DUAL_CONTROL';
  end if;
  select id, organization_id, stakeholder_type, status, evidence_reference, evidence_sha256, requested_by_identity_id,
         decided_by_identity_id, applied_at, expires_at
    into approval
    from organization_stakeholder_authorization_requests
   where id = new.approval_request_id
   for update;
  if not found
     or approval.organization_id <> new.organization_id
     or approval.stakeholder_type <> new.stakeholder_type
     or approval.evidence_reference <> new.evidence_reference
     or approval.evidence_sha256 <> new.evidence_sha256
     or approval.status <> 'APPROVED'
     or approval.applied_at is null
     or approval.requested_by_identity_id = approval.decided_by_identity_id
     or new.verified_by_identity_id is distinct from approval.decided_by_identity_id
     or new.verified_at is null
     or (approval.expires_at is not null and approval.expires_at <= now()) then
    raise exception 'STAKEHOLDER_AUTHORIZATION_DUAL_CONTROL_MISMATCH';
  end if;
  return new;
end $$;
drop trigger if exists organization_stakeholder_authorization_dual_control on organization_stakeholder_authorizations;
create trigger organization_stakeholder_authorization_dual_control
before insert or update of status, organization_id, stakeholder_type, evidence_reference, evidence_sha256, verification_note, verified_by_identity_id, verified_at, expires_at, approval_request_id
on organization_stakeholder_authorizations
for each row execute function enforce_stakeholder_authorization_dual_control();
