-- Rules 35-38 state, rural, district and CPCB implementation-assurance controls.
-- These records track public-authority evidence; they do not decide whether a duty was met or file on an authority's behalf.
insert into regulatory_requirements
  (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select s.id,v.code,v.stakeholder_class,v.requirement_type,v.obligation,v.evidence_requirements::jsonb,
       v.reporting_frequency,v.external_system,v.external_url,v.notes
from regulatory_sources s
join (values
  (
    'SWM-2026-STATE-URBAN-SWM-POLICY',
    'STATE_OR_UT_URBAN_DEVELOPMENT_DEPARTMENT',
    'STATE_POLICY_AND_STRATEGY',
    'Track preparation and portal publication of the State/UT urban solid-waste policy and strategy in convergence with rural development, and its five-year review cycle.',
    '["state_or_ut_code","policy_document_hash","approval_or_notification_reference","gazette_notification_date_basis","portal_publication_reference","coverage_checklist","last_review_date","next_review_due_date"]',
    'INITIAL_WITHIN_ONE_YEAR_OF_RULES_NOTIFICATION_THEN_EVERY_FIVE_YEARS',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 35(1)(i) of S.O. 388(E). Preserve the applicable notification date and any competent-authority interpretation of the due date; a tracker entry is not proof that a policy was approved or published.'
  ),
  (
    'SWM-2026-STATE-LOCAL-BODY-INFRASTRUCTURE-PORTAL',
    'STATE_OR_UT_URBAN_DEVELOPMENT_DEPARTMENT',
    'LOCAL_BODY_INFRASTRUCTURE_ONBOARDING',
    'Track onboarding of local bodies and their solid-waste infrastructure/activity data on the central portal, including annual updates by 30 June.',
    '["state_or_ut_code","local_body_id","infrastructure_inventory_version","collection_sorting_transport_processing_disposal_fields","portal_submission_reference","submission_timestamp","annual_update_year","validation_evidence"]',
    'INITIAL_WITHIN_ONE_YEAR_OF_RULES_PUBLICATION_AND_ANNUAL_BY_JUNE_30',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 35(2)(viii) of S.O. 388(E). Do not mark a local body onboarded from a local RupayKg record; require official portal evidence and track each local body separately.'
  ),
  (
    'SWM-2026-STATE-WASTE-PICKER-REGISTRY',
    'STATE_OR_UT_URBAN_DEVELOPMENT_DEPARTMENT',
    'WASTE_PICKER_REGISTRATION_AND_PUBLICATION',
    'Track registration of waste pickers working with local authorities, authorized third parties, concessionaires or self-help groups, and annual portal publication.',
    '["state_or_ut_code","local_body_id","waste_picker_or_group_reference","consent_or_lawful_basis_reference","registration_reference","authorized_agency_reference","portal_upload_receipt","reporting_year"]',
    'ANNUAL_BY_JUNE_30',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 35(2)(xix) of S.O. 388(E). Minimize personal data; use scoped identifiers and evidence references. Do not expose individual waste-picker personal information on public dashboards.'
  ),
  (
    'SWM-2026-STATE-RURAL-SWM-POLICY',
    'STATE_OR_UT_RURAL_DEVELOPMENT_DEPARTMENT',
    'RURAL_STATE_POLICY_AND_STRATEGY',
    'Track the rural solid-waste policy and strategy, convergence with urban development, portal publication and five-year review cycle.',
    '["state_or_ut_code","policy_document_hash","approval_or_notification_reference","gazette_notification_date_basis","portal_publication_reference","peri_urban_coverage","waste_picker_integration_plan","last_review_date","next_review_due_date"]',
    'INITIAL_WITHIN_ONE_YEAR_OF_RULES_NOTIFICATION_THEN_EVERY_FIVE_YEARS',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 36(1) of S.O. 388(E). Applicability and timing must be confirmed against the official notification and competent authority; the record is an evidence tracker, not an approval.'
  ),
  (
    'SWM-2026-DISTRICT-QUARTERLY-SWM-REVIEW',
    'DISTRICT_MAGISTRATE_OR_COLLECTOR',
    'DISTRICT_REVIEW_AND_LAND_INVENTORY',
    'Track at-least-quarterly review of local-body waste segregation, collection, sorting, processing, treatment and disposal; preserve meeting minutes and corrective-action evidence. Also track the annual portal upload of land identified for facilities by 30 June.',
    '["district_code","review_period","meeting_date","participating_authorities","minutes_hash","corrective_action_register","local_body_portal_publication_reference","identified_land_inventory","land_portal_upload_receipt","annual_reporting_year"]',
    'QUARTERLY_REVIEW_AND_LAND_UPLOAD_BY_JUNE_30',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 37(i)-(ii) of S.O. 388(E). The tracker must not treat an internal meeting note as a portal publication or infer that corrective actions were completed without evidence.'
  ),
  (
    'SWM-2026-CPCB-ANNUAL-IMPLEMENTATION-REPORT',
    'CENTRAL_POLLUTION_CONTROL_BOARD',
    'NATIONAL_IMPLEMENTATION_REPORTING',
    'Track the annual national implementation report based on SPCB/PCC inputs, submission to MoEFCC and public-domain publication by 30 September each year.',
    '["reporting_year","spcb_pcc_input_inventory","input_receipt_references","compiled_report_hash","submission_to_moefcc_reference","publication_timestamp","official_publication_URL"]',
    'ANNUAL_BY_SEPTEMBER_30',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 38(1)(vi) of S.O. 388(E). Distinguish evidence of compilation, submission to MoEFCC and public publication; do not assume any stage from another.'
  ),
  (
    'SWM-2026-CPCB-SOLID-WASTE-ACTION-PLAN-PROFORMA',
    'CENTRAL_POLLUTION_CONTROL_BOARD',
    'ACTION_PLAN_PROFORMA_DEVELOPMENT',
    'Track development and portal publication of the Solid Waste Action Plan proforma for ULBs, District Panchayats and Gram Panchayats in consultation with the specified ministries/departments.',
    '["proforma_version","consultation_record_references","approval_or_adoption_reference","portal_publication_reference","publication_timestamp","official_document_hash"]',
    'ONE_TIME_WITHIN_SIX_MONTHS_OF_RULES_NOTIFICATION',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 38(1)(x) of S.O. 388(E). The six-month period is tied to notification in the Official Gazette; record the exact legal date basis and authoritative publication evidence instead of inferring completion or breach.'
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
