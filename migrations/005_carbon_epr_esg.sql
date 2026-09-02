-- Methodology-versioned carbon, EPR and ESG evidence model.
-- Calculations are records of methodology application; issuance remains separately governed.

create table carbon_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  geography_id uuid references geography(id),
  project_code text not null unique,
  title text not null,
  methodology_version_id uuid not null references methodology_versions(id),
  status lifecycle_status not null default 'DRAFT',
  created_at timestamptz not null default now()
);

alter table carbon_calculations add column if not exists carbon_project_id uuid references carbon_projects(id);
alter table carbon_calculations add column if not exists baseline_result numeric(20,6);
alter table carbon_calculations add column if not exists uncertainty numeric(20,6);
alter table carbon_calculations add column if not exists calculation_hash text;

create table epr_schemes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  authority text not null,
  jurisdiction_id uuid references geography(id),
  status record_status not null default 'VERIFIED',
  metadata jsonb not null default '{}'
);

create table epr_obligations (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null unique references obligations(id),
  scheme_id uuid not null references epr_schemes(id),
  obligated_organization_id uuid not null references organizations(id),
  category_code text not null,
  target_quantity numeric(20,6) not null check (target_quantity >= 0),
  fulfilled_quantity numeric(20,6) not null default 0 check (fulfilled_quantity >= 0),
  status lifecycle_status not null default 'OPEN'
);

create table epr_credits (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references epr_schemes(id),
  issuer_organization_id uuid not null references organizations(id),
  recycler_organization_id uuid references organizations(id),
  activity_id uuid references activities(id),
  quantity numeric(20,6) not null check (quantity > 0),
  unit text not null,
  status lifecycle_status not null default 'ELIGIBLE',
  evidence_id uuid references evidence(id),
  verification_id uuid references verifications(id),
  created_at timestamptz not null default now()
);

create table esg_reporting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  period_start date not null,
  period_end date not null,
  framework text not null,
  status lifecycle_status not null default 'DRAFT',
  unique(organization_id, period_start, period_end, framework)
);

create table esg_metrics (
  id uuid primary key default gen_random_uuid(),
  reporting_period_id uuid not null references esg_reporting_periods(id),
  metric_code text not null,
  scope text not null,
  value numeric(20,8),
  unit text,
  source_activity_id uuid references activities(id),
  evidence_id uuid references evidence(id),
  verification_id uuid references verifications(id),
  status record_status not null default 'PENDING',
  metadata jsonb not null default '{}'
);

create index carbon_projects_org_idx on carbon_projects(organization_id);
create index carbon_calculations_project_idx on carbon_calculations(carbon_project_id);
create index epr_obligations_scheme_idx on epr_obligations(scheme_id);
create index epr_credits_scheme_idx on epr_credits(scheme_id);
create index esg_period_org_idx on esg_reporting_periods(organization_id);
create index esg_metrics_period_idx on esg_metrics(reporting_period_id);
