-- Evidence-backed, two-person crosswalk from external government geography identifiers
-- to the canonical, source-versioned RupayKg geography hierarchy.
-- This migration deliberately does not fabricate or bulk-import government identifiers.
create table government_geography_crosswalk_requests (
  id uuid primary key default gen_random_uuid(),
  authority_code text not null check (authority_code ~ '^[A-Z0-9][A-Z0-9._-]{1,79}$'),
  source_system text not null check (length(trim(source_system)) between 2 and 120),
  external_code text not null check (length(trim(external_code)) between 1 and 160),
  source_version text not null check (length(trim(source_version)) between 1 and 160),
  geography_id uuid not null references geography(id),
  evidence_reference text not null check (length(trim(evidence_reference)) between 1 and 1000),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  request_reason text not null check (length(trim(request_reason)) between 8 and 1000),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  requested_by_identity_id uuid not null references identities(id),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  decided_by_identity_id uuid references identities(id),
  decision_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  applied_at timestamptz,
  check (
    (status='PENDING' and decided_by_identity_id is null and decided_at is null and applied_at is null)
    or (status='REJECTED' and decided_by_identity_id is not null and decided_at is not null and applied_at is null)
    or (status='APPROVED' and decided_by_identity_id is not null and decided_at is not null and applied_at is not null)
  )
);

create unique index government_geography_crosswalk_pending_unique_idx
  on government_geography_crosswalk_requests(authority_code, source_system, external_code, source_version, geography_id)
  where status='PENDING';

create table government_geography_crosswalks (
  id uuid primary key default gen_random_uuid(),
  authority_code text not null check (authority_code ~ '^[A-Z0-9][A-Z0-9._-]{1,79}$'),
  source_system text not null check (length(trim(source_system)) between 2 and 120),
  external_code text not null check (length(trim(external_code)) between 1 and 160),
  source_version text not null check (length(trim(source_version)) between 1 and 160),
  geography_id uuid not null references geography(id),
  evidence_reference text not null check (length(trim(evidence_reference)) between 1 and 1000),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  status record_status not null default 'PENDING',
  approval_request_id uuid unique references government_geography_crosswalk_requests(id),
  verified_by_identity_id uuid references identities(id),
  verified_at timestamptz,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to > valid_from),
  check (status <> 'VERIFIED' or (approval_request_id is not null and verified_by_identity_id is not null and verified_at is not null))
);

create index government_geography_crosswalk_lookup_idx
  on government_geography_crosswalks(authority_code, source_system, external_code, source_version, status);

create unique index government_geography_crosswalk_one_current_verified_idx
  on government_geography_crosswalks(authority_code, source_system, external_code, source_version)
  where status='VERIFIED' and valid_to is null;

create or replace function enforce_government_geography_crosswalk_dual_control()
returns trigger language plpgsql as $$
declare approval record;
begin
  if new.status <> 'VERIFIED' then
    return new;
  end if;
  if new.approval_request_id is null then
    raise exception 'GOV_GEOGRAPHY_CROSSWALK_REQUIRES_DUAL_CONTROL';
  end if;
  select id, authority_code, source_system, external_code, source_version, geography_id,
         evidence_reference, evidence_sha256, status, requested_by_identity_id,
         decided_by_identity_id, expires_at, applied_at
    into approval
    from government_geography_crosswalk_requests
   where id=new.approval_request_id
   for update;
  if not found
     or approval.authority_code is distinct from new.authority_code
     or approval.source_system is distinct from new.source_system
     or approval.external_code is distinct from new.external_code
     or approval.source_version is distinct from new.source_version
     or approval.geography_id is distinct from new.geography_id
     or approval.evidence_reference is distinct from new.evidence_reference
     or approval.evidence_sha256 is distinct from new.evidence_sha256
     or approval.status is distinct from 'APPROVED'
     or approval.applied_at is null
     or approval.requested_by_identity_id = approval.decided_by_identity_id
     or new.verified_by_identity_id is distinct from approval.decided_by_identity_id
     or new.verified_at is null
     or (approval.expires_at is not null and approval.expires_at <= now()) then
    raise exception 'GOV_GEOGRAPHY_CROSSWALK_DUAL_CONTROL_MISMATCH';
  end if;
  if not exists (
    select 1 from geography g
    where g.id=new.geography_id
      and g.source_version is not null
      and length(trim(g.source_version)) > 0
  ) then
    raise exception 'GOV_GEOGRAPHY_CROSSWALK_TARGET_NOT_SOURCE_VERSIONED';
  end if;
  return new;
end;
$$;

drop trigger if exists government_geography_crosswalk_dual_control on government_geography_crosswalks;
create trigger government_geography_crosswalk_dual_control
before insert or update of authority_code, source_system, external_code, source_version, geography_id,
  evidence_reference, evidence_sha256, status, approval_request_id, verified_by_identity_id, verified_at, valid_from, valid_to
on government_geography_crosswalks
for each row execute function enforce_government_geography_crosswalk_dual_control();

comment on table government_geography_crosswalk_requests is
  'Pending/approved/rejected two-person requests for mapping an external government geography identifier to a canonical source-versioned geography record. Evidence is required; approvals are not official government authorization.';
comment on table government_geography_crosswalks is
  'Evidence-backed external-to-canonical geography crosswalk. No official source identifiers are seeded by this migration; VERIFIED mappings require distinct requester and approver and an exact approved request.';

-- Requests are immutable after creation except for one PENDING -> APPROVED/REJECTED decision.
-- Privileged route authorization must still verify the active platform approver before this transition.
create or replace function enforce_government_geography_crosswalk_request_lifecycle()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    if new.status <> 'PENDING' or new.decided_by_identity_id is not null
       or new.decided_at is not null or new.applied_at is not null then
      raise exception 'GOV_GEOGRAPHY_CROSSWALK_REQUEST_MUST_START_PENDING';
    end if;
    return new;
  end if;
  if old.status <> 'PENDING' or new.status not in ('APPROVED','REJECTED')
     or new.id is distinct from old.id
     or new.authority_code is distinct from old.authority_code
     or new.source_system is distinct from old.source_system
     or new.external_code is distinct from old.external_code
     or new.source_version is distinct from old.source_version
     or new.geography_id is distinct from old.geography_id
     or new.evidence_reference is distinct from old.evidence_reference
     or new.evidence_sha256 is distinct from old.evidence_sha256
     or new.request_reason is distinct from old.request_reason
     or new.request_hash is distinct from old.request_hash
     or new.requested_by_identity_id is distinct from old.requested_by_identity_id
     or new.created_at is distinct from old.created_at
     or new.decided_by_identity_id is null
     or new.decided_by_identity_id = new.requested_by_identity_id
     or new.decided_at is null
     or length(trim(coalesce(new.decision_reason,''))) < 8
     or (new.status='APPROVED' and new.applied_at is null)
     or (new.status='REJECTED' and new.applied_at is not null) then
    raise exception 'GOV_GEOGRAPHY_CROSSWALK_REQUEST_LIFECYCLE_INVALID';
  end if;
  return new;
end;
$$;

drop trigger if exists government_geography_crosswalk_request_lifecycle on government_geography_crosswalk_requests;
create trigger government_geography_crosswalk_request_lifecycle
before insert or update on government_geography_crosswalk_requests
for each row execute function enforce_government_geography_crosswalk_request_lifecycle();
