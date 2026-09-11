-- Additional in-force Indian environmental regimes that intersect RupayKG's
-- resource-flow, EPR and reporting lifecycle.

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
select 'Ministry of Environment, Forest and Climate Change','Hazardous and Other Wastes (Management and Transboundary Movement) Second Amendment Rules, 2023 - Used Oil EPR','RULE','G.S.R. 677(E)','2023-09-18','2024-04-01','India','https://moef.gov.in/uploads/2023/11/HSM-Amenment-Notification-daterd-18092023.pdf','2026-09-11','IN_FORCE','compliance','Chapter VII establishes EPR for Used Oil; the regime includes producers, importers, bulk generators, collection agents and registered recyclers.')
where not exists (select 1 from regulatory_sources where title='Hazardous and Other Wastes (Management and Transboundary Movement) Second Amendment Rules, 2023 - Used Oil EPR');

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
select 'Ministry of Environment, Forest and Climate Change','Environment Protection (End-of-Life Vehicles) Rules, 2025','RULE','S.O. 98(E)','2025-01-06','2025-04-01','India','https://moef.gov.in/storage/tender/1736422173.pdf','2026-09-11','IN_FORCE','compliance','Applies to the covered vehicle lifecycle and excludes waste streams already governed by separate EPR regimes; current amendments must be tracked separately.')
where not exists (select 1 from regulatory_sources where title='Environment Protection (End-of-Life Vehicles) Rules, 2025');

insert into regulatory_requirements
(regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'USED-OIL-EPR','BASE_OIL_PRODUCER_LUBRICATION_PRODUCER_IMPORTER_BULK_GENERATOR_RECYCLER','EPR','Track used-oil generation, collection, authorized transport, registered recycling and applicable producer/importer EPR targets.', '["quantity_measurement","generator_reference","collection_reference","transport_reference","registered_recycler","verification","certificate_or_return_reference"]'::jsonb,'ANNUAL_OR_AS_NOTIFIED','CPCB Used Oil EPR Portal','https://eprusedoil.cpcb.gov.in/','Bulk generators include entities generating more than 100 metric tonnes of used oil per annum under the cited Chapter; statutory thresholds must be evaluated from the applicable rule version.')
from regulatory_sources where title='Hazardous and Other Wastes (Management and Transboundary Movement) Second Amendment Rules, 2023 - Used Oil EPR'
on conflict (code) do nothing;

insert into regulatory_requirements
(regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'ELV-PRODUCER-REGISTRATION','VEHICLE_PRODUCER_REGISTERED_OWNER_BULK_CONSUMER_SCRAPPING_FACILITY_COLLECTION_TESTING','REGISTRATION','Track applicable registration, vehicle identity, dismantling/scrapping evidence and authorized facility references.', '["vehicle_identity","ownership_or_producer_reference","facility_registration","scrapping_evidence","measurement"]'::jsonb,'ON_EVENT','MoEFCC/CPCB ELV EPR system','https://moef.gov.in/rules-regulations-3','ELV obligations are distinct from battery, e-waste, tyre, used-oil and plastic EPR streams where those rules apply.')
from regulatory_sources where title='Environment Protection (End-of-Life Vehicles) Rules, 2025'
on conflict (code) do nothing;

insert into regulatory_requirements
(regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select id,'ELV-EPR-TRACKING','VEHICLE_PRODUCER_REGISTERED_OWNER_BULK_CONSUMER_SCRAPPING_FACILITY','EPR','Track end-of-life vehicle handover, dismantling/scrapping, material recovery and applicable EPR records.', '["vehicle_identity","handover_reference","weight_measurement","material_recovery","authorized_facility","return_reference"]'::jsonb,'ANNUAL_OR_AS_NOTIFIED','MoEFCC/CPCB ELV EPR system','https://moef.gov.in/rules-regulations-3','Do not duplicate obligations for waste categories already governed by their respective waste-management EPR rules.')
from regulatory_sources where title='Environment Protection (End-of-Life Vehicles) Rules, 2025'
on conflict (code) do nothing;
