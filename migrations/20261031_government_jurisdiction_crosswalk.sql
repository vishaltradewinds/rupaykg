-- Versioned, evidence-backed mapping from external authority identifiers to tenant geography.
-- Deliberately create no real authority mappings here: source codes must be obtained and reviewed
-- from an authoritative source before a mapping can be approved.

create table if not exists government_jurisdiction_crosswalk_requests (
  id uuid primary key default gen_random_uuid(),
  authority_code text not null check (authority_code ~ '^[A-Z0-9][A-Z0-9._-]{1,79}$'),
  municipal_code text not null check (municipal_code ~ '^[A-Z0-9][A-Z0-9._-]{1,79}$'),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  organization_id uuid not null references organizations(id),
  geography_id uuid not null references geography(id),
  activity_id uuid references activities(id),
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

create unique index if not exists government_jurisdiction_crosswalk_pending_request_idx
  on government_jurisdiction_crosswalk_requests(authority_code, municipal_code, source_version, organization_id, geography_id)
  where status='PENDING';

create table if not exists government_jurisdiction_crosswalks (
  id uuid primary key default gen_random_uuid(),
  authority_code text not null check (authority_code ~ '^[A-Z0-9][A-Z0-9._-]{1,79}$'),
  municipal_code text not null check (municipal_code ~ '^[A-Z0-9][A-Z0-9._-]{1,79}$'),
  source_version text not null check (length(trim(source_version)) between 1 and 120),
  organization_id uuid not null references organizations(id),
  geography_id uuid not null references geography(id),
  activity_id uuid references activities(id),
  status text not null default 'PENDING' check (status in ('PENDING','VERIFIED','REJECTED','REVOKED')),
  evidence_reference text not null check (length(trim(evidence_reference)) between 1 and 1000),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  requested_by_identity_id uuid not null references identities(id),
  approved_by_identity_id uuid references identities(id),
  approval_reason text,
  approval_request_id uuid unique references government_jurisdiction_crosswalk_requests(id),
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  revoked_at timestamptz,
  check (effective_to is null or effective_to > effective_from),
  check (
    (status = 'VERIFIED' and approved_by_identity_id is not null and approved_by_identity_id <> requested_by_identity_id
      and length(trim(coalesce(approval_reason,''))) >= 8 and verified_at is not null and revoked_at is null
      and approval_request_id is not null)
    or (status = 'PENDING' and approved_by_identity_id is null and verified_at is null and revoked_at is null)
    or (status = 'REJECTED' and approved_by_identity_id is not null and verified_at is null and revoked_at is null)
    or (status = 'REVOKED' and approved_by_identity_id is not null and verified_at is not null and revoked_at is not null)
  )
);

-- An external identifier may resolve to only one currently verified tenant/jurisdiction mapping.
-- If an authority identifier is ambiguous, it must remain unresolved rather than fan out silently.
create unique index if not exists government_jurisdiction_crosswalk_verified_unique_idx
  on government_jurisdiction_crosswalks(authority_code, municipal_code, source_version)
  where status = 'VERIFIED';

create index if not exists government_jurisdiction_crosswalk_org_geo_idx
  on government_jurisdiction_crosswalks(organization_id, geography_id, status);

create index if not exists government_jurisdiction_crosswalk_effective_idx
  on government_jurisdiction_crosswalks(authority_code, municipal_code, effective_from, effective_to);

create or replace function enforce_government_jurisdiction_crosswalk_request_lifecycle()
returns trigger language plpgsql as $$
begin
  if TG_OP='INSERT' then
    if new.status <> 'PENDING' or new.decided_by_identity_id is not null or new.decided_at is not null or new.applied_at is not null then
      raise exception 'GOVERNMENT_CROSSWALK_REQUEST_MUST_START_PENDING';
    end if;
    return new;
  end if;
  if old.status <> 'PENDING' or new.status not in ('APPROVED','REJECTED')
     or new.id is distinct from old.id
     or new.authority_code is distinct from old.authority_code
     or new.municipal_code is distinct from old.municipal_code
     or new.source_version is distinct from old.source_version
     or new.organization_id is distinct from old.organization_id
     or new.geography_id is distinct from old.geography_id
     or new.activity_id is distinct from old.activity_id
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
    raise exception 'GOVERNMENT_CROSSWALK_REQUEST_LIFECYCLE_INVALID';
  end if;
  return new;
end;
$$;

drop trigger if exists government_jurisdiction_crosswalk_request_lifecycle on government_jurisdiction_crosswalk_requests;
create trigger government_jurisdiction_crosswalk_request_lifecycle
before insert or update on government_jurisdiction_crosswalk_requests
for each row execute function enforce_government_jurisdiction_crosswalk_request_lifecycle();

create or replace function enforce_government_jurisdiction_crosswalk()
returns trigger language plpgsql as $$
declare
  activity_org uuid;
  activity_geo uuid;
  approval record;
begin
  if new.status = 'VERIFIED' then
    if new.approval_request_id is null then
      raise exception 'GOVERNMENT_CROSSWALK_REQUIRES_DUAL_CONTROL';
    end if;
    select id, authority_code, municipal_code, source_version, organization_id, geography_id, activity_id,
           evidence_reference, evidence_sha256, status, requested_by_identity_id, decided_by_identity_id,
           decision_reason, applied_at, expires_at
      into approval
      from government_jurisdiction_crosswalk_requests
     where id = new.approval_request_id
     for update;
    if not found
       or approval.authority_code is distinct from new.authority_code
       or approval.municipal_code is distinct from new.municipal_code
       or approval.source_version is distinct from new.source_version
       or approval.organization_id is distinct from new.organization_id
       or approval.geography_id is distinct from new.geography_id
       or approval.activity_id is distinct from new.activity_id
       or approval.evidence_reference is distinct from new.evidence_reference
       or approval.evidence_sha256 is distinct from new.evidence_sha256
       or approval.status is distinct from 'APPROVED'
       or approval.applied_at is null
       or approval.requested_by_identity_id = approval.decided_by_identity_id
       or new.requested_by_identity_id is distinct from approval.requested_by_identity_id
       or new.approved_by_identity_id is distinct from approval.decided_by_identity_id
       or new.approval_reason is distinct from approval.decision_reason
       or new.verified_at is null
       or new.verified_at > now()
       or (approval.expires_at is not null and approval.expires_at <= now())
       or (new.effective_to is not null and new.effective_to <= now())
       or not organization_has_explicit_geography_scope(new.organization_id, new.geography_id)
       or not exists (select 1 from geography g where g.id=new.geography_id and nullif(trim(g.source_version),'') is not null) then
      raise exception 'GOVERNMENT_CROSSWALK_DUAL_CONTROL_MISMATCH';
    end if;
    if new.activity_id is not null then
      select organization_id, geography_id into activity_org, activity_geo
        from activities where id = new.activity_id;
      if not found or activity_org <> new.organization_id or activity_geo is distinct from new.geography_id then
        raise exception 'GOVERNMENT_CROSSWALK_ACTIVITY_MISMATCH';
      end if;
    end if;
  end if;
  if new.status = 'REVOKED' and (new.approved_by_identity_id is null or new.approved_by_identity_id = new.requested_by_identity_id or new.revoked_at is null) then
    raise exception 'GOVERNMENT_CROSSWALK_REVOCATION_INVALID';
  end if;
  return new;
end;
$$;

drop trigger if exists government_jurisdiction_crosswalk_guard on government_jurisdiction_crosswalks;
create trigger government_jurisdiction_crosswalk_guard
before insert or update on government_jurisdiction_crosswalks
for each row execute function enforce_government_jurisdiction_crosswalk();

comment on table government_jurisdiction_crosswalk_requests is
  'Immutable source mapping request and single evidence-bound decision; API must authenticate requester and authorized independent approver.';
comment on table government_jurisdiction_crosswalks is
  'Versioned, evidence-backed crosswalk for government authority/municipal identifiers to organization geography and optional activity. No mapping is trusted until an exact request is approved; source payloads remain untrusted.';
