-- Rule 16 of the Solid Waste Management Rules, 2026 requires CPCB to establish
-- and operate the centralised online registration/annual-return system within
-- six months of commencement (1 April 2026). The official portal landing page is
-- verified; live workflows and authorized integration access remain a separate gate.
insert into regulatory_requirements
  (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select s.id,
       'SWM-2026-CPCB-CENTRAL-PORTAL-LAUNCH',
       'CENTRAL_POLLUTION_CONTROL_BOARD',
       'SYSTEM_AVAILABILITY_AND_REGISTRATION',
       'Verify and preserve evidence that the centralised online system for registration and annual returns of obligated entities and local bodies is live and supports the required SWM Rules 2026 workflows. Rule 16 sets a six-month establishment window from commencement on 1 April 2026 (deadline 1 October 2026).',
       '["official_CPCB_or_MoEFCC_announcement","official_production_portal_URL","portal_terms_and_authorized_access_process","registration_workflow_evidence","annual_return_workflow_evidence","role_and_stakeholder_module_evidence","verification_timestamp","verifier_identity"]'::jsonb,
       'ONE_TIME_WITH_CONTINUOUS_ASSURANCE',
       'CPCB Centralised Solid Waste Management Portal',
       'https://www.swm.cpcb.gov.in/',
       'Official CPCB portal landing page verified on 23 October 2026. Production workflow behavior, applicable portal terms, and authorized integration/API access have not been independently verified for RupayKG. Do not infer that public portal availability grants API access; keep automated external integration blocked until workflow evidence and authorization are verified.'
from regulatory_sources s
where s.authority = 'Ministry of Environment, Forest and Climate Change'
  and s.title = 'Solid Waste Management Rules, 2026'
  and s.reference = 'S.O. 388(E)'
on conflict (code) do update set
  regulatory_source_id = excluded.regulatory_source_id,
  stakeholder_class = excluded.stakeholder_class,
  requirement_type = excluded.requirement_type,
  obligation = excluded.obligation,
  evidence_requirements = excluded.evidence_requirements,
  reporting_frequency = excluded.reporting_frequency,
  external_system = excluded.external_system,
  external_url = excluded.external_url,
  status = excluded.status,
  notes = excluded.notes;
