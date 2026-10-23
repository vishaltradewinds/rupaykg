-- Map the first operational duties from the official Solid Waste Management Rules,
-- 2026 (S.O. 388(E)) into evidence-tracking requirements. These are workflow
-- requirements, not statutory determinations or a substitute for the CPCB portal.
-- The official CPCB portal landing page has now been verified. Portal workflow behavior,
-- integration terms and authorized API access remain unverified; do not infer API access.
insert into regulatory_requirements
  (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select s.id,v.code,v.stakeholder_class,v.requirement_type,v.obligation,v.evidence_requirements::jsonb,
       v.reporting_frequency,v.external_system,v.external_url,v.notes
from regulatory_sources s
join (values
  (
    'SWM-2026-WASTE-GENERATOR-SEGREGATION',
    'WASTE_GENERATOR',
    'WASTE_HANDOVER',
    'Track segregation and authorized handover of wet, dry, sanitary and special-care waste; preserve evidence of local-body directions and applicable waste stream handling.',
    '["waste_stream","measured_quantity","handover_timestamp","authorized_collector_reference","evidence_reference"]',
    'PER_COLLECTION_OR_HANDOVER',
    'CPCB Centralised Solid Waste Management Portal',
    'https://www.swm.cpcb.gov.in/',
    'Rule 5 of S.O. 388(E). Applicability and any special category must be determined from the entity and current local-body directions; internal records are not official registration.'
  ),
  (
    'SWM-2026-BWG-REGISTRATION-EBWGR-RETURN',
    'BULK_WASTE_GENERATOR',
    'REGISTRATION_AND_REPORTING',
    'Track registration with the concerned local body, evidence for applicable waste-management arrangements and Extended Bulk Waste Generator Responsibility (EBWGR), including annual return due by 30 June. Record local-body exemptions and certificate references where relevant.',
    '["local_body_registration_reference","assessment_basis","waste_stream_quantities","processor_registration_reference","local_body_exemption_if_applicable","ebwgr_certificate_reference","annual_return_reference","evidence_reference"]',
    'ON_EVENT_AND_ANNUAL_BY_JUNE_30',
    'CPCB Centralised Solid Waste Management Portal',
    'https://www.swm.cpcb.gov.in/',
    'Rule 6 of S.O. 388(E). New and existing bulk waste generators have different wet-waste processing provisions; do not infer applicability or exemption from threshold measurements alone.'
  ),
  (
    'SWM-2026-WASTE-PROCESSOR-REGISTRATION-RETURNS',
    'SOLID_WASTE_PROCESSING_FACILITY',
    'REGISTRATION_AND_REPORTING',
    'Track required local-body portal registration and authorization, waste received and processed by stream, residuals and other prescribed data; quarterly returns are due by the 15th of the first month after each quarter and annual returns by 30 June.',
    '["registration_reference","authorization_reference","waste_received_by_stream","waste_processed_by_stream","residual_waste_destination","quarterly_return_reference","annual_return_reference","verification_evidence"]',
    'QUARTERLY_BY_15TH_PLUS_ANNUAL_BY_JUNE_30',
    'CPCB Centralised Solid Waste Management Portal',
    'https://www.swm.cpcb.gov.in/',
    'Rule 7 of S.O. 388(E). Facility scope, authorization and required schedules must be validated against the applicable rules and competent authority.'
  ),
  (
    'SWM-2026-LOCAL-BODY-PORTAL-REPORTING',
    'URBAN_OR_RURAL_LOCAL_BODY',
    'REGISTRATION_AND_REPORTING',
    'Track local-body or authorized concessionaire registration, waste handover to registered processors, validated collection/processing data and applicable quarterly and annual returns.',
    '["portal_registration_reference","authorized_concessionaire_reference","collection_quantity_by_stream","registered_processor_reference","return_reference","validation_decision","evidence_reference"]',
    'QUARTERLY_BY_15TH_PLUS_ANNUAL_BY_JUNE_30',
    'CPCB Centralised Solid Waste Management Portal',
    'https://www.swm.cpcb.gov.in/',
    'Rule 8 of S.O. 388(E). Reporting duties depend on the local-body/authorized-operator role; RupayKG must not represent an internal workflow as a portal filing.'
  ),
  (
    'SWM-2026-EBWGR-CERTIFICATE-ISSUANCE',
    'URBAN_OR_RURAL_LOCAL_BODY',
    'CERTIFICATE_ISSUANCE',
    'Track EBWGR certificate issuance as a local-body-controlled action only. For wet-waste certificates, require the registered and authorized processor report of quantities received and processed before recording the certificate as externally issued.',
    '["bulk_waste_generator_reference","waste_quantity_kg","registered_processor_reference","processor_received_processed_report","local_body_approval_reference","external_certificate_reference","portal_transaction_reference"]',
    'ON_VALIDATED_TRANSACTION',
    'CPCB Centralised Solid Waste Management Portal',
    'https://www.swm.cpcb.gov.in/',
    'Rules 8 and 10 of S.O. 388(E). Only the local body is mandated to generate EBWGR certificates on the centralised portal. RupayKG may record evidence and references but must not mint or assert official certificates without verified external issuance.'
  ),
  (
    'SWM-2026-MRF-QUARTERLY-REPORTING',
    'MATERIAL_RECOVERY_FACILITY',
    'REPORTING',
    'Track registration with the local body, quantity received and sorted, and channelization to registered processors or sanitary landfills; quarterly portal reporting is due by the 15th of the first month after each quarter.',
    '["local_body_registration_reference","quantity_received","quantity_sorted","registered_destination_reference","quarterly_report_reference","evidence_reference"]',
    'QUARTERLY_BY_15TH_OF_NEXT_QUARTER',
    'CPCB Centralised Solid Waste Management Portal',
    'https://www.swm.cpcb.gov.in/',
    'Rule 9 of S.O. 388(E). Keep waste-stream quantities and destination registrations traceable; internal evidence is not a statutory portal filing.'
  )
) as v(code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
  on true
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
