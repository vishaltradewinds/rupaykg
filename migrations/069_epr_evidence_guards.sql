-- Fail closed: externally registered EPR applicability must retain verified evidence.
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
        and organization_has_geography_scope(a.organization_id,a.geography_id)
    ) into evidence_ok;
    if not evidence_ok then
      raise exception 'External EPR registration evidence must be verified, approved, provenance-backed and organization/geography scoped';
    end if;
    new.registration_recorded_at := coalesce(new.registration_recorded_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists epr_external_registration_evidence_guard on organization_epr_applicability;
create trigger epr_external_registration_evidence_guard
before insert or update on organization_epr_applicability
for each row execute function enforce_epr_external_registration_evidence();

-- Transfers cannot become completed without an externally traceable certificate reference
-- and verification-backed evidence. The application layer remains responsible for RBAC.
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
        and organization_has_geography_scope(a.organization_id,a.geography_id)
    ) into ok;
    if not ok then
      raise exception 'EPR transfer evidence must be verified, approved, provenance-backed and organization/geography scoped';
    end if;
    new.transferred_at := coalesce(new.transferred_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists epr_transfer_evidence_guard on epr_credit_transfers;
create trigger epr_transfer_evidence_guard
before insert or update on epr_credit_transfers
for each row execute function enforce_epr_transfer_evidence();
