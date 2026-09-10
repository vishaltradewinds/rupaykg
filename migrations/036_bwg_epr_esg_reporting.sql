-- Bulk Waste Generator reporting model aligned to the current SWM Rules 2026
-- and evidence-backed ESG/EPR reporting. External submission is intentionally
-- represented as state only; the platform must not synthesize submission/acceptance.

create table bwg_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id),
  jurisdiction_id uuid references geography(id),
  floor_area_sqm numeric(20,4) check (floor_area_sqm >= 0),
  water_consumption_lpd numeric(20,4) check (water_consumption_lpd >= 0),
  waste_generation_kg_day numeric(20,4) check (waste_generation_kg_day >= 0),
  establishment_type text,
  applicability_status text not null default 'PENDING' check (applicability_status in ('PENDING','APPLICABLE','NOT_APPLICABLE','REVIEW_REQUIRED')),
  applicability_basis jsonb not null default '{}',
  status record_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bwg_reporting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  period_start date not null,
  period_end date not null,
  reporting_basis text not null,
  status lifecycle_status not null default 'DRAFT',
  external_submission_status text not null default 'NOT_SUBMITTED' check (external_submission_status in ('NOT_SUBMITTED','READY','SUBMITTED','ACCEPTED','REJECTED','UNKNOWN')),
  external_submission_reference text,
  created_at timestamptz not null default now(),
  unique (organization_id, period_start, period_end, reporting_basis)
);

create table bwg_waste_reports (
  id uuid primary key default gen_random_uuid(),
  reporting_period_id uuid not null references bwg_reporting_periods(id),
  waste_stream text not null,
  generated_quantity numeric(20,6) not null check (generated_quantity >= 0),
  segregated_quantity numeric(20,6) not null default 0 check (segregated_quantity >= 0),
  channelized_quantity numeric(20,6) not null default 0 check (channelized_quantity >= 0),
  processed_quantity numeric(20,6) not null default 0 check (processed_quantity >= 0),
  unit text not null,
  processor_organization_id uuid references organizations(id),
  evidence_id uuid references evidence(id),
  verification_id uuid references verifications(id),
  status record_status not null default 'PENDING',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (segregated_quantity <= generated_quantity),
  check (channelized_quantity <= generated_quantity),
  check (processed_quantity <= channelized_quantity)
);

create table bwg_epr_reports (
  id uuid primary key default gen_random_uuid(),
  reporting_period_id uuid not null references bwg_reporting_periods(id),
  scheme_id uuid not null references epr_schemes(id),
  category_code text not null,
  obligated_quantity numeric(20,6) not null default 0 check (obligated_quantity >= 0),
  fulfilled_quantity numeric(20,6) not null default 0 check (fulfilled_quantity >= 0),
  evidence_id uuid references evidence(id),
  verification_id uuid references verifications(id),
  status record_status not null default 'PENDING',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table bwg_esg_reports (
  id uuid primary key default gen_random_uuid(),
  reporting_period_id uuid not null references bwg_reporting_periods(id),
  metric_code text not null,
  scope text not null,
  value numeric(20,8) not null check (value >= 0),
  unit text not null,
  evidence_id uuid references evidence(id),
  verification_id uuid references verifications(id),
  status record_status not null default 'PENDING',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index bwg_profiles_org_idx on bwg_profiles(organization_id);
create index bwg_periods_org_idx on bwg_reporting_periods(organization_id);
create index bwg_waste_period_idx on bwg_waste_reports(reporting_period_id);
create index bwg_epr_period_idx on bwg_epr_reports(reporting_period_id);
create index bwg_esg_period_idx on bwg_esg_reports(reporting_period_id);
