-- Recheck current instrument approval and evidence-vault review state at credential issuance.
-- A previously verified HCS/Mirror Node anchor does not preserve registry eligibility
-- if an instrument's MeitY, calibration, security, or parameter-source evidence is later rejected.
create or replace function require_current_mrv_instrument_evidence_for_credential()
returns trigger language plpgsql as $$
declare
  activity_org uuid;
begin
  -- Retirement must remain possible when evidence is revoked; block only value-bearing states.
  if new.status not in ('ISSUED', 'ACTIVE', 'TRANSFERRED') then
    return new;
  end if;

  select a.organization_id into activity_org
    from activities a
   where a.id = new.activity_id;

  if activity_org is null then
    raise exception 'CREDENTIAL_MRV_INSTRUMENT_EVIDENCE_REQUIRED: credential activity is missing';
  end if;

  if not exists (
       select 1 from mrv_observations mo where mo.activity_id = new.activity_id
     )
     and not exists (
       select 1 from measurements mm
        where mm.activity_id = new.activity_id and mm.mrv_instrument_id is not null
     ) then
    raise exception 'CREDENTIAL_MRV_INSTRUMENT_EVIDENCE_REQUIRED: instrument-linked MRV readings are required';
  end if;

  if exists (
    select 1
      from mrv_observations mo
      left join mrv_instruments i
        on i.organization_id = activity_org
       and i.instrument_code = mo.instrument_id
     where mo.activity_id = new.activity_id
       and (
         mo.instrument_id is null or btrim(mo.instrument_id) = ''
         or i.id is null or i.approval_status <> 'VERIFIED'
         or not mrv_instrument_evidence_is_current(i.id)
       )
  ) then
    raise exception 'CREDENTIAL_MRV_INSTRUMENT_EVIDENCE_REQUIRED: every MRV observation must reference a currently verified instrument with current approved evidence';
  end if;

  if exists (
    select 1
      from measurements mm
      left join mrv_instruments i
        on i.id = mm.mrv_instrument_id
       and i.organization_id = activity_org
     where mm.activity_id = new.activity_id
       and mm.mrv_instrument_id is not null
       and (
         i.id is null or i.approval_status <> 'VERIFIED'
         or not mrv_instrument_evidence_is_current(i.id)
       )
  ) then
    raise exception 'CREDENTIAL_MRV_INSTRUMENT_EVIDENCE_REQUIRED: every instrument-linked measurement must reference a currently verified instrument with current approved evidence';
  end if;

  return new;
end;
$$;

drop trigger if exists credentials_require_current_mrv_instrument_evidence on credentials;
create trigger credentials_require_current_mrv_instrument_evidence
before insert or update of status, activity_id, verification_id
on credentials
for each row execute function require_current_mrv_instrument_evidence_for_credential();
