-- Close legacy no-root geography fallback in database-level EPR evidence guards.
-- Migration 069 installed these trigger functions before strict geography authorization
-- was added. Replace the functions in place so existing triggers inherit the strict policy.
-- Existing records are not rewritten; their remediation requires an evidence-backed backfill.
create or replace function enforce_epr_external_registration_evidence()
returns trigger
language plpgsql
as $$
declare
  evidence_ok boolean;
begin
  if new.cpcb_registration_status = 'REGISTERED_EXTERNALLY' then
    if new.registration_evidence_id is null or new.registration_verification_id is null then
      raise exception 'External EPR registration requires registration evidence and verification';
    end if;
    select exists(
      select 1
      from evidence e
      join activities a on a.id=e.activity_id
      join verifications v on v.id=new.registration_verification_id
        and v.evidence_id=e.id
        and v.decision='APPROVED'
      where e.id=new.registration_evidence_id
        and e.status='VERIFIED'
        and a.organization_id=new.organization_id
        and (e.content_hash is not null or e.content_uri is not null)
        and a.geography_id is not null
        and organization_has_explicit_geography_scope(a.organization_id,a.geography_id)
    ) into evidence_ok;
    if not evidence_ok then
      raise exception 'External EPR registration evidence must be verified, approved, provenance-backed and organization/geography scoped';
    end if;
    new.registration_recorded_at := coalesce(new.registration_recorded_at, now());
  end if;
  return new;
end;
$$;

create or replace function enforce_epr_transfer_evidence()
returns trigger
language plpgsql
as $$
declare
  ok boolean;
begin
  if new.status in ('APPROVED','ACTIVE','COMPLETED','TRANSFERRED') then
    if new.evidence_id is null or new.verification_id is null then
      raise exception 'EPR transfer requires evidence and verification';
    end if;
    select exists(
      select 1
      from evidence e
      join activities a on a.id=e.activity_id
      join verifications v on v.id=new.verification_id
        and v.evidence_id=e.id
        and v.decision='APPROVED'
      where e.id=new.evidence_id
        and e.status='VERIFIED'
        and (a.organization_id=new.from_organization_id or a.organization_id=new.to_organization_id)
        and (e.content_hash is not null or e.content_uri is not null)
        and a.geography_id is not null
        and organization_has_explicit_geography_scope(a.organization_id,a.geography_id)
    ) into ok;
    if not ok then
      raise exception 'EPR transfer evidence must be verified, approved, provenance-backed and organization/geography scoped';
    end if;
    new.transferred_at := coalesce(new.transferred_at, now());
  end if;
  return new;
end;
$$;

comment on function enforce_epr_external_registration_evidence() is
  'Fail-closed EPR external-registration evidence guard; requires explicit verified organization geography scope.';
comment on function enforce_epr_transfer_evidence() is
  'Fail-closed EPR transfer evidence guard; requires explicit verified organization geography scope.';
