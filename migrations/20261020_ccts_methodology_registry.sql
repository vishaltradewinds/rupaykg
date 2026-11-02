-- CCTS methodology/tool registry snapshot; registry presence is not implementation or eligibility.
create table ccts_methodology_registry (
  code text primary key,
  item_kind text not null check (item_kind in ('METHODOLOGY','TOOL')),
  title text not null,
  sector text not null check (sector in ('ENERGY','INDUSTRIES','WASTE_HANDLING_AND_DISPOSAL','AGRICULTURE','FORESTRY','CROSS_SECTOR')),
  source_status text not null default 'APPROVED_ON_OFFICIAL_REGISTER'
    check (source_status in ('APPROVED_ON_OFFICIAL_REGISTER','DRAFT','SUPERSEDED','WITHDRAWN','UNRESOLVED')),
  implementation_status text not null default 'REGISTRY_ONLY'
    check (implementation_status in ('REGISTRY_ONLY','IN_ANALYSIS','IMPLEMENTED_UNVERIFIED','VALIDATED','SUSPENDED')),
  official_version text,
  source_url text not null,
  source_snapshot_date date not null,
  source_checked_date date not null,
  source_document_sha256 text,
  notes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ccts_methodology_registry_kind_sector_idx
  on ccts_methodology_registry(item_kind, sector, code);

insert into ccts_methodology_registry
  (code, item_kind, title, sector, source_url, source_snapshot_date, source_checked_date, notes)
values
  ('BM EN01.001','METHODOLOGY','Grid-connected electricity generation from renewable sources','ENERGY','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM EN01.002','METHODOLOGY','Hydrogen production from electrolysis of water','ENERGY','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM IN02.001','METHODOLOGY','Energy efficiency and fuel switching measures for industrial facilities','INDUSTRIES','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM IN02.002','METHODOLOGY','Hydrogen production using methane extracted from biogas','INDUSTRIES','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM WA03.001','METHODOLOGY','Landfill methane recovery','WASTE_HANDLING_AND_DISPOSAL','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM WA03.002','METHODOLOGY','Flaring or use of landfill gas','WASTE_HANDLING_AND_DISPOSAL','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM AG04.001','METHODOLOGY','Methane recovery from livestock and manure management at households and small farms','AGRICULTURE','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM FR05.001','METHODOLOGY','Afforestation and reforestation of degraded mangrove habitats','FORESTRY','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM FR05.002','METHODOLOGY','Afforestation and reforestation of lands except wetlands','FORESTRY','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM AG04.002','METHODOLOGY','Emission reduction through improved management practices in rice cultivation','AGRICULTURE','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM WA03.003','METHODOLOGY','Production of Compressed Bio-gas (CBG)','WASTE_HANDLING_AND_DISPOSAL','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM EN01.003','METHODOLOGY','Electricity and Heat Generation from Biomass','ENERGY','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-001','TOOL','Combined tool to identify the baseline scenario and demonstrate additionality','CROSS_SECTOR','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-002','TOOL','Tool to calculate project or leakage CO2 emissions from fossil fuel combustion','CROSS_SECTOR','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-003','TOOL','Baseline, project and/or leakage emissions from electricity consumption and monitoring of electricity generation','CROSS_SECTOR','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-004','TOOL','Project emissions from flaring','CROSS_SECTOR','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-005','TOOL','Tool to determine the mass flow of a greenhouse gas in a gaseous stream','CROSS_SECTOR','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-006','TOOL','Tool to determine baseline efficiency of thermal and electricity systems','CROSS_SECTOR','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-008','TOOL','Project and leakage emissions from anaerobic digesters','CROSS_SECTOR','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-010','TOOL','Project and leakage emissions from biomass','CROSS_SECTOR','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-011','TOOL','Emissions from solid waste disposal sites','WASTE_HANDLING_AND_DISPOSAL','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-013','TOOL','Project and leakage emissions from composting','CROSS_SECTOR','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-014','TOOL','Apportioning emissions from production processes between main product and co- and by product','CROSS_SECTOR','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-015','TOOL','Tool to determine the remaining lifetime of equipment','CROSS_SECTOR','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-AR-0002','TOOL','Estimation of non-CO2 GHG emissions resulting from burning of biomass attributable to an A/R ICM project activity','FORESTRY','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-AR-0003','TOOL','Estimation of carbon stocks and change in carbon stocks in dead wood and litter in A/R ICM project activities','FORESTRY','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-AR-0004','TOOL','Estimation of carbon stocks and change in carbon stocks of trees and shrubs in A/R ICM project activities','FORESTRY','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BM-T-AR-0005','TOOL','Estimation of the increase in GHG emissions attributable to displacement of pre-project agricultural activities in A/R ICM project activity','FORESTRY','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Registry only; applicability and calculation adapter not validated.'),
  ('BMT-T-AR-0006','TOOL','Tool for estimation of change in soil organic carbon stocks due to the implementation of A/R ICM project activities','FORESTRY','https://beeindia.gov.in/view_content.php?lang=1&lid=571','2026-07-07','2026-10-18','Identifier preserved exactly as displayed on the official source; confirm source document before use.')
;
