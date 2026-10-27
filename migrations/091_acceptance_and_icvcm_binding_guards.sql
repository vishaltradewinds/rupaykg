-- Close mutation paths that could detach an accepted EPR return from its
-- authority evidence, and enforce ICVCM organization/activity consistency in SQL.
create or replace function prevent_epr_accepted_confirmation_rewrite()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('ACCEPTED','COMPLETED') then
    if new.organization_id is distinct from old.organization_id
       or new.external_reference is distinct from old.external_reference
       or new.external_authority_name is distinct from old.external_authority_name
       or new.external_confirmation_evidence_id is distinct from old.external_confirmation_evidence_id
       or new.external_confirmation_verification_id is distinct from old.external_confirmation_verification_id
       or new.external_authority_confirmed_at is distinct from old.external_authority_confirmed_at then
      raise exception 'accepted EPR external confirmation is immutable; create a corrected return with new authority evidence';
    end if;
    if new.status is distinct from old.status
       and not (old.status = 'ACCEPTED' and new.status = 'COMPLETED') then
      raise exception 'accepted EPR return status cannot regress or be rewritten';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists epr_accepted_confirmation_immutable on epr_returns;
create trigger epr_accepted_confirmation_immutable
before update of organization_id, status, external_reference, external_authority_name,
  external_confirmation_evidence_id, external_confirmation_verification_id,
  external_authority_confirmed_at
on epr_returns
for each row execute function prevent_epr_accepted_confirmation_rewrite();

create or replace function prevent_epr_accepted_confirmation_artifact_delete()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from epr_returns r
    where r.status in ('ACCEPTED','COMPLETED')
      and r.external_confirmation_evidence_id = old.id
  ) then
    raise exception 'evidence referenced by accepted EPR return cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists epr_acceptance_evidence_delete_guard on evidence;
create trigger epr_acceptance_evidence_delete_guard
before delete on evidence
for each row execute function prevent_epr_accepted_confirmation_artifact_delete();

create or replace function prevent_epr_accepted_verification_delete()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from epr_returns r
    where r.status in ('ACCEPTED','COMPLETED')
      and r.external_confirmation_verification_id = old.id
  ) then
    raise exception 'verification referenced by accepted EPR return cannot be deleted';
  end if;
  return old;
end;
$$;

drop trigger if exists epr_acceptance_verification_delete_guard on verifications;
create trigger epr_acceptance_verification_delete_guard
before delete on verifications
for each row execute function prevent_epr_accepted_verification_delete();

create or replace function enforce_icvcm_assessment_activity_organization()
returns trigger
language plpgsql
as $$
declare
  activity_organization_id uuid;
begin
  select a.organization_id into activity_organization_id
  from activities a where a.id = new.activity_id;
  if activity_organization_id is null then
    raise exception 'ICVCM assessment activity must exist and have an organization';
  end if;
  if activity_organization_id is distinct from new.organization_id then
    raise exception 'ICVCM assessment organization must match the activity organization';
  end if;
  return new;
end;
$$;

drop trigger if exists icvcm_assessment_activity_organization_guard on icvcm_ccp_assessments;
create trigger icvcm_assessment_activity_organization_guard
before insert or update of organization_id, activity_id
on icvcm_ccp_assessments
for each row execute function enforce_icvcm_assessment_activity_organization();
