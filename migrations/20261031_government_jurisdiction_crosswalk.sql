-- Versioned, evidence-backed mapping from external authority identifiers to tenant geography.
-- Deliberately create no real authority mappings here: source codes must be obtained and reviewed
-- from an authoritative source before a mapping can be approved.
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
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  revoked_at timestamptz,
  check (effective_to is null or effective_to > effective_from),
  check (
    (status = 'VERIFIED' and approved_by_identity_id is not null and approved_by_identity_id <> requested_by_identity_id
      and length(trim(coalesce(approval_reason,''))) >= 8 and verified_at is not null and revoked_at is null)
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

create or replace function enforce_government_jurisdiction_crosswalk()
returns trigger language plpgsql as $$
declare activity_org uuid; activity_geo uuid;
begin
  if new.status = 'VERIFIED' then
    if new.approved_by_identity_id is null
       or new.approved_by_identity_id = new.requested_by_identity_id
       or length(trim(coalesce(new.approval_reason,''))) < 8
       or new.verified_at is null
       or new.verified_at > now()
       or (new.effective_to is not null and new.effective_to <= now())
       or not organization_has_explicit_geography_scope(new.organization_id, new.geography_id) then
      raise exception 'GOVERNMENT_CROSSWALK_VERIFICATION_INVALID';
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

comment on table government_jurisdiction_crosswalks is
  'Versioned, evidence-backed crosswalk for government authority/municipal identifiers to organization geography and optional activity. No mapping is trusted until explicitly VERIFIED; source payloads remain untrusted.';
