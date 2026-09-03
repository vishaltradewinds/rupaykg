-- Carbon provenance is part of the authoritative calculation record.
-- This migration extends the existing 020 provenance fields with a
-- calculation-level integrity hash. Existing rows are left nullable because
-- provenance cannot be fabricated retroactively.

alter table carbon_calculations
  add column if not exists calculation_hash text;

alter table carbon_calculations
  add constraint carbon_calculation_hash_format
  check (calculation_hash is null or calculation_hash ~ '^[0-9a-f]{64}$');

create or replace function prevent_carbon_provenance_mutation()
returns trigger language plpgsql as $$
begin
  if old.dataset_hash is not null and new.dataset_hash is distinct from old.dataset_hash then
    raise exception 'carbon calculation dataset provenance cannot be changed after assignment';
  end if;
  if old.formula_hash is not null and new.formula_hash is distinct from old.formula_hash then
    raise exception 'carbon calculation formula provenance cannot be changed after assignment';
  end if;
  if old.calculation_trace <> '[]'::jsonb and new.calculation_trace is distinct from old.calculation_trace then
    raise exception 'carbon calculation trace cannot be changed after assignment';
  end if;
  if old.calculation_hash is not null and new.calculation_hash is distinct from old.calculation_hash then
    raise exception 'carbon calculation hash cannot be changed after assignment';
  end if;
  if old.provenance_version is distinct from new.provenance_version then
    raise exception 'carbon calculation provenance version cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists carbon_calculation_provenance_guard on carbon_calculations;
drop trigger if exists carbon_provenance_mutation_guard on carbon_calculations;
create trigger carbon_calculation_provenance_guard
before update on carbon_calculations
for each row execute function prevent_carbon_provenance_mutation();

create index if not exists carbon_calculations_calculation_hash_idx on carbon_calculations(calculation_hash);
