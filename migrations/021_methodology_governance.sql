-- Methodology governance makes source-locking, implementation mapping and
-- numerical/regression readiness explicit without manufacturing regulatory status.

alter table methodology_versions
  add column if not exists governance_status text not null default 'SOURCE_LOCKED',
  add column if not exists source_reference text,
  add column if not exists source_hash text,
  add column if not exists applicability_rules jsonb not null default '{}',
  add column if not exists parameter_dictionary jsonb not null default '{}',
  add column if not exists equation_mapping jsonb not null default '{}',
  add column if not exists reconciliation_evidence jsonb not null default '[]';

alter table methodology_versions
  add constraint methodology_governance_status_valid
    check (governance_status in ('SOURCE_LOCKED','IMPLEMENTATION_MAPPED','NUMERICALLY_RECONCILED','REGRESSION_VERIFIED','PRODUCTION_ELIGIBLE')),
  add constraint methodology_source_hash_format
    check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$'),
  add constraint methodology_applicability_object
    check (jsonb_typeof(applicability_rules) = 'object'),
  add constraint methodology_parameter_dictionary_object
    check (jsonb_typeof(parameter_dictionary) = 'object'),
  add constraint methodology_equation_mapping_object
    check (jsonb_typeof(equation_mapping) = 'object'),
  add constraint methodology_reconciliation_array
    check (jsonb_typeof(reconciliation_evidence) = 'array'),
  add constraint methodology_mapped_requires_source
    check (governance_status = 'SOURCE_LOCKED' or source_reference is not null),
  add constraint methodology_reconciled_requires_mapping
    check (governance_status in ('SOURCE_LOCKED','IMPLEMENTATION_MAPPED') or (source_reference is not null and jsonb_typeof(equation_mapping) = 'object' and equation_mapping <> '{}')),
  add constraint methodology_production_requires_regression
    check (governance_status <> 'PRODUCTION_ELIGIBLE' or (reconciliation_evidence <> '[]'::jsonb and source_hash is not null));

create index methodology_governance_status_idx on methodology_versions(governance_status);
create index methodology_source_hash_idx on methodology_versions(source_hash);
