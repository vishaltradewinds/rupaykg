-- Extend the production regulatory catalog from the currently verified
-- Government of India baseline. Applicability is evaluated dynamically by
-- organization/stakeholder context; these records do not themselves assert
-- that an organization is obligated.

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
values
('Ministry of Environment, Forest and Climate Change','E-Waste (Management) Rules, 2022','RULE','G.S.R. 801(E)','2022-11-02','2023-04-01','India','https://moef.gov.in/uploads/2022/11/E-Waste-Management-Rules-2022.pdf','2026-09-12','IN_FORCE','epr','Applies to the manufacturers, producers, refurbishers, dismantlers and recyclers within the notified scope; RupayKG must not infer producer EPR status from BWG status alone.'),
('Ministry of Environment, Forest and Climate Change','Battery Waste Management Rules, 2022','RULE','S.O. 3984(E)','2022-08-22','2022-08-22','India','https://moef.gov.in/rules-regulations-3','2026-09-12','IN_FORCE','epr','EPR regime for waste batteries; eligibility, registration, targets and certificate activity must be based on the applicable rule and authoritative CPCB/competent-authority state.'),
('Ministry of Environment, Forest and Climate Change','Plastic Waste Management Rules, 2016 and amendments','RULE','G.S.R. 320(E)','2016-03-18','2016-03-18','India','https://moef.gov.in/rules-regulations-3','2026-09-12','IN_FORCE','epr','Plastic packaging EPR is role-specific; CPCB Common EPR Portal is the authoritative operational portal for current portal activity. Do not treat every waste generator as a PIBO/PWP.'),
('Ministry of Environment, Forest and Climate Change','Environment Protection (End-of-Life Vehicles) Rules, 2025','RULE','S.O. 98(E)','2025-01-06','2025-04-01','India','https://moef.gov.in/rules-regulations-3','2026-09-12','IN_FORCE','epr','EPR and end-of-life vehicle obligations apply only to entities within the notified definitions and scope; portal/registration status must remain evidence-backed.'),
('Securities and Exchange Board of India','Master Circular for compliance with LODR Regulations, 2015 by listed entities','CIRCULAR','HO/49/14/14(7)2025-CFD-POD2/I/3762/2026','2026-01-30','2026-01-30','India','https://www.sebi.gov.in/web/?file=https%3A%2F%2Fwww.sebi.gov.in%2Fsebi_data%2Fattachdocs%2Fjan-2026%2F1769776024792.pdf','2026-09-12','IN_FORCE','esg','Use for listed-entity disclosure applicability. BRSR/BRSR Core applicability, assessment/assurance and value-chain requirements must be evaluated from the current SEBI requirements rather than inferred for every organization.'),
('Central Pollution Control Board','Common EPR Portal','GUIDELINE',null,'2026-06-28','2026-06-28','India','https://epr.cpcb.gov.in/','2026-09-12','IN_FORCE','epr','CPCB operational portal for current EPR workflows. Legacy plastic portal operations were discontinued from 28 June 2026 and migrated to the Common EPR Portal; RupayKG must distinguish portal migration/registration state from legal obligation state.')
on conflict (authority,title,reference) do update set
  source_url=excluded.source_url,
  verified_on=excluded.verified_on,
  status=excluded.status,
  affected_module=excluded.affected_module,
  notes=excluded.notes;
