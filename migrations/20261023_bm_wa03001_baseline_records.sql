-- Immutable, activity-scoped BM WA03.001 baseline records with explicit evidence and independent approval.
create table bm_wa03001_baseline_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  activity_id uuid not null references activities(id),
  methodology_code text not null default 'BM WA03.001' check (methodology_code = 'BM WA03.001'),
  methodology_version text not null default '1.0' check (methodology_version = '1.0'),
  baseline_fch4_tch4 numeric(20,8) not null check (baseline_fch4_tch4 >= 0),
  baseline_period text not null check (length(trim(baseline_period)) between 1 and 120),
  evidence_ids uuid[] not null check (cardinality(evidence_ids) > 0),
  record_sha256 text not null check (record_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED','APPROVED','REJECTED')),
  submitted_by_identity_id uuid not null references identities(id),
  submitted_at timestamptz not null default now(),
  approved_by_identity_id uuid references identities(id),
  approved_at timestamptz,
  approval_note text,
  unique(id, activity_id, organization_id),
  check ((status = 'APPROVED' and approved_by_identity_id is not null and approved_at is not null and approved_by_identity_id is distinct from submitted_by_identity_id) or status <> 'APPROVED')
);
create index bm_wa03001_baseline_activity_idx on bm_wa03001_baseline_records(organization_id, activity_id, submitted_at desc);
create or replace function guard_bm_wa03001_baseline_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'BM WA03.001 baseline records cannot be deleted';
  end if;
  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.activity_id is distinct from old.activity_id
    or new.methodology_code is distinct from old.methodology_code
    or new.methodology_version is distinct from old.methodology_version
    or new.baseline_fch4_tch4 is distinct from old.baseline_fch4_tch4
    or new.baseline_period is distinct from old.baseline_period
    or new.evidence_ids is distinct from old.evidence_ids
    or new.record_sha256 is distinct from old.record_sha256
    or new.submitted_by_identity_id is distinct from old.submitted_by_identity_id
    or new.submitted_at is distinct from old.submitted_at
    or old.status <> 'SUBMITTED'
    or new.status not in ('APPROVED','REJECTED')
    or new.approved_by_identity_id is null
    or new.approved_by_identity_id = old.submitted_by_identity_id
    or new.approved_at is null then
    raise exception 'Baseline data is immutable; only a one-time independent approval/rejection transition is permitted';
  end if;
  return new;
end;
$$;
create trigger bm_wa03001_baseline_immutable
before update or delete on bm_wa03001_baseline_records
for each row execute function guard_bm_wa03001_baseline_mutation();
