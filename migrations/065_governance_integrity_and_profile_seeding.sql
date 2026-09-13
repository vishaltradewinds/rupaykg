-- Governance integrity for organization/legal verification and statutory applicability.
-- Additive only: this does not grant statutory approval or external registration.

create or replace function ensure_organization_governance_profile()
returns trigger
language plpgsql
as $$
begin
  insert into organization_statutory_profiles
    (organization_id, framework, rule_reference, effective_from, applicability_status, basis)
  values
    (new.id, 'SWM_BWG', 'SWM_RULES_2026_S_O_388_E', date '2026-04-01', 'UNKNOWN',
     jsonb_build_object('source', 'RupayKG governance catalogue', 'externalAcceptance', false,
       'thresholds', jsonb_build_object('floorAreaSqM', 20000,
         'waterConsumptionLpd', 40000, 'solidWasteKgpd', 100)))
  on conflict (organization_id, framework, rule_reference, effective_from) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_seed_organization_governance_profile on organizations;
create trigger trg_seed_organization_governance_profile
after insert on organizations
for each row execute function ensure_organization_governance_profile();

create or replace function validate_organization_verification_integrity()
returns trigger
language plpgsql
as $$
begin
  if new.verification_status = 'VERIFIED'
     and (new.verified_by_identity_id is null or new.verified_at is null) then
    raise exception 'ORGANIZATION_VERIFICATION_INCOMPLETE: verified organizations require verifier identity and timestamp';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_organization_verification on organizations;
create trigger trg_validate_organization_verification
before insert or update of verification_status, verified_by_identity_id, verified_at on organizations
for each row execute function validate_organization_verification_integrity();

create or replace function validate_organization_evidence_integrity()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'VERIFIED'
     and (new.verified_by_identity_id is null or new.verified_at is null
          or (nullif(trim(new.document_reference), '') is null
              and nullif(trim(new.content_hash), '') is null)) then
    raise exception 'ORGANIZATION_EVIDENCE_INCOMPLETE: verified evidence requires verifier, timestamp and reference or content hash';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_organization_verification_evidence on organization_verification_evidence;
create trigger trg_validate_organization_verification_evidence
before insert or update of status, verified_by_identity_id, verified_at, document_reference, content_hash
on organization_verification_evidence
for each row execute function validate_organization_evidence_integrity();

create or replace function validate_statutory_profile_integrity()
returns trigger
language plpgsql
as $$
begin
  if new.externally_confirmed = true
     and (nullif(trim(new.external_authority), '') is null
          or nullif(trim(new.external_reference), '') is null
          or new.determined_by_identity_id is null
          or new.determined_at is null) then
    raise exception 'STATUTORY_EXTERNAL_CONFIRMATION_INCOMPLETE: external confirmation requires authority, reference, determiner and timestamp';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_statutory_profile on organization_statutory_profiles;
create trigger trg_validate_statutory_profile
before insert or update of externally_confirmed, external_authority, external_reference, determined_by_identity_id, determined_at
on organization_statutory_profiles
for each row execute function validate_statutory_profile_integrity();

create or replace function validate_epr_external_registration_integrity()
returns trigger
language plpgsql
as $$
begin
  if new.cpcb_registration_status = 'REGISTERED_EXTERNALLY'
     and nullif(trim(new.cpcb_registration_reference), '') is null then
    raise exception 'CPCB_REGISTRATION_REFERENCE_REQUIRED: externally registered EPR status requires an external registration reference';
  end if;
  if new.cpcb_registration_status = 'REGISTERED_EXTERNALLY'
     and (new.determined_by_identity_id is null or new.determined_at is null) then
    raise exception 'CPCB_REGISTRATION_VERIFICATION_REQUIRED: externally registered EPR status requires a determiner and timestamp';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_epr_external_registration on organization_epr_applicability;
create trigger trg_validate_epr_external_registration
before insert or update of cpcb_registration_status, cpcb_registration_reference, determined_by_identity_id, determined_at
on organization_epr_applicability
for each row execute function validate_epr_external_registration_integrity();

comment on table organization_statutory_profiles is
  'Platform applicability assessment only; externally_confirmed requires authoritative external evidence and never follows from internal applicability alone.';
comment on table organization_epr_applicability is
  'Scheme-specific EPR preparation/assessment state; REGISTERED_EXTERNALLY requires an actual external registration reference.';
