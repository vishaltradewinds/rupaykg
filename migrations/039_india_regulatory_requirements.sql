-- India regulatory applicability catalog.
-- This migration creates the requirements table and records authoritative
-- regulatory instruments. Requirement rows are seeded in migration 042 so
-- source registration and requirement seeding remain independently testable.
-- This catalog does not confer statutory authority or replace
-- CPCB/SPCB/PCC/ULB/SEBI/BEE systems.

create table if not exists regulatory_requirements (
  id uuid primary key default gen_random_uuid(),
  regulatory_source_id uuid not null references regulatory_sources(id),
  code text not null unique,
  stakeholder_class text not null,
  requirement_type text not null,
  obligation text not null,
  evidence_requirements jsonb not null default '[]'::jsonb,
  reporting_frequency text,
  external_system text,
  external_url text,
  status regulatory_status not null default 'IN_FORCE',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists regulatory_requirements_source_idx on regulatory_requirements(regulatory_source_id);
create index if not exists regulatory_requirements_stakeholder_idx on regulatory_requirements(stakeholder_class);
create index if not exists regulatory_requirements_type_idx on regulatory_requirements(requirement_type);

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
select 'Ministry of Environment, Forest and Climate Change','Plastic Waste Management Rules, 2016 and amendments','RULE','G.S.R. 320(E) and subsequent amendments','2016-03-18','2016-03-18','India','https://pwm.cpcb.gov.in/','2026-09-11','IN_FORCE','compliance','CPCB centralized plastic EPR system; applicability and obligations are governed by the Rules and current amendments.'
where not exists (select 1 from regulatory_sources where authority='Ministry of Environment, Forest and Climate Change' and title='Plastic Waste Management Rules, 2016 and amendments');

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
select 'Ministry of Environment, Forest and Climate Change','E-Waste (Management) Rules, 2022 and amendments','RULE','G.S.R. 801(E)','2022-11-02','2022-11-02','India','https://eprewaste.cpcb.gov.in/','2026-09-11','IN_FORCE','compliance','CPCB EPR portal for producer, recycler and refurbisher registration and EPR obligations.'
where not exists (select 1 from regulatory_sources where authority='Ministry of Environment, Forest and Climate Change' and title='E-Waste (Management) Rules, 2022 and amendments');

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
select 'Ministry of Environment, Forest and Climate Change','Battery Waste Management Rules, 2022 and amendments','RULE','S.O. 3984(E)','2022-08-22','2022-08-22','India','https://eprbattery.cpcb.gov.in/','2026-09-11','IN_FORCE','compliance','CPCB centralized battery EPR portal; obligations include registration, collection/recycling targets and returns.'
where not exists (select 1 from regulatory_sources where authority='Ministry of Environment, Forest and Climate Change' and title='Battery Waste Management Rules, 2022 and amendments');

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
select 'Ministry of Environment, Forest and Climate Change','Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016 - Waste Tyre EPR','RULE','Schedule IX / 2022 amendment regime','2022-12-31','2022-12-31','India','https://eprtyres.cpcb.gov.in/','2026-09-11','IN_FORCE','compliance','CPCB Waste Tyre EPR portal for producers, recyclers and retreaders; statutory registration and certificate workflows remain external.'
where not exists (select 1 from regulatory_sources where authority='Ministry of Environment, Forest and Climate Change' and title='Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016 - Waste Tyre EPR');

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
select 'Ministry of Environment, Forest and Climate Change','Environment (Construction and Demolition) Waste Management Rules, 2025','RULE','C&D Waste Management Rules, 2025','2025-01-01','2025-01-01','India','https://cdwm.cpcb.gov.in/','2026-09-11','IN_FORCE','compliance','CPCB C&D system supports registration, compliance submissions, EPR certificate workflows and utilization tracking under the notified regime.')
where not exists (select 1 from regulatory_sources where authority='Ministry of Environment, Forest and Climate Change' and title='Environment (Construction and Demolition) Waste Management Rules, 2025');

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
select 'Securities and Exchange Board of India','BRSR - Business Responsibility and Sustainability Reporting','CIRCULAR','SEBI/HO/CFD/CMD-2/P/CIR/2021/562','2021-05-10','2022-04-01','India','https://www.sebi.gov.in/sebi_data/attachdocs/may-2021/1620655793598.pdf','2026-09-11','IN_FORCE','esg','Applicable BRSR disclosures must remain traceable to authoritative records; RupayKG is not the statutory filing authority.')
where not exists (select 1 from regulatory_sources where authority='Securities and Exchange Board of India' and title='BRSR - Business Responsibility and Sustainability Reporting');

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
select 'Securities and Exchange Board of India','BRSR Core - Framework for assurance and ESG disclosures for value chain','CIRCULAR','SEBI/HO/CFD/CFD-SEC-2/P/CIR/2023/122','2023-07-12','2023-07-12','India','https://www.sebi.gov.in/legal/circulars/jul-2023/brsr-core-framework-for-assurance-and-esg-disclosures-for-value-chain_73854.html','2026-09-11','IN_FORCE','esg','Track applicable BRSR Core metrics, value-chain disclosures and independent assurance state.')
where not exists (select 1 from regulatory_sources where authority='Securities and Exchange Board of India' and title='BRSR Core - Framework for assurance and ESG disclosures for value chain');

-- The catalog is an implementation boundary, not statutory certification.
