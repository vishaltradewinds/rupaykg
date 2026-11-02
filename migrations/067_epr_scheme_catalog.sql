-- Scheme-specific Indian EPR catalog.
-- RupayKG records applicability and external references; it does not issue CPCB registrations/certificates.

insert into epr_schemes (code,name,authority,status,metadata)
values
  ('PLASTIC_PACKAGING','Plastic Packaging EPR','CPCB','VERIFIED',jsonb_build_object(
    'rule_reference','Plastic Waste Management Rules, 2016 and amendments; EPR Guidelines for Plastic Packaging',
    'portal_url','https://eprplastic.cpcb.gov.in/',
    'stakeholder_types',jsonb_build_array('PRODUCER','IMPORTER','BRAND_OWNER','PLASTIC_WASTE_PROCESSOR'),
    'registration_required',true,
    'return_cycle','as_notified',
    'certificate_enabled',true,
    'external_authority','CPCB'
  )),
  ('E_WASTE','E-Waste EPR','CPCB','VERIFIED',jsonb_build_object(
    'rule_reference','E-Waste (Management) Rules, 2022 and amendments',
    'portal_url','https://eprewaste.cpcb.gov.in/',
    'stakeholder_types',jsonb_build_array('PRODUCER','MANUFACTURER','REFURBISHER','RECYCLER'),
    'registration_required',true,
    'return_cycle','quarterly_and_annual',
    'certificate_enabled',true,
    'external_authority','CPCB'
  )),
  ('BATTERY','Battery Waste EPR','CPCB','VERIFIED',jsonb_build_object(
    'rule_reference','Battery Waste Management Rules, 2022 and amendments',
    'portal_url','https://eprbattery.cpcb.gov.in/',
    'stakeholder_types',jsonb_build_array('PRODUCER','RECYCLER','REFURBISHER'),
    'registration_required',true,
    'return_cycle','annual_and_as_notified',
    'certificate_enabled',true,
    'external_authority','CPCB'
  )),
  ('WASTE_TYRE','Waste Tyre EPR','CPCB','VERIFIED',jsonb_build_object(
    'rule_reference','Hazardous and Other Wastes (Management & Transboundary Movement) Amendment Rules, 2022, Schedule IX',
    'portal_url','https://eprtyres.cpcb.gov.in/',
    'stakeholder_types',jsonb_build_array('PRODUCER','RECYCLER','RETREADER'),
    'registration_required',true,
    'return_cycle','annual_and_quarterly',
    'certificate_enabled',true,
    'external_authority','CPCB'
  )),
  ('C_AND_D','Construction & Demolition Waste EPR','CPCB','VERIFIED',jsonb_build_object(
    'rule_reference','Environment (Construction and Demolition) Waste Management Rules, 2025',
    'portal_url','https://cdwm.cpcb.gov.in/',
    'stakeholder_types',jsonb_build_array('PRODUCER','RECYCLER','COLLECTION_POINT','INTERMEDIATE_STORAGE','ROAD_CONSTRUCTION_PROJECT'),
    'registration_required',true,
    'return_cycle','monthly_and_as_notified',
    'certificate_enabled',true,
    'external_authority','CPCB'
  ))
on conflict (code) do update set
  name=excluded.name,
  authority=excluded.authority,
  status=excluded.status,
  metadata=excluded.metadata;

create index if not exists epr_schemes_status_idx on epr_schemes(status);
