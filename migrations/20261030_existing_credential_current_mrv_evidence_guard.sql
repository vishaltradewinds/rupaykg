-- Keep already-issued credentials from being transferred or settled against
-- instrument evidence that has since been rejected/expired. This deliberately does
-- not auto-retire or rewrite issued credentials: that lifecycle decision requires an
-- explicit registry/legal policy and must preserve settlement and audit obligations.
-- Synthetic acceptance fixtures are isolated by the same explicit testFixture marker
-- used by the issuance guard; application-generated provenance must never set it.

create or replace function credential_has_current_mrv_instrument_evidence(p_credential_id uuid)
returns boolean
language plpgsql
volatile
as $function$
declare
  activity_id_value uuid;
  activity_org uuid;
begin
  select c.activity_id, a.organization_id
    into activity_id_value, activity_org
    from credentials c
    left join activities a on a.id = c.activity_id
   where c.id = p_credential_id;

  if activity_id_value is null or activity_org is null then
    return false;
  end if;

  -- Lock in the same instrument -> evidence order used by credential issuance
  -- and evidence-vault review. Locks remain held until the caller commits.
  perform i.id
    from mrv_instruments i
   where i.id in (
     select i2.id
       from mrv_instruments i2
       join mrv_observations mo
         on mo.instrument_id = i2.instrument_code
        and mo.activity_id = activity_id_value
      where i2.organization_id = activity_org
     union
     select mm.mrv_instrument_id
       from measurements mm
      where mm.activity_id = activity_id_value
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
             and mo.activity_id = activity_id_value
           where i2.organization_id = activity_org
          union
          select mm.mrv_instrument_id
            from measurements mm
           where mm.activity_id = activity_id_value
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
             and mo.activity_id = activity_id_value
           where i2.organization_id = activity_org
          union
          select mm.mrv_instrument_id
            from measurements mm
           where mm.activity_id = activity_id_value
             and mm.mrv_instrument_id is not null
        )
   )
   order by e.id
   for share;

  if not exists (
    select 1 from mrv_observations mo where mo.activity_id = activity_id_value
    union all
    select 1 from measurements mm
     where mm.activity_id = activity_id_value
       and mm.mrv_instrument_id is not null
  ) then
    return false;
  end if;

  if exists (
    select 1
      from mrv_observations mo
      left join mrv_instruments i
        on i.organization_id = activity_org
       and i.instrument_code = mo.instrument_id
     where mo.activity_id = activity_id_value
       and (
         mo.instrument_id is null or btrim(mo.instrument_id) = ''
         or i.id is null or i.approval_status <> 'VERIFIED'
         or not mrv_instrument_evidence_is_current(i.id)
       )
  ) then
    return false;
  end if;

  if exists (
    select 1
      from measurements mm
      left join mrv_instruments i
        on i.id = mm.mrv_instrument_id
       and i.organization_id = activity_org
     where mm.activity_id = activity_id_value
       and mm.mrv_instrument_id is not null
       and (
         i.id is null or i.approval_status <> 'VERIFIED'
         or not mrv_instrument_evidence_is_current(i.id)
       )
  ) then
    return false;
  end if;

  return true;
end;
$function$;

create or replace function require_current_mrv_evidence_for_registry_use()
returns trigger
language plpgsql
as $function$
declare
  credential_id_value uuid;
begin
  if new.event_type <> 'TRANSFERRED' then
    return new;
  end if;

  credential_id_value := new.credential_id;
  if credential_id_value is null
     or not credential_has_current_mrv_instrument_evidence(credential_id_value) then
    raise exception 'REGISTRY_MRV_EVIDENCE_STALE: transfer requires currently verified instrument evidence'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists registry_transfer_current_mrv_evidence_guard on registry_events;
create trigger registry_transfer_current_mrv_evidence_guard
before insert or update of event_type, credential_id on registry_events
for each row execute function require_current_mrv_evidence_for_registry_use();

create or replace function require_current_mrv_evidence_for_settlement()
returns trigger
language plpgsql
as $function$
begin
  if new.status in ('EXECUTING','RECONCILING','SETTLED')
     and (
       new.credential_id is null
       or not credential_has_current_mrv_instrument_evidence(new.credential_id)
     ) then
    raise exception 'SETTLEMENT_MRV_EVIDENCE_STALE: settlement requires currently verified instrument evidence'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists settlement_current_mrv_evidence_guard on settlements;
create trigger settlement_current_mrv_evidence_guard
before insert or update of status, credential_id on settlements
for each row execute function require_current_mrv_evidence_for_settlement();
