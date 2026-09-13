-- Automatically record carbon calculations as non-consuming environmental references.
-- A calculation is not an official carbon certificate; BEE's CCTS distinguishes
-- calculation/project activity from authority-backed certificate issuance.

create or replace function record_carbon_calculation_reporting_reference()
returns trigger
language plpgsql
as $$
begin
  insert into environmental_attribute_claims (
    organization_id,
    activity_id,
    claim_type,
    framework_code,
    mechanism_code,
    claim_quantity,
    claim_unit,
    basis_key,
    consumption_mode,
    source_type,
    source_id,
    status,
    metadata
  )
  select
    a.organization_id,
    NEW.activity_id,
    'CARBON',
    'INTERNAL_CARBON_CALCULATION',
    null,
    greatest(NEW.result, 0),
    NEW.unit,
    'activity:' || NEW.activity_id::text,
    'REPORTING_REFERENCE',
    'CARBON_CALCULATION',
    NEW.id,
    'ACTIVE',
    jsonb_build_object(
      'calculationHash', NEW.calculation_hash,
      'methodologyVersionId', NEW.methodology_version_id,
      'provenanceVersion', NEW.provenance_version
    )
  from activities a
  where a.id = NEW.activity_id
    and greatest(NEW.result, 0) > 0
  on conflict (source_type, source_id) do nothing;

  return NEW;
end;
$$;

create trigger carbon_calculation_reporting_reference
after insert on carbon_calculations
for each row execute function record_carbon_calculation_reporting_reference();

comment on function record_carbon_calculation_reporting_reference() is
  'Records internal carbon calculations as non-consuming references; it does not issue or represent an official carbon credit certificate.';
