-- Rules 39 and 41 competent-authority inventory, geo-tagging and authorization oversight.
-- This records public-authority evidence and does not grant authority or establish statutory compliance.
insert into regulatory_requirements
  (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select s.id,v.code,v.stakeholder_class,v.requirement_type,v.obligation,v.evidence_requirements::jsonb,
       v.reporting_frequency,v.external_system,v.external_url,v.notes
from regulatory_sources s
join (values
  (
    'SWM-2026-SPCB-ANNUAL-FACILITY-INVENTORY',
    'STATE_POLLUTION_CONTROL_BOARD_OR_POLLUTION_CONTROL_COMMITTEE',
    'FACILITY_INVENTORY_PUBLICATION',
    'Track the annual inventory of registered biomethanation plants, waste-to-energy plants, sanitary landfills and solid-waste processing facilities, including publication to the central portal by 30 June each year.',
    '["state_or_ut_scope","inventory_financial_year","facility_type","facility_registration_reference","authorization_status_and_expiry","geolocation_source","central_portal_publication_reference","publication_timestamp"]',
    'ANNUAL_BY_JUNE_30',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 39(13) of S.O. 388(E). Track the competent authority publication; do not present RupayKg records as the official complete inventory.'
  ),
  (
    'SWM-2026-SPCB-GEOTAGGED-INFRASTRUCTURE',
    'STATE_POLLUTION_CONTROL_BOARD_OR_POLLUTION_CONTROL_COMMITTEE',
    'GEOTAGGED_INFRASTRUCTURE_ASSURANCE',
    'Track evidence that solid-waste infrastructure and processing facilities are geo-tagged by the competent SPCB/PCC, with source, coordinate reference system, validation and portal publication evidence.',
    '["facility_registration_reference","facility_type","latitude","longitude","coordinate_reference_system","geotag_source","validation_timestamp","authority_review_reference","portal_publication_reference"]',
    'ON_REGISTRATION_AND_CHANGE_WITH_PERIODIC_RECONCILIATION',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 41(1)(xiv) and Rule 41(8) of S.O. 388(E). Coordinates are sensitive operational data in some contexts; apply tenant/geography authorization and minimize public disclosure. Geo-tagging evidence does not itself establish authorization.'
  ),
  (
    'SWM-2026-SPCB-AUTHORIZATION-REGISTER',
    'STATE_POLLUTION_CONTROL_BOARD_OR_POLLUTION_CONTROL_COMMITTEE',
    'FACILITY_AUTHORIZATION_LIFECYCLE',
    'Track facility registration and authorization decisions, linked consents and environmental-clearance evidence where applicable, validity/renewal, suspension or cancellation, and the district-wise/local-authority-wise portal information due by 30 June annually.',
    '["facility_registration_reference","form_i_application_reference","authorization_number","authorization_issued_at","validity_start_and_end","linked_consent_references","environmental_clearance_reference_if_applicable","renewal_or_suspension_decision","district_and_local_authority_scope","portal_publication_reference"]',
    'ON_DECISION_AND_ANNUAL_PORTAL_UPDATE_BY_JUNE_30',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 41(1)(iii)-(viii) and Rule 41(1)(xiv) of S.O. 388(E). Only the competent SPCB/PCC can issue, renew, suspend or cancel authorization; RupayKg records evidence and never fabricates an authorization decision.'
  ),
  (
    'SWM-2026-SPCB-ANNUAL-INSPECTION-AND-EMISSIONS-AUDIT',
    'STATE_POLLUTION_CONTROL_BOARD_OR_POLLUTION_CONTROL_COMMITTEE',
    'FACILITY_INSPECTION_AND_EMISSIONS_ASSURANCE',
    'Track evidence of at-least-annual monitoring of authorized facility standards and annual audits of processing/treatment facility emissions and discharge compliance, including the inspection/audit basis and any corrective-action closure evidence.',
    '["facility_registration_reference","authorization_conditions_version","inspection_date","inspecting_authority_or_auditor_reference","emissions_and_discharge_test_report_hashes","findings","corrective_action_owner_and_due_date","closure_evidence","portal_or_authority_record_reference"]',
    'AT_LEAST_ANNUAL_AND_AS_DIRECTED_BY_COMPETENT_AUTHORITY',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 41(1)(xi) and Rule 41(1)(xxi) of S.O. 388(E). An internal checklist or uploaded report is not proof of a passed inspection, audit, or regulator acceptance.'
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
