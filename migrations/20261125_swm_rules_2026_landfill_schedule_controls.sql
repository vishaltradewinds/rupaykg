-- Rule 14 sanitary-landfill controls and Schedule I implementation deadlines.
-- This is a compliance evidence tracker, not an authorization or a substitute for competent-authority review.
insert into regulatory_requirements
  (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select s.id,v.code,v.stakeholder_class,v.requirement_type,v.obligation,v.evidence_requirements::jsonb,
       v.reporting_frequency,v.external_system,v.external_url,v.notes
from regulatory_sources s
join (values
  (
    'SWM-2026-SANITARY-LANDFILL-REGISTRATION-RETURNS',
    'SANITARY_LANDFILL_OPERATOR',
    'REGISTRATION_AND_OPERATIONAL_REPORTING',
    'Track portal registration, annual deposited-waste return due by 30 June, quarterly operational reports to the District Magistrate and central portal, and applicable authorization/audit evidence for each sanitary landfill.',
    '["landfill_id","portal_registration_reference","authorization_reference","reporting_financial_year","waste_deposited_by_stream_and_quantity","quarterly_report_period","district_magistrate_submission_receipt","portal_submission_receipt","annual_return_receipt","audit_report_reference"]',
    'QUARTERLY_OPERATION_REPORTS_AND_ANNUAL_RETURN_BY_JUNE_30',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 14(7)-(10) of S.O. 388(E). Audit-report deadline is 31 December of the next financial year; annual return deadline is 30 June each year. Evidence of an internal record is not proof of external submission.'
  ),
  (
    'SWM-2026-SANITARY-LANDFILL-WASTE-ACCEPTANCE',
    'URBAN_OR_RURAL_LOCAL_BODY_AND_SANITARY_LANDFILL_OPERATOR',
    'LANDFILL_WASTE_ACCEPTANCE_CONTROL',
    'Track each proposed landfill shipment against the Rule 14 permitted waste categories, measured quantity and destination; flag wet waste, construction-and-demolition waste, recyclable waste, energy-recoverable waste and other restricted streams for review under the rule and its provisos.',
    '["shipment_id","source_local_body_or_facility","waste_stream_classification","weighbridge_ticket_reference","quantity_kg","sampling_or_characterization_evidence","destination_landfill_id","acceptance_or_rejection_record","processing_linkage_reference","fee_assessment_reference"]',
    'PER_SHIPMENT',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 14(4)-(6) of S.O. 388(E). Do not automatically approve or reject a shipment without accounting for the rule provisos, processing-facility availability/linkage and competent-authority directions. This control is a review flag, not an operating permit.'
  ),
  (
    'SWM-2026-SCHEDULE-I-INFRASTRUCTURE-DEADLINES',
    'URBAN_OR_RURAL_LOCAL_BODY_AND_STATE_GOVERNMENT',
    'INFRASTRUCTURE_IMPLEMENTATION_TIMELINE',
    'Track applicable Schedule I implementation milestones for sanitary landfills, material recovery facilities and other infrastructure explicitly cross-referenced by the Rules, using verified population category, jurisdiction class and effective-date basis.',
    '["jurisdiction_id","jurisdiction_class","population_value","population_reference_and_year","urban_or_rural_classification_source","applicable_schedule_row","milestone_name","deadline_basis","calculated_due_date","progress_evidence","competent_authority_or_publication_reference"]',
    'MILESTONE_BASED_CONTINUOUS_ASSURANCE',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Schedule I to S.O. 388(E), read with Rule 14(3) and the listed local-body duties. From the 1 April 2026 commencement date, Schedule I specifies 18/24/36-month categories; derived dates are 1 October 2027, 1 April 2028 and 1 April 2029 respectively. Determine the exact row and covered infrastructure from the applicable rule; do not extrapolate across omitted or ambiguous population bands.'
  ),
  (
    'SWM-2026-LANDFILL-SITING-AND-ENVIRONMENTAL-SAFEGUARDS',
    'STATE_GOVERNMENT_LOCAL_BODY_AND_SANITARY_LANDFILL_OPERATOR',
    'LANDFILL_SITING_AND_ENVIRONMENTAL_EVIDENCE',
    'Track site-selection and operating evidence for sanitary landfills, including land-use planning, relevant exclusion/distances, buffer zone where applicable, construction/closure plans, weighbridge and incoming-waste inspection, leachate collection/treatment and groundwater monitoring.',
    '["land_parcel_id","land_use_plan_reference","site_selection_report","distance_and_exclusion_assessment","buffer_zone_assessment_if_applicable","construction_plan_reference","closure_plan_reference","weighbridge_calibration_and_ticket_reference","leachate_monitoring_and_treatment_records","groundwater_baseline_and_periodic_results","authority_clearance_references"]',
    'AT_SITE_APPROVAL_AND_CONTINUOUS_OPERATION',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 14 and Schedule II to S.O. 388(E). Preserve source measurements and applicable exception/NOC evidence. RupayKg must not infer site suitability or issue statutory clearances from map distance alone.'
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
