-- Extend the authoritative India regulatory catalog with current
-- construction/demolition and greenhouse-gas compliance instruments.
-- These records identify the legal framework only; organization-level
-- applicability and external registration/issuance state remain evidence-backed.

insert into regulatory_sources
(authority,title,instrument,reference,published_on,effective_from,jurisdiction,source_url,verified_on,status,affected_module,notes)
values
('Ministry of Environment, Forest and Climate Change','Environment (Construction and Demolition) Waste Management Rules, 2025','RULE','G.S.R. 219(E)','2025-04-02','2026-04-01','India','https://www.moef.gov.in/storage/tender/1770036325.pdf','2026-09-12','IN_FORCE','epr','Supersedes the Construction and Demolition Waste Management Rules, 2016. Applies to construction, demolition, remodelling, renovation and repair activities within the notified scope; RupayKG must evaluate applicability and EPR duties from entity/activity facts and authoritative portal state.'),
('Ministry of Environment, Forest and Climate Change','Greenhouse Gases Emission Intensity Target Rules, 2025','RULE','G.S.R. 739(E)','2025-10-08','2025-10-08','India','https://www.moef.gov.in/storage/tender/1770036260.pdf','2026-09-12','IN_FORCE','carbon','Defines greenhouse-gas emission-intensity targets and compliance responsibilities for notified obligated entities under the Carbon Credit Trading Scheme; RupayKG must not infer obligated-entity status or carbon-credit issuance from waste activity alone.'),
('Ministry of Environment, Forest and Climate Change','Greenhouse Gases Emission Intensity Target (Amendment) Rules, 2025','RULE','G.S.R. 25(E)','2026-01-13','2026-01-13','India','https://www.moef.gov.in/storage/tender/1770036325.pdf','2026-09-12','IN_FORCE','carbon','Amends the GEI target framework and adds notified sector targets. Target trajectories and obligated-entity scope must be evaluated from the current notified schedules and competent-authority data rather than hard-coded assumptions.'),
('Ministry of Environment, Forest and Climate Change','Carbon Credit Trading Scheme, 2023','NOTIFICATION','S.O. 2825(E)','2023-06-28','2023-06-28','India','https://moef.gov.in/orders/update?archive=1','2026-09-12','IN_FORCE','carbon','Indian Carbon Market framework. RupayKG may calculate and maintain auditable pre-issuance value records, but external carbon-credit issuance, registry status and transfer must remain authority-backed and must not be inferred from local calculations.')
on conflict (authority,title,reference) do update set
  source_url=excluded.source_url,
  verified_on=excluded.verified_on,
  status=excluded.status,
  affected_module=excluded.affected_module,
  notes=excluded.notes;
