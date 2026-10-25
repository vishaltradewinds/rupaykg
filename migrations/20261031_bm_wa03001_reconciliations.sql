-- Persist method-specific BM WA03.001 Equation 4 reconciliation linked to an approved baseline.
create table bm_wa03001_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  activity_id uuid not null references activities(id),
  baseline_record_id uuid not null references bm_wa03001_baseline_records(id),
  monitoring_period_id text not null check (length(trim(monitoring_period_id)) between 1 and 120),
  equation5_result jsonb not null,
  equation4_input jsonb not null,
  equation4_result_tco2e numeric(24,8) not null,
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  provenance_sha256 text not null check (provenance_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'RECONCILED_PENDING_VERIFICATION' check (status = 'RECONCILED_PENDING_VERIFICATION'),
  created_by_identity_id uuid not null references identities(id),
  created_at timestamptz not null default now(),
  unique(activity_id, monitoring_period_id),
  foreign key (baseline_record_id, activity_id, organization_id)
    references bm_wa03001_baseline_records(id, activity_id, organization_id)
);
create index bm_wa03001_reconciliation_activity_idx on bm_wa03001_reconciliations(organization_id, activity_id, created_at desc);
create or replace function prevent_bm_wa03001_reconciliation_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'BM WA03.001 reconciliation provenance is append-only';
end;
$$;
create trigger bm_wa03001_reconciliation_immutable
before update or delete on bm_wa03001_reconciliations
for each row execute function prevent_bm_wa03001_reconciliation_mutation();
