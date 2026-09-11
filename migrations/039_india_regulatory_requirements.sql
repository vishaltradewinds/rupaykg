-- India regulatory applicability catalog.
-- This catalog records authoritative instruments and operational obligations
-- RupayKG can track. It does not confer statutory authority or replace
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

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'PWM-PIBO-PWP-REGISTRATION','PRODUCER_IMPORTER_BRAND_OWNER_PROCESSOR','REGISTRATION','Maintain applicable registration with the competent CPCB/SPCB/PCC EPR authority.','["legal_entity","authorization","registration_reference"]'::jsonb,'ON_EVENT','CPCB Plastic EPR Portal','https://eprplastic.cpcb.gov.in/','RupayKG records statutory references and status; it does not create statutory registration.'
from regulatory_sources where title='Plastic Waste Management Rules, 2016 and amendments'
and not exists (select 1 from regulatory_requirements where code='PWM-PIBO-PWP-REGISTRATION');

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'PWM-EPR-RETURN-CERTIFICATE','PRODUCER_IMPORTER_BRAND_OWNER_PROCESSOR','EPR','Track category-wise eligible processing evidence, EPR certificate references and required returns.','["verified_activity","measurement","evidence","verification","certificate_reference","return_reference"]'::jsonb,'ANNUAL_OR_AS_NOTIFIED','CPCB Plastic EPR Portal','https://eprplastic.cpcb.gov.in/','Only certificates accepted by the statutory portal can satisfy statutory obligations.'
from regulatory_sources where title='Plastic Waste Management Rules, 2016 and amendments'
and not exists (select 1 from regulatory_requirements where code='PWM-EPR-RETURN-CERTIFICATE');

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'E-WASTE-REGISTRATION','PRODUCER_RECYCLER_REFURBISHER','REGISTRATION','Maintain applicable CPCB/SPCB/PCC registrations under the E-Waste EPR regime.','["legal_entity","registration_reference","authorization"]'::jsonb,'ON_EVENT','CPCB E-Waste EPR Portal','https://eprewaste.cpcb.gov.in/','Portal registration and statutory acceptance remain authoritative externally.'
from regulatory_sources where title='E-Waste (Management) Rules, 2022 and amendments'
and not exists (select 1 from regulatory_requirements where code='E-WASTE-REGISTRATION');

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'E-WASTE-EPR-RETURNS','PRODUCER_RECYCLER_REFURBISHER','EPR','Track EPR targets, eligible recycling evidence, certificate transactions and required returns.','["sales_or_introduction_data","verified_recycling","certificate_reference","return_reference"]'::jsonb,'QUARTERLY_OR_AS_NOTIFIED','CPCB E-Waste EPR Portal','https://eprewaste.cpcb.gov.in/','Distinguish internal evidence from statutory portal acceptance.'
from regulatory_sources where title='E-Waste (Management) Rules, 2022 and amendments'
and not exists (select 1 from regulatory_requirements where code='E-WASTE-EPR-RETURNS');

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'BATTERY-EPR-REGISTRATION','PRODUCER_RECYCLER_REFURBISHER','REGISTRATION','Maintain applicable registration with CPCB and concerned SPCB/PCC as required by the Battery Waste Management Rules.','["legal_entity","registration_reference","authorization"]'::jsonb,'ON_EVENT','CPCB Battery EPR Portal','https://eprbattery.cpcb.gov.in/','Battery EPR participation is controlled by the statutory portal.'
from regulatory_sources where title='Battery Waste Management Rules, 2022 and amendments'
and not exists (select 1 from regulatory_requirements where code='BATTERY-EPR-REGISTRATION');

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'BATTERY-EPR-TARGETS-RETURNS','PRODUCER_RECYCLER_REFURBISHER','EPR','Track collection/recycling targets, EPR credits/certificates and annual returns against the applicable schedule.','["market_introduction_data","verified_processing","certificate_reference","return_reference"]'::jsonb,'ANNUAL_OR_AS_NOTIFIED','CPCB Battery EPR Portal','https://eprbattery.cpcb.gov.in/','Target calculations must use the applicable rule version and reporting period.'
from regulatory_sources where title='Battery Waste Management Rules, 2022 and amendments'
and not exists (select 1 from regulatory_requirements where code='BATTERY-EPR-TARGETS-RETURNS');

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'TYRE-EPR-REGISTRATION','TYRE_PRODUCER_RECYCLER_RETREADER','REGISTRATION','Maintain CPCB registration before carrying out regulated producer, recycler or retreader activity.','["legal_entity","registration_reference","authorization"]'::jsonb,'ON_EVENT','CPCB Waste Tyre EPR Portal','https://eprtyres.cpcb.gov.in/','Statutory registration and certificate workflows remain external.'
from regulatory_sources where title='Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016 - Waste Tyre EPR'
and not exists (select 1 from regulatory_requirements where code='TYRE-EPR-REGISTRATION');

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'TYRE-EPR-CERTIFICATE','TYRE_PRODUCER_RECYCLER_RETREADER','EPR','Track recycling/retreading evidence and statutory EPR certificate references for producer fulfilment.','["verified_processing","invoice_reference","certificate_reference","return_reference"]'::jsonb,'ANNUAL_OR_AS_NOTIFIED','CPCB Waste Tyre EPR Portal','https://eprtyres.cpcb.gov.in/','Only registered entities and certificates accepted by CPCB count for statutory fulfilment.'
from regulatory_sources where title='Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016 - Waste Tyre EPR'
and not exists (select 1 from regulatory_requirements where code='TYRE-EPR-CERTIFICATE');

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'CDW-REGISTRATION','CDW_PRODUCER_RECYCLER_COLLECTION_STORAGE','REGISTRATION','Track applicable registration and authorization for C&D waste participants.','["legal_entity","registration_reference","authorization"]'::jsonb,'ON_EVENT','CPCB C&D Waste Management System','https://cdwm.cpcb.gov.in/','Applicability depends on the notified Rules and entity/activity profile.'
from regulatory_sources where title='Environment (Construction and Demolition) Waste Management Rules, 2025'
and not exists (select 1 from regulatory_requirements where code='CDW-REGISTRATION');

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'CDW-EPR-UTILISATION','CDW_PRODUCER_RECYCLER_ROAD_PROJECT','EPR','Track processed C&D quantities, EPR certificates and utilization submissions.','["verified_processing","quantity_measurement","certificate_reference","utilisation_reference"]'::jsonb,'MONTHLY_OR_AS_NOTIFIED','CPCB C&D Waste Management System','https://cdwm.cpcb.gov.in/','Processed material must be linked to registered recyclers and accepted portal records where required.'
from regulatory_sources where title='Environment (Construction and Demolition) Waste Management Rules, 2025'
and not exists (select 1 from regulatory_requirements where code='CDW-EPR-UTILISATION');

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'BRSR-REPORTING','LISTED_ENTITY','ESG_REPORTING','Maintain traceable ESG metrics and disclosures for applicable BRSR reporting.','["source_activity","measurement","evidence","verification","methodology","approval"]'::jsonb,'ANNUAL','SEBI','https://www.sebi.gov.in/sebi_data/attachdocs/may-2021/1620655793598.pdf','RupayKG is a data/provenance system, not the statutory filing authority.'
from regulatory_sources where title='BRSR - Business Responsibility and Sustainability Reporting'
and not exists (select 1 from regulatory_requirements where code='BRSR-REPORTING');

insert into regulatory_requirements (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'BRSR-CORE-ASSURANCE','LISTED_ENTITY_ASSURANCE_PROVIDER','ESG_ASSURANCE','Track BRSR Core metrics, methodology, evidence lineage and independent assurance state for applicable entities.','["metric_definition","source_data","evidence","methodology","assurance_decision","assurance_provider"]'::jsonb,'ANNUAL','SEBI','https://www.sebi.gov.in/legal/circulars/jul-2023/brsr-core-framework-for-assurance-and-esg-disclosures-for-value-chain_73854.html','Applicability and assurance scope follow the applicable SEBI framework.'
from regulatory_sources where title='BRSR Core - Framework for assurance and ESG disclosures for value chain'
and not exists (select 1 from regulatory_requirements where code='BRSR-CORE-ASSURANCE');

-- The catalog itself is never proof of compliance. Satisfaction requires
-- applicable authoritative records, evidence, verification and, where required,
-- an external authority reference/acceptance.
