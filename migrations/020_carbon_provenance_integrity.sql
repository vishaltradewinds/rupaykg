-- Carbon provenance is part of the authoritative calculation record.
-- A calculation must be reproducible from normalized inputs, the registered
-- methodology rules, and its deterministic trace; provenance cannot be rewritten.

alter table carbon_calculations
  add column if not exists dataset_hash text,
  add column if not exists formula_hash text,
  add column if not exists calculation_trace jsonb not null default '[]',
  add column if not exists provenance_version text not null default '1',
  add column if not exists calculation_hash text;

alter table carbon_calculations
  add constraint carbon_calculation_dataset_hash_required
    check (length(dataset_hash) = 64),
  add constraint carbon_calculation_formula_hash_required
    check (length(formula_hash) = 64),
  add constraint carbon_calculation_hash_required
    check (length(calculation_hash) = 64),
  add constraint carbon_calculation_trace_array
    check (jsonb_typeof(calculation_trace) = 'array');

create or replace function prevent_carbon_provenance_mutation()
returns trigger language plpgsql as $$
begin
  if old.dataset_hash is not null and new.dataset_hash is distinct from old.dataset_hash then
    raise exception 'carbon dataset provenance cannot be changed';
  end if;
  if old.formula_hash is not null and new.formula_hash is distinct from old.formula_hash then
    raise exception 'carbon methodology formula provenance cannot be changed';
  end if;
  if old.calculation_trace is not null and new.calculation_trace is distinct from old.calculation_trace then
    raise exception 'carbon calculation trace cannot be changed';
  end if;
  if old.calculation_hash is not null and new.calculation_hash is distinct from old.calculation_hash then
    raise exception 'carbon calculation hash cannot be changed';
  end if;
  if old.provenance_version is not null and new.provenance_version is distinct from old.provenance_version then
    raise exception 'carbon provenance version cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists carbon_provenance_mutation_guard on carbon_calculations;
create trigger carbon_provenance_mutation_guard
before update on carbon_calculations
for each row execute function prevent_carbon_provenance_mutation();
