-- Persist stakeholder preparation separately from CPCB's official application registry.
create table cpcb_swm_stakeholder_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  geography_id uuid references geography(id),
  stakeholder_type text not null check (stakeholder_type in ('BWG','WASTE_FACILITY','ULB','DISTRICT_PANCHAYAT','GRAM_PANCHAYAT','COLLECTOR_TRANSPORTER','PROCESSOR')),
  title text not null check (length(btrim(title)) between 2 and 240),
  eligibility_observations jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  cpcb_application_reference text,
  cpcb_status_claim text not null default 'USER_REPORTED_UNVERIFIED' check (cpcb_status_claim = 'USER_REPORTED_UNVERIFIED'),
  cpcb_status_source_reference text,
  cpcb_status_reference_recorded_at timestamptz,
  due_date date,
  notes text,
  created_by_identity_id uuid not null references identities(id),
  updated_by_identity_id uuid not null references identities(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cpcb_swm_workspace_org_updated_idx on cpcb_swm_stakeholder_workspaces(organization_id, updated_at desc);
create index cpcb_swm_workspace_geo_idx on cpcb_swm_stakeholder_workspaces(geography_id);
