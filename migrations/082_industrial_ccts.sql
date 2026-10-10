-- Industrial CCTS vertical; compliance and offset workflows remain separate.
create table if not exists industrial_ccts_regulatory_sources (
 source_id text primary key, publisher text not null, title text not null, source_url text not null,
 source_date date, review_status text not null default 'NEEDS_CURRENT_VERIFICATION'
 check (review_status in ('NEEDS_CURRENT_VERIFICATION','CURRENTLY_REVIEWED','SUPERSEDED')),
 source_hash char(64), details jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists industrial_ccts_facilities (
 id uuid primary key, organization_id uuid not null references organizations(id), name text not null, sector_code text not null,
 facility_reference text, designation_status text not null default 'UNVERIFIED'
 check (designation_status in ('UNVERIFIED','CONFIRMED','NOT_DESIGNATED')),
 designation_reference text, created_by uuid not null references identities(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), check (designation_status <> 'CONFIRMED' or designation_reference is not null)
);
create index if not exists industrial_ccts_facilities_org_idx on industrial_ccts_facilities(organization_id,created_at desc);
create table if not exists industrial_ccts_target_rules (
 id uuid primary key, organization_id uuid not null references organizations(id), sector_code text not null, rule_name text not null,
 target_value numeric(24,10) not null check (target_value > 0), target_unit text not null, period_start date not null, period_end date not null,
 source_reference text not null, source_hash char(64) not null check (source_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW','ACTIVE','SUPERSEDED','WITHDRAWN')),
 reviewed_by uuid references identities(id), reviewed_at timestamptz, review_reference text, review_hash char(64) check (review_hash is null or review_hash ~ '^[a-f0-9]{64});
create table if not exists industrial_ccts_periods (
 id uuid primary key, facility_id uuid not null references industrial_ccts_facilities(id), period_start date not null, period_end date not null,
 production_quantity numeric(24,10) not null check (production_quantity > 0), production_unit text not null,
 energy_quantity numeric(24,10) not null check (energy_quantity >= 0), energy_unit text not null,
 emissions_tco2e numeric(24,10) check (emissions_tco2e is null or emissions_tco2e >= 0),
 data_status text not null check (data_status in ('INCOMPLETE','RECORDED_UNVERIFIED','EVIDENCE_REVIEWED')),
 source_reference text, created_by uuid not null references identities(id), created_at timestamptz not null default now(),
 check (period_end >= period_start), unique (facility_id,period_start,period_end)
);
create table if not exists industrial_ccts_calculations (
 id uuid primary key, facility_id uuid not null references industrial_ccts_facilities(id), period_id uuid not null references industrial_ccts_periods(id),
 target_rule_id uuid not null references industrial_ccts_target_rules(id), emissions_intensity numeric(24,10) not null check (emissions_intensity >= 0),
 target_value numeric(24,10) not null check (target_value > 0), target_unit text not null, calculation_hash char(64) not null check (calculation_hash ~ '^[a-f0-9]{64}$'),
 calculation_payload jsonb not null, status text not null default 'PREPARED_NOT_SUBMITTED'
 check (status in ('PREPARED_NOT_SUBMITTED','SUBMITTED','ACCEPTED','REJECTED')),
 created_by uuid not null references identities(id), created_at timestamptz not null default now()
);
create table if not exists industrial_ccts_offset_projects (
 id uuid primary key, organization_id uuid not null references organizations(id), name text not null, sector_code text not null,
 methodology_code text not null, methodology_version text not null, project_boundary text,
 eligibility_status text not null default 'PENDING_REVIEW'
 check (eligibility_status in ('PENDING_REVIEW','ELIGIBLE','INELIGIBLE','MORE_EVIDENCE_REQUIRED')),
 workflow_status text not null default 'DRAFT'
 check (workflow_status in ('DRAFT','ELIGIBILITY_REVIEW','PDD_MONITORING_PLAN','VALIDATION','MONITORING','VERIFICATION','REGISTRY_SUBMISSION','ISSUANCE','REJECTED')),
 created_by uuid not null references identities(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists industrial_ccts_offset_evidence (
 id uuid primary key, project_id uuid not null references industrial_ccts_offset_projects(id), evidence_kind text not null, reference text not null,
 evidence_hash char(64) not null check (evidence_hash ~ '^[a-f0-9]{64}$'), metadata jsonb not null default '{}'::jsonb,
 created_by uuid not null references identities(id), created_at timestamptz not null default now()
);
create table if not exists industrial_ccts_audit_events (
 id bigserial primary key, organization_id uuid not null references organizations(id), entity_type text not null, entity_id uuid not null,
 action text not null, actor_identity_id uuid not null references identities(id), details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
insert into industrial_ccts_regulatory_sources(source_id,publisher,title,source_url,source_date,review_status,details) values
('MOP-LS-2026-03-12-CCTS','Ministry of Power, Government of India','Lok Sabha response on CCTS','https://powermin.gov.in/sites/default/files/uploads/LS12032026_Eng_0.pdf','2026-03-12','NEEDS_CURRENT_VERIFICATION','{"note":"Dated response; verify later notifications and facility-specific targets before operational decisions."}'),
('BEE-OFFSET-METHODOLOGIES','Bureau of Energy Efficiency','Approved Methodologies under Offset Mechanism','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','NEEDS_CURRENT_VERIFICATION','{"note":"Check the live official register before operational decisions."}')
on conflict(source_id) do nothing;
),
 created_by uuid not null references identities(id), created_at timestamptz not null default now(), check (period_end >= period_start),
 check ((status = 'PENDING_REVIEW' and reviewed_by is null and reviewed_at is null and review_reference is null and review_hash is null) or (status <> 'PENDING_REVIEW' and reviewed_by is not null and reviewed_at is not null and review_reference is not null and review_hash is not null))
);
create table if not exists industrial_ccts_periods (
 id uuid primary key, facility_id uuid not null references industrial_ccts_facilities(id), period_start date not null, period_end date not null,
 production_quantity numeric(24,10) not null check (production_quantity > 0), production_unit text not null,
 energy_quantity numeric(24,10) not null check (energy_quantity >= 0), energy_unit text not null,
 emissions_tco2e numeric(24,10) check (emissions_tco2e is null or emissions_tco2e >= 0),
 data_status text not null check (data_status in ('INCOMPLETE','RECORDED_UNVERIFIED','EVIDENCE_REVIEWED')),
 source_reference text, created_by uuid not null references identities(id), created_at timestamptz not null default now(),
 check (period_end >= period_start), unique (facility_id,period_start,period_end)
);
create table if not exists industrial_ccts_calculations (
 id uuid primary key, facility_id uuid not null references industrial_ccts_facilities(id), period_id uuid not null references industrial_ccts_periods(id),
 target_rule_id uuid not null references industrial_ccts_target_rules(id), emissions_intensity numeric(24,10) not null check (emissions_intensity >= 0),
 target_value numeric(24,10) not null check (target_value > 0), target_unit text not null, calculation_hash char(64) not null check (calculation_hash ~ '^[a-f0-9]{64}$'),
 calculation_payload jsonb not null, status text not null default 'PREPARED_NOT_SUBMITTED'
 check (status in ('PREPARED_NOT_SUBMITTED','SUBMITTED','ACCEPTED','REJECTED')),
 created_by uuid not null references identities(id), created_at timestamptz not null default now()
);
create table if not exists industrial_ccts_offset_projects (
 id uuid primary key, organization_id uuid not null references organizations(id), name text not null, sector_code text not null,
 methodology_code text not null, methodology_version text not null, project_boundary text,
 eligibility_status text not null default 'PENDING_REVIEW'
 check (eligibility_status in ('PENDING_REVIEW','ELIGIBLE','INELIGIBLE','MORE_EVIDENCE_REQUIRED')),
 workflow_status text not null default 'DRAFT'
 check (workflow_status in ('DRAFT','ELIGIBILITY_REVIEW','PDD_MONITORING_PLAN','VALIDATION','MONITORING','VERIFICATION','REGISTRY_SUBMISSION','ISSUANCE','REJECTED')),
 created_by uuid not null references identities(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists industrial_ccts_offset_evidence (
 id uuid primary key, project_id uuid not null references industrial_ccts_offset_projects(id), evidence_kind text not null, reference text not null,
 evidence_hash char(64) not null check (evidence_hash ~ '^[a-f0-9]{64}$'), metadata jsonb not null default '{}'::jsonb,
 created_by uuid not null references identities(id), created_at timestamptz not null default now()
);
create table if not exists industrial_ccts_audit_events (
 id bigserial primary key, organization_id uuid not null references organizations(id), entity_type text not null, entity_id uuid not null,
 action text not null, actor_identity_id uuid not null references identities(id), details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
insert into industrial_ccts_regulatory_sources(source_id,publisher,title,source_url,source_date,review_status,details) values
('MOP-LS-2026-03-12-CCTS','Ministry of Power, Government of India','Lok Sabha response on CCTS','https://powermin.gov.in/sites/default/files/uploads/LS12032026_Eng_0.pdf','2026-03-12','NEEDS_CURRENT_VERIFICATION','{"note":"Dated response; verify later notifications and facility-specific targets before operational decisions."}'),
('BEE-OFFSET-METHODOLOGIES','Bureau of Energy Efficiency','Approved Methodologies under Offset Mechanism','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','NEEDS_CURRENT_VERIFICATION','{"note":"Check the live official register before operational decisions."}')
on conflict(source_id) do nothing;
