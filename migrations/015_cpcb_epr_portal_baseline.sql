-- Current CPCB operational source baseline for Plastic EPR.
-- This records the authoritative portal transition without treating the portal itself as a substitute for the underlying rules/guidelines.

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
values
('Central Pollution Control Board','Common EPR Portal — Plastic Waste EPR','CIRCULAR','Portal transition effective 2026-06-28','2026-06-28','2026-06-28','India','https://epr.cpcb.gov.in','2026-09-10','IN_FORCE','compliance','Current operational CPCB portal for Plastic EPR workflows. The legacy eprplastic.cpcb.gov.in portal was discontinued effective 2026-06-28; migrated users are directed to the Common EPR Portal. Do not treat portal availability as proof of legal compliance or as authorization to synthesize certificates, credits, registrations or returns.'),
('Central Pollution Control Board','Legacy Plastic EPR Portal — discontinued','CIRCULAR','Discontinued effective 2026-06-28','2026-06-28','2026-06-28','India','https://eprplastic.cpcb.gov.in','2026-09-10','SUPERSEDED','compliance','Historical/reference source only. The legacy portal states that registered-unit data was migrated to the Common EPR Portal and directs current updates and notifications to epr.cpcb.gov.in.');
