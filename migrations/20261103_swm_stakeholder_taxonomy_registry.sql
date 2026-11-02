-- Governed, source-versioned taxonomy for CPCB SWM preparation workflows.
create table if not exists swm_stakeholder_taxonomy (
 code text primary key check (code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
 display_name text not null check (length(trim(display_name)) between 2 and 160),
 checklist_profile text not null check (checklist_profile in ('BWG','WASTE_FACILITY','ULB','DISTRICT_PANCHAYAT','GRAM_PANCHAYAT','COLLECTOR_TRANSPORTER','PROCESSOR')),
 governance_status text not null check (governance_status in ('BASELINE_SUPPORTED','PROPOSED','APPROVED','RETIRED')),
 source_reference text not null check (length(trim(source_reference)) between 1 and 1000),
 source_version text not null check (length(trim(source_version)) between 1 and 120),
 source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
 effective_from date not null, effective_to date,
 reviewed_by_identity_id uuid references identities(id), reviewed_at timestamptz,
 notes text not null default '', created_at timestamptz not null default now(),
 check (effective_to is null or effective_to >= effective_from),
 check (governance_status <> 'APPROVED' or (source_sha256 is not null and reviewed_by_identity_id is not null and reviewed_at is not null)),
 check (governance_status <> 'RETIRED' or effective_to is not null)
);
insert into swm_stakeholder_taxonomy (code,display_name,checklist_profile,governance_status,source_reference,source_version,effective_from,notes) values
('BWG','Bulk Waste Generator','BWG','BASELINE_SUPPORTED','https://swmp.cpcb.gov.in/en/user-guide','platform-baseline-reviewed-2026-10-21',date '2026-01-01','Existing supported profile; not official registration.'),
('WASTE_FACILITY','Waste Facility','WASTE_FACILITY','BASELINE_SUPPORTED','https://swmp.cpcb.gov.in/en/user-guide','platform-baseline-reviewed-2026-10-21',date '2026-01-01','Applicability remains independently governed.'),
('ULB','Urban Local Body','ULB','BASELINE_SUPPORTED','https://swmp.cpcb.gov.in/en/user-guide','platform-baseline-reviewed-2026-10-21',date '2026-01-01','Taxonomy does not grant jurisdiction.'),
('DISTRICT_PANCHAYAT','District Panchayat','DISTRICT_PANCHAYAT','BASELINE_SUPPORTED','https://swmp.cpcb.gov.in/en/user-guide','platform-baseline-reviewed-2026-10-21',date '2026-01-01','Taxonomy does not grant jurisdiction.'),
('GRAM_PANCHAYAT','Gram Panchayat','GRAM_PANCHAYAT','BASELINE_SUPPORTED','https://swmp.cpcb.gov.in/en/user-guide','platform-baseline-reviewed-2026-10-21',date '2026-01-01','Taxonomy does not grant jurisdiction.'),
('COLLECTOR_TRANSPORTER','Collector / Transporter','COLLECTOR_TRANSPORTER','BASELINE_SUPPORTED','https://swmp.cpcb.gov.in/en/user-guide','platform-baseline-reviewed-2026-10-21',date '2026-01-01','Authorization remains separate.'),
('PROCESSOR','Waste Processor','PROCESSOR','BASELINE_SUPPORTED','https://swmp.cpcb.gov.in/en/user-guide','platform-baseline-reviewed-2026-10-21',date '2026-01-01','Processor registration is not conferred by this row.')
on conflict (code) do nothing;
alter table cpcb_swm_stakeholder_workspaces drop constraint if exists cpcb_swm_stakeholder_workspaces_stakeholder_type_check;
alter table cpcb_swm_stakeholder_workspaces add constraint cpcb_swm_workspace_taxonomy_fk foreign key (stakeholder_type) references swm_stakeholder_taxonomy(code) on update restrict on delete restrict;
alter table organization_stakeholder_authorizations drop constraint if exists organization_stakeholder_authorizations_stakeholder_type_check;
alter table organization_stakeholder_authorizations add constraint organization_stakeholder_authorization_taxonomy_fk foreign key (stakeholder_type) references swm_stakeholder_taxonomy(code) on update restrict on delete restrict;
alter table organization_stakeholder_authorization_requests drop constraint if exists organization_stakeholder_authorization_requests_stakeholder_type_check;
alter table organization_stakeholder_authorization_requests add constraint organization_stakeholder_authorization_request_taxonomy_fk foreign key (stakeholder_type) references swm_stakeholder_taxonomy(code) on update restrict on delete restrict;
create index if not exists swm_stakeholder_taxonomy_active_idx on swm_stakeholder_taxonomy(governance_status,effective_from,effective_to);
