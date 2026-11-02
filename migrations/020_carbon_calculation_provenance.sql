-- Carbon calculations must retain the exact methodological and input provenance used to produce them.
-- Hashes and trace are evidence of what was calculated, not mutable annotations.

alter table carbon_calculations
  add column if not exists dataset_hash text,
  add column if not exists formula_hash text,
  add column if not exists calculation_trace jsonb not null default '[]'::jsonb,
  add column if not exists provenance_version text not null default '1';

alter table carbon_calculations
  add constraint carbon_calculation_dataset_hash_format
  check (dataset_hash is null or dataset_hash ~ '^[0-9a-f]{64}$'),
  add constraint carbon_calculation_formula_hash_format
  check (formula_hash is null or formula_hash ~ '^[0-9a-f]{64}$');

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
  if old.provenance_version is distinct from new.provenance_version then
    raise exception 'carbon calculation provenance version cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists carbon_calculation_provenance_guard on carbon_calculations;
create trigger carbon_calculation_provenance_guard
before update on carbon_calculations
for each row execute function prevent_carbon_provenance_mutation();

create index if not exists carbon_calculations_dataset_hash_idx on carbon_calculations(dataset_hash);
create index if not exists carbon_calculations_formula_hash_idx on carbon_calculations(formula_hash);
