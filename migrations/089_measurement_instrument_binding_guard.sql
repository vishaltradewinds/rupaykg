-- Bind newly captured measurements to the exact approved instrument and parameter.
-- Historical rows remain unbound; do not backfill them from free-text source values.

alter table measurements
  add column if not exists mrv_instrument_id uuid references mrv_instruments(id) on delete restrict,
  add column if not exists parameter_code text;

alter table measurements
  drop constraint if exists measurements_instrument_parameter_pair,
  add constraint measurements_instrument_parameter_pair check (
    (mrv_instrument_id is null and parameter_code is null)
    or (mrv_instrument_id is not null and parameter_code is not null and btrim(parameter_code) <> '')
  );

create index if not exists measurements_mrv_instrument_idx
  on measurements(mrv_instrument_id, parameter_code, measured_at desc)
  where mrv_instrument_id is not null;

create or replace function guard_measurement_mrv_instrument_binding()
returns trigger language plpgsql as $$
declare
  instrument_row record;
  activity_organization_id uuid;
begin
  -- Once a reading has an instrument binding, preserve that provenance permanently.
  -- Corrections must be represented as a new measurement, not by unlinking or rebinding it.
  if tg_op = 'UPDATE'
     and old.mrv_instrument_id is not null
     and (new.mrv_instrument_id is distinct from old.mrv_instrument_id
       or new.parameter_code is distinct from old.parameter_code) then
    raise exception 'instrument-bound measurement provenance is immutable; create a corrected measurement instead';
  end if;

  -- Legacy/unlinked measurements remain readable, but are not instrument-certified.
  if new.mrv_instrument_id is null then
    if new.parameter_code is not null then
      raise exception 'measurement parameter_code requires an approved instrument binding';
    end if;
    return new;
  end if;

  if new.parameter_code is null or btrim(new.parameter_code) = '' then
    raise exception 'instrument-bound measurement requires parameter_code';
  end if;

  select organization_id into activity_organization_id
    from activities where id = new.activity_id;
  if activity_organization_id is null then
    raise exception 'measurement activity not found';
  end if;

  select * into instrument_row
    from mrv_instruments
   where id = new.mrv_instrument_id
   for key share;
  if not found then
    raise exception 'measurement instrument is not registered';
  end if;
  if instrument_row.organization_id is distinct from activity_organization_id then
    raise exception 'measurement instrument belongs to a different organization';
  end if;
  if instrument_row.approval_status <> 'VERIFIED' then
    raise exception 'measurement instrument is not VERIFIED';
  end if;
  if not instrument_row.measurement_instrument then
    raise exception 'non-measuring hardware cannot be bound to a physical measurement';
  end if;
  if not exists (
    select 1 from unnest(instrument_row.supported_parameter_codes) p
     where lower(btrim(p)) = lower(btrim(new.parameter_code))
  ) then
    raise exception 'measurement parameter is not supported by the registered instrument';
  end if;

  -- Recheck time-sensitive validity at the moment a reading is written.
  if instrument_row.meity_validity_basis = 'VALID_UNTIL'
     and (instrument_row.meity_valid_until is null or instrument_row.meity_valid_until <= now()) then
    raise exception 'measurement instrument MeitY approval is expired or unknown';
  end if;
  if instrument_row.meity_validity_basis not in ('VALID_UNTIL','NO_EXPIRY_CONFIRMED') then
    raise exception 'measurement instrument approval validity basis is not verified';
  end if;
  if instrument_row.calibration_required
     and (instrument_row.calibration_status <> 'VERIFIED'
       or instrument_row.calibration_valid_until is null
       or instrument_row.calibration_valid_until <= now()) then
    raise exception 'measurement instrument calibration is expired or unverified';
  end if;
  if instrument_row.firmware_version is not null
     and (instrument_row.firmware_support_until is null
       or instrument_row.firmware_support_until <= now()
       or instrument_row.security_review_status <> 'VERIFIED') then
    raise exception 'measurement instrument firmware support or security review is expired or unverified';
  end if;

  return new;
end;
$$;

create trigger measurements_mrv_instrument_binding_guard
before insert or update of activity_id, value, unit, mrv_instrument_id, parameter_code
on measurements
for each row execute function guard_measurement_mrv_instrument_binding();
