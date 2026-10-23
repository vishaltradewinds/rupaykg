-- Rule 11-13 evidence controls for RDF/SCF fuel substitution and conditional hill/island applicability.
-- These rows track evidence; they do not decide statutory applicability, issue permits, or submit portal returns.
insert into regulatory_requirements
  (regulatory_source_id,code,stakeholder_class,requirement_type,obligation,evidence_requirements,reporting_frequency,external_system,external_url,notes)
select s.id,v.code,v.stakeholder_class,v.requirement_type,v.obligation,v.evidence_requirements::jsonb,
       v.reporting_frequency,v.external_system,v.external_url,v.notes
from regulatory_sources s
join (values
  (
    'SWM-2026-RDF-SCF-INDUSTRIAL-FUEL-RETURN',
    'INDUSTRIAL_UNIT_USING_SOLID_FUEL',
    'RDF_SCF_FUEL_SUBSTITUTION_AND_REPORTING',
    'Track whether an industrial unit using solid fuel falls within Rule 11 distance and fuel-category criteria; record applicable RDF/segregated combustible fraction/agri-residue substitution milestones, SPCB registration and annual return evidence.',
    '["facility_geolocation","nearest_qualifying_rdf_facility_reference","distance_calculation_method","fuel_type_and_annual_intake","rdf_scf_agri_residue_quantity","calorific_value_test_report","spcb_registration_reference","annual_return_filed_at","annual_return_receipt_reference"]',
    'ANNUAL_BY_JUNE_30_AND_MILESTONE_TRACKING',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 11(1)-(2) of S.O. 388(E). Do not infer applicability from straight-line distance alone; preserve the rule category, distance methodology, approved standards and source evidence. Fuel-substitution milestones are tied to the Rules effective date: at least 6% initially, 10% after 3 years, and 15% after 6 years for the table category to which they apply.'
  ),
  (
    'SWM-2026-RDF-QUALITY-AVAILABILITY-OFFTAKE',
    'RDF_OR_MRF_CUM_RDF_FACILITY',
    'RDF_QUALITY_AND_OFFTAKE_REPORTING',
    'Track monthly registration/reporting of RDF or segregated combustible fraction availability with quality evidence, and real-time availability/offtake reporting by RDF plants; retain destination and calorific-value evidence for supplied material.',
    '["facility_registration_reference","reporting_month","rdf_or_scf_grade","available_quantity","quality_test_report_hash","calorific_value_kcal_per_kg","offtake_timestamp","offtaker_registration_reference","quantity_offtaken","portal_submission_reference"]',
    'MONTHLY_QUALITY_AND_REAL_TIME_AVAILABILITY_OFFTAKE',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 11(3)-(6) of S.O. 388(E). The 1500 kcal/kg threshold for supply to waste-to-energy plants and 3000 kcal/kg threshold for cement plants must be checked against the applicable supply category; internal evidence is not proof of portal filing or regulatory acceptance.'
  ),
  (
    'SWM-2026-HILL-ISLAND-LOCAL-BODY-CONTROLS',
    'HILL_OR_ISLAND_LOCAL_BODY',
    'CONDITIONAL_GEOGRAPHY_WASTE_MANAGEMENT',
    'For a verified hilly or island jurisdiction, track the applicable local-body controls for residual-waste transfer and disposal planning, decentralised processing, designated collection points, tourist communication and any locally adopted waste-management charges.',
    '["jurisdiction_id","official_hill_or_island_classification_source","classification_effective_date","transfer_station_reference","residual_waste_destination_and_distance","regional_landfill_feasibility_evidence","decentralised_processing_inventory","designated_collection_point_inventory","tourist_information_evidence","local_bye_law_or_fee_authority_reference"]',
    'CONDITIONAL_ON_VERIFIED_HILL_OR_ISLAND_JURISDICTION',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 12 of S.O. 388(E). Apply only when jurisdiction classification and the relevant sub-rule are evidenced; do not infer island/hill status from a place name or automatically apply these controls nationwide.'
  ),
  (
    'SWM-2026-HIGH-CALORIFIC-WASTE-DIVERSION',
    'LOCAL_BODY_OR_WASTE_PROCESSING_FACILITY',
    'HIGH_CALORIFIC_WASTE_DESTINATION_CONTROL',
    'Track characterization and authorized destination of non-recyclable waste with calorific value at or above 1500 kcal/kg, including evidence that it is routed to energy recovery or RDF preparation rather than landfill, subject to applicable Rule 13 conditions and standards.',
    '["waste_batch_id","waste_stream_classification","sampling_and_test_date","calorific_value_kcal_per_kg","laboratory_or_method_reference","quantity_kg","authorized_destination_reference","rdf_or_energy_recovery_receipt","exception_or_authority_direction_reference"]',
    'PER_BATCH_OR_SHIPMENT',
    'CPCB Centralised Solid Waste Management Portal',
    'https://swmp.cpcb.gov.in/en/',
    'Rule 13(1)-(3) of S.O. 388(E). Do not divert based only on an unverified sensor/model estimate; preserve test method, custody and destination evidence, and keep separate authorization requirements for waste-to-energy facilities.'
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
