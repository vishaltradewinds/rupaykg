-- CPCB SWM portal role catalogue expansion.
-- Important: SPCB/PCC and DM accounts are officially onboarded; Regional Officers
-- are provisioned by authorized SPCB/PCC users; this is not public self-registration.
-- CPCB central accounts require explicit official provisioning.
alter table cpcb_swm_stakeholder_workspaces
  drop constraint if exists cpcb_swm_stakeholder_workspaces_stakeholder_type_check;

alter table cpcb_swm_stakeholder_workspaces
  add constraint cpcb_swm_stakeholder_workspaces_stakeholder_type_check
  check (stakeholder_type in (
    'BWG',
    'WASTE_FACILITY',
    'ULB',
    'DISTRICT_PANCHAYAT',
    'GRAM_PANCHAYAT',
    'COLLECTOR_TRANSPORTER',
    'PROCESSOR',
    'SPCB_PCC',
    'DISTRICT_MAGISTRATE',
    'REGIONAL_OFFICER',
    'CPCB_CENTRAL'
  ));
