-- Store the official portal's facility subtype separately from the broad Waste Facility role.
alter table cpcb_swm_stakeholder_workspaces
  add column if not exists facility_type text;

alter table cpcb_swm_stakeholder_workspaces
  drop constraint if exists cpcb_swm_facility_type_check;

alter table cpcb_swm_stakeholder_workspaces
  add constraint cpcb_swm_facility_type_check
  check (facility_type is null or facility_type in (
    'RDF', 'MRF', 'MRF_CUM_RDF', 'CBG_BIOGAS', 'COMPOST',
    'WASTE_TO_ENERGY', 'INTEGRATED_SWM', 'CO_PROCESSING',
    'COMMON_BIOMEDICAL_WASTE', 'SANITARY_LANDFILL',
    'WASTE_COLLECTION_AGENCY', 'INCINERATOR'
  ));
