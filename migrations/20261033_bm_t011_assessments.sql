-- Persist BM-T-011 v1.0 annual Application A FOD calculations as provisional, evidence-linked assessments.
create table bm_t011_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  activity_id uuid not null references activities(id),
  calculation_period_id text not null check (length(trim(calculation_period_id)) between 1 and 120),
  target_year_index integer not null check (target_year_index between 1 and 100),
  calculation_mode text not null check (calculation_mode in ('WA03_001_BASELINE_POTENTIAL','PROJECT_OR_LEAKAGE')),
  calculation_input jsonb not null,
  calculation_result jsonb not null,
  emissions_tco2e numeric(24,8) not null check (emissions_tco2e >= 0),
  input_sha256 text not null check (input_sha256 ~ '^[a-f0-9]{64}$'),
  output_sha256 text not null check (output_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  status text not null default 'CALCULATED_PENDING_VERIFICATION' check (status in ('CALCULATED_PENDING_VERIFICATION','APPROVED','REJECTED')),
  created_by_identity_id uuid not null references identities(id),
  created_at timestamptz not null default now(),
  reviewed_by_identity_id uuid references identities(id),
  reviewed_at timestamptz,
  review_note text,
  unique(activity_id, calculation_period_id, target_year_index, calculation_mode),
  unique(id, activity_id, organization_id),
  check ((status = 'CALCULATED_PENDING_VERIFICATION' and reviewed_by_identity_id is null and reviewed_at is null)
      or (status in ('APPROVED','REJECTED') and reviewed_by_identity_id is not null and reviewed_at is not null
          and reviewed_by_identity_id is distinct from created_by_identity_id))
);
create index bm_t011_assessments_scope_idx on bm_t011_assessments(organization_id, activity_id, created_at desc);
create or replace function guard_bm_t011_assessment_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'BM-T-011 assessments cannot be deleted';
  end if;
  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.activity_id is distinct from old.activity_id
    or new.calculation_period_id is distinct from old.calculation_period_id
    or new.target_year_index is distinct from old.target_year_index
    or new.calculation_mode is distinct from old.calculation_mode
    or new.calculation_input is distinct from old.calculation_input
    or new.calculation_result is distinct from old.calculation_result
    or new.emissions_tco2e is distinct from old.emissions_tco2e
    or new.input_sha256 is distinct from old.input_sha256
    or new.output_sha256 is distinct from old.output_sha256
    or new.evidence_ids is distinct from old.evidence_ids
    or new.created_by_identity_id is distinct from old.created_by_identity_id
    or new.created_at is distinct from old.created_at
    or old.status <> 'CALCULATED_PENDING_VERIFICATION'
    or new.status not in ('APPROVED','REJECTED')
    or new.reviewed_by_identity_id is null
    or new.reviewed_by_identity_id = old.created_by_identity_id
    or new.reviewed_at is null then
    raise exception 'BM-T-011 assessment inputs are immutable; only one independent review decision is permitted';
  end if;
  return new;
end;
$$;
create trigger bm_t011_assessment_immutable
before update or delete on bm_t011_assessments
for each row execute function guard_bm_t011_assessment_mutation();
