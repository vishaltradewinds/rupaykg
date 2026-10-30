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

  -- Serialize issuance against instrument status changes and evidence-vault review.
  -- The review API locks the instrument row and the evidence row before appending a
  -- review decision. Holding SHARE locks until this credential transaction commits
  -- prevents a concurrent rejection from racing past the current-evidence check.
  perform i.id
    from mrv_instruments i
   where i.id in (
     select i2.id
       from mrv_instruments i2
       join mrv_observations mo
         on mo.instrument_id = i2.instrument_code
        and mo.activity_id = new.activity_id
      where i2.organization_id = activity_org
     union
     select mm.mrv_instrument_id
       from measurements mm
      where mm.activity_id = new.activity_id
        and mm.mrv_instrument_id is not null
   )
   order by i.id
   for share;

  perform e.id
    from evidence e
   where exists (
     select 1
       from evidence_artifact_versions v
       join mrv_instruments i
         on v.id in (i.meity_evidence_artifact_version_id,
                     i.calibration_evidence_artifact_version_id,
                     i.security_evidence_artifact_version_id)
      where v.evidence_id = e.id
        and i.organization_id = activity_org
        and i.id in (
          select i2.id
            from mrv_instruments i2
            join mrv_observations mo
              on mo.instrument_id = i2.instrument_code
             and mo.activity_id = new.activity_id
           where i2.organization_id = activity_org
          union
          select mm.mrv_instrument_id
            from measurements mm
           where mm.activity_id = new.activity_id
             and mm.mrv_instrument_id is not null
        )
   ) or exists (
     select 1
       from evidence_artifact_versions v
       join mrv_instrument_parameter_specs ps
         on ps.source_evidence_artifact_version_id = v.id
       join mrv_instruments i on i.id = ps.instrument_id
      where v.evidence_id = e.id
        and i.organization_id = activity_org
        and i.id in (
          select i2.id
            from mrv_instruments i2
            join mrv_observations mo
              on mo.instrument_id = i2.instrument_code
             and mo.activity_id = new.activity_id
           where i2.organization_id = activity_org
          union
          select mm.mrv_instrument_id
            from measurements mm
           where mm.activity_id = new.activity_id
             and mm.mrv_instrument_id is not null
        )
   )
   order by e.id
   for share;

  -- Preserve the legacy lifecycle for activities with no instrument-linked MRV inputs.
  -- When observations exist, the checks below still fail closed on missing/unverified
  -- instrument identity; instrument-linked measurements must also pass current evidence.
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
