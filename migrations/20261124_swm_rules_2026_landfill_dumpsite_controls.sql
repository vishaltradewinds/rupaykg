-- Rules 14-15 landfill operations and legacy-dumpsite controls.
-- Evidence tracker only: it does not authorize disposal, validate environmental safety, or submit official returns.
insert into regulatory_requirements
  (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select s.id,v.code,v.stakeholder_class,v.requirement_type,v.obligation,v.evidence_requirements::jsonb,
       v.reporting_frequency,v.external_system,v.external_url,v.notes
from regulatory_sources s
join (values
  (
    'SWM-2026-SANITARY-LANDFILL-REGISTRATION-ANNUAL-RETURN',
    'SANITARY_LANDFILL_OPERATOR',
    'REGISTRATION_AND_ANNUAL_RETURN',
    'Track sanitary landfill portal registration, annual return for waste deposited, quarterly operational reports to the District Magistrate and central portal, and applicable authorization evidence.',
    '["facility_registration_reference","authorization_reference","financial_year","waste_deposited_by_stream_and_quantity","annual_return_receipt_reference","quarterly_report_periods","district_magistrate_submission_reference","portal_submission_reference"]',
    'QUARTERLY_OPERATIONS_AND_ANNUAL_RETURN_BY_JUNE_30',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 14(8)-(10) of S.O. 388(E). Internal records do not substitute for portal filing or District Magistrate submission; retain the external acknowledgement for each reporting period.'
  ),
  (
    'SWM-2026-SANITARY-LANDFILL-AUDIT',
    'STATE_POLLUTION_CONTROL_BOARD_OR_POLLUTION_CONTROL_COMMITTEE',
    'SANITARY_LANDFILL_AUDIT',
    'Track the annual audit of sanitary landfill operation and evidence that the competent SPCB/PCC uploads the financial-year audit report by 31 December of the next financial year.',
    '["landfill_registration_reference","financial_year_audited","auditor_authorization_or_registration","audit_report_hash","spcb_pcc_upload_reference","local_body_site_reference"]',
    'ANNUAL_AUDIT_REPORT_BY_31_DECEMBER_OF_NEXT_FINANCIAL_YEAR',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 14(7) of S.O. 388(E). Evidence tracking only; do not infer an audit passed from the presence of a report file.'
  ),
  (
    'SWM-2026-DUMPSITE-GEO-MAPPING-DEADLINE',
    'URBAN_OR_RURAL_LOCAL_BODY',
    'DUMPSITE_INVENTORY_AND_GEO_MAPPING',
    'Track geographic mapping and assessment of existing solid-waste dumpsites and garbage-vulnerable points, with publication evidence on the central portal and local-body website by 31 October 2026.',
    '["jurisdiction_id","dumpsite_or_vulnerable_point_id","latitude","longitude","coordinate_reference_system","survey_timestamp","assessment_record_hash","central_portal_publication_reference","local_body_website_publication_reference"]',
    'INITIAL_DEADLINE_2026_10_31_THEN_MAINTAINED_INVENTORY',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 15(1) of S.O. 388(E). Location records require provenance and validation; coordinates alone are not proof that all sites were surveyed or officially published.'
  ),
  (
    'SWM-2026-LEGACY-DUMPSITE-ANNUAL-AUDIT',
    'STATE_POLLUTION_CONTROL_BOARD_OR_POLLUTION_CONTROL_COMMITTEE',
    'LEGACY_DUMPSITE_ANNUAL_AUDIT',
    'Track the annual audit of progress in biomining/bioremediation or closure of existing dumpsites and evidence of publication on the central portal and local-body website by 31 December of the next financial year.',
    '["dumpsite_id","financial_year_audited","authorized_auditor_reference","progress_measurement_basis","audit_report_hash","central_portal_upload_reference","local_body_website_publication_reference"]',
    'ANNUAL_AUDIT_REPORT_BY_31_DECEMBER_OF_NEXT_FINANCIAL_YEAR',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 15(10) of S.O. 388(E). Preserve audit scope, measurements and publication receipts; platform status is not an independent statutory audit opinion.'
  ),
  (
    'SWM-2026-LEGACY-DUMPSITE-FRACTION-DESTINATION',
    'URBAN_OR_RURAL_LOCAL_BODY',
    'LEGACY_WASTE_FRACTION_CUSTODY_AND_SAFETY',
    'Track characterization, destination and safety-test evidence for fractions recovered from legacy-waste biomining/bioremediation, including leachate, fine soil, RDF and construction-and-demolition fractions; record controls against fresh-waste dumping at active remediation sites.',
    '["dumpsite_id","biomining_batch_id","fraction_type","quantity","sampling_and_test_report_hash","destination_facility_reference","destination_receipt","leachate_treatment_evidence","fresh_waste_exclusion_check","authorized_third_party_reference"]',
    'PER_BATCH_AND_CONTINUOUS_SITE_CONTROL',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 15(4)-(8) of S.O. 388(E) and Schedule IV where relevant. Do not treat a destination declaration or sensor estimate as proof of safe reuse or lawful disposal; keep chain-of-custody and laboratory evidence.'
  )
) as v(code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes) on true
where s.title='Solid Waste Management Rules, 2026' and s.reference='S.O. 388(E)'
on conflict (code) do update set
  obligation=excluded.obligation,
  evidence_requirements=excluded.evidence_requirements,
  reporting_frequency=excluded.reporting_frequency,
  external_system=excluded.external_system,
  external_url=excluded.external_url,
  notes=excluded.notes;
