-- Bind every approved physical measurement record to one exact hardware unit.
alter table mrv_instruments
  add column if not exists manufacturer_serial_number text,
  add column if not exists asset_tag text,
  add column if not exists calibration_serial_number text;

alter table mrv_instruments
  drop constraint if exists mrv_instruments_manufacturer_serial_nonblank;
alter table mrv_instruments
  add constraint mrv_instruments_manufacturer_serial_nonblank
  check (manufacturer_serial_number is null or btrim(manufacturer_serial_number) <> '');

alter table mrv_instruments
  drop constraint if exists mrv_instruments_asset_tag_nonblank;
alter table mrv_instruments
  add constraint mrv_instruments_asset_tag_nonblank
  check (asset_tag is null or btrim(asset_tag) <> '');

alter table mrv_instruments
  drop constraint if exists mrv_instruments_calibration_serial_nonblank;
alter table mrv_instruments
  add constraint mrv_instruments_calibration_serial_nonblank
  check (calibration_serial_number is null or btrim(calibration_serial_number) <> '');

create unique index if not exists mrv_instruments_physical_serial_identity_idx
  on mrv_instruments(
    organization_id,
    lower(btrim(manufacturer)),
    lower(btrim(manufacturer_serial_number))
  )
  where manufacturer_serial_number is not null;

create unique index if not exists mrv_instruments_asset_tag_identity_idx
  on mrv_instruments(organization_id, lower(btrim(asset_tag)))
  where asset_tag is not null;

create or replace function guard_mrv_instrument_physical_unit_identity()
returns trigger
language plpgsql
as $$
begin
  if new.approval_status = 'VERIFIED' then
    if new.measurement_instrument and nullif(btrim(new.manufacturer_serial_number), '') is null then
      raise exception 'VERIFIED measurement instrument requires exact manufacturer serial number';
    end if;
    if not new.measurement_instrument
       and nullif(btrim(new.manufacturer_serial_number), '') is null
       and nullif(btrim(new.asset_tag), '') is null then
      raise exception 'VERIFIED non-measuring hardware requires manufacturer serial number or organization asset tag';
    end if;
    if new.calibration_required and (
      nullif(btrim(new.manufacturer_serial_number), '') is null
      or new.calibration_serial_number is distinct from new.manufacturer_serial_number
    ) then
      raise exception 'calibration certificate serial must exactly match the registered physical instrument serial';
    end if;
    if not new.calibration_required and new.calibration_serial_number is not null then
      raise exception 'calibration serial must be absent when calibration is explicitly not required';
    end if;
  end if;

  if tg_op = 'UPDATE' and exists (
    select 1 from mrv_instrument_decisions d
     where d.instrument_id = old.id and d.new_status = 'VERIFIED'
  ) and (
    new.manufacturer_serial_number is distinct from old.manufacturer_serial_number
    or new.asset_tag is distinct from old.asset_tag
    or new.calibration_serial_number is distinct from old.calibration_serial_number
  ) then
    raise exception 'verified physical unit identity and calibration serial are immutable; register a new instrument record for a different unit';
  end if;
  return new;
end;
$$;

drop trigger if exists mrv_instrument_physical_unit_identity_guard on mrv_instruments;
create trigger mrv_instrument_physical_unit_identity_guard
before insert or update on mrv_instruments
for each row execute function guard_mrv_instrument_physical_unit_identity();

create or replace function mrv_instrument_physical_unit_identity_is_current(p_instrument_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from mrv_instruments i
     where i.id = p_instrument_id
       and i.approval_status = 'VERIFIED'
       and i.measurement_instrument
       and nullif(btrim(i.manufacturer_serial_number), '') is not null
       and (
         (i.calibration_required and i.calibration_serial_number = i.manufacturer_serial_number)
         or (not i.calibration_required and i.calibration_serial_number is null)
       )
  );
$$;

create or replace function guard_measurement_physical_unit_identity()
returns trigger
language plpgsql
as $$
begin
  if new.mrv_instrument_id is null then return new; end if;
  if not mrv_instrument_physical_unit_identity_is_current(new.mrv_instrument_id) then
    raise exception 'measurement requires a VERIFIED physical measurement instrument with immutable serial identity and matching calibration certificate serial';
  end if;
  return new;
end;
$$;

drop trigger if exists measurements_physical_unit_identity_guard on measurements;
create trigger measurements_physical_unit_identity_guard
before insert or update of mrv_instrument_id
on measurements
for each row execute function guard_measurement_physical_unit_identity();

comment on column mrv_instruments.manufacturer_serial_number is
  'Exact manufacturer serial number from the physical instrument nameplate; immutable after first VERIFIED decision.';
comment on column mrv_instruments.asset_tag is
  'Organization-controlled physical unit identifier, required for verified non-measuring hardware when manufacturer serial is unavailable.';
comment on column mrv_instruments.calibration_serial_number is
  'Serial number printed on the calibration certificate; must exactly match manufacturer_serial_number when calibration is required.';
comment on function mrv_instrument_physical_unit_identity_is_current(uuid) is
  'True only for a VERIFIED physical measurement instrument with an exact manufacturer serial and matching calibration-certificate serial.';
