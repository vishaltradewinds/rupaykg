-- Methodology governance makes source locking and reconciliation status explicit.
-- This is a governance record, not a declaration that any methodology is
-- regulator-approved or production-eligible.

alter table methodology_versions
  add column if not exists governance_status text not null default 'SOURCE_LOCKED',
  add column if not exists source_reference text,
  add column if not exists source_hash text,
  add column if not exists applicability_rules jsonb not null default '{}',
  add column if not exists parameter_dictionary jsonb not null default '{}',
  add column if not exists equation_mapping jsonb not null default '{}',
  add column if not exists reconciliation_reference text,
  add column if not exists reconciled_at timestamptz,
  add column if not exists regression_verified_at timestamptz;

alter table methodology_versions
  add constraint methodology_governance_status_valid
  check (governance_status in ('SOURCE_LOCKED','IMPLEMENTATION_MAPPED','NUMERICALLY_RECONCILED','REGRESSION_VERIFIED','PRODUCTION_ELIGIBLE')),
  add constraint methodology_source_hash_format
  check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$'),
  add constraint methodology_reconciled_requires_reference
  check (reconciled_at is null or reconciliation_reference is not null),
  add constraint methodology_production_requires_regression
  check (governance_status <> 'PRODUCTION_ELIGIBLE' or regression_verified_at is not null);

create or replace function enforce_methodology_governance_requirements()
returns trigger language plpgsql as $$
begin
  if new.governance_status in ('IMPLEMENTATION_MAPPED','NUMERICALLY_RECONCILED','REGRESSION_VERIFIED','PRODUCTION_ELIGIBLE') then
    if new.source_reference is null or new.source_hash is null then
      raise exception 'methodology governance requires locked source reference and hash';
    end if;
    if new.applicability_rules = '{}'::jsonb or new.parameter_dictionary = '{}'::jsonb or new.equation_mapping = '{}'::jsonb then
      raise exception 'methodology governance requires applicability, parameter and equation mappings';
    end if;
  end if;
  if new.governance_status in ('NUMERICALLY_RECONCILED','REGRESSION_VERIFIED','PRODUCTION_ELIGIBLE') then
    if new.reconciliation_reference is null or new.reconciled_at is null then
      raise exception 'methodology governance requires numerical reconciliation evidence';
    end if;
  end if;
  if new.governance_status in ('REGRESSION_VERIFIED','PRODUCTION_ELIGIBLE') and new.regression_verified_at is null then
    raise exception 'methodology governance requires regression verification evidence';
  end if;
  return new;
end;
$$;

drop trigger if exists methodology_governance_requirements_guard on methodology_versions;
create trigger methodology_governance_requirements_guard
before insert or update on methodology_versions
for each row execute function enforce_methodology_governance_requirements();

create index if not exists methodology_versions_governance_status_idx on methodology_versions(governance_status);
