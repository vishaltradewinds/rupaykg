export type CctsRegistryItemKind = "METHODOLOGY" | "TOOL";
export type CctsSector =
  | "ENERGY"
  | "INDUSTRIES"
  | "WASTE_HANDLING_AND_DISPOSAL"
  | "AGRICULTURE"
  | "FORESTRY"
  | "CROSS_SECTOR";

export type CctsImplementationStatus =
  | "REGISTRY_ONLY"
  | "IN_ANALYSIS"
  | "IMPLEMENTED_UNVERIFIED"
  | "VALIDATED"
  | "SUSPENDED";

export interface CctsRegistryItem {
  code: string;
  kind: CctsRegistryItemKind;
  title: string;
  sector: CctsSector;
  sourceStatus: "APPROVED_ON_OFFICIAL_REGISTER";
  implementationStatus: CctsImplementationStatus;
  officialVersion: string | null;
  sourceUrl: string;
  sourceSnapshotDate: "2026-07-07";
  sourceCheckedDate: "2026-10-18";
  note: string;
}

const SOURCE_URL = "https://beeindia.gov.in/view_content.php?lang=1&lid=571";
const base = {
  sourceStatus: "APPROVED_ON_OFFICIAL_REGISTER" as const,
  implementationStatus: "REGISTRY_ONLY" as const,
  officialVersion: null,
  sourceUrl: SOURCE_URL,
  sourceSnapshotDate: "2026-07-07" as const,
  sourceCheckedDate: "2026-10-18" as const,
  note: "Registry entry only. Applicability and calculation implementation have not been established by this record.",
};

const methodologies: CctsRegistryItem[] = [
  { ...base, code: "BM EN01.001", kind: "METHODOLOGY", sector: "ENERGY", title: "Grid-connected electricity generation from renewable sources" },
  { ...base, code: "BM EN01.002", kind: "METHODOLOGY", sector: "ENERGY", title: "Hydrogen production from electrolysis of water" },
  { ...base, code: "BM IN02.001", kind: "METHODOLOGY", sector: "INDUSTRIES", title: "Energy efficiency and fuel switching measures for industrial facilities" },
  { ...base, code: "BM IN02.002", kind: "METHODOLOGY", sector: "INDUSTRIES", title: "Hydrogen production using methane extracted from biogas" },
  { ...base, code: "BM WA03.001", kind: "METHODOLOGY", sector: "WASTE_HANDLING_AND_DISPOSAL", title: "Landfill methane recovery" },
  { ...base, code: "BM WA03.002", kind: "METHODOLOGY", sector: "WASTE_HANDLING_AND_DISPOSAL", title: "Flaring or use of landfill gas" },
  { ...base, code: "BM AG04.001", kind: "METHODOLOGY", sector: "AGRICULTURE", title: "Methane recovery from livestock and manure management at households and small farms" },
  { ...base, code: "BM FR05.001", kind: "METHODOLOGY", sector: "FORESTRY", title: "Afforestation and reforestation of degraded mangrove habitats" },
  { ...base, code: "BM FR05.002", kind: "METHODOLOGY", sector: "FORESTRY", title: "Afforestation and reforestation of lands except wetlands" },
  { ...base, code: "BM AG04.002", kind: "METHODOLOGY", sector: "AGRICULTURE", title: "Emission reduction through improved management practices in rice cultivation" },
  { ...base, code: "BM WA03.003", kind: "METHODOLOGY", sector: "WASTE_HANDLING_AND_DISPOSAL", title: "Production of Compressed Bio-gas (CBG)" },
  { ...base, code: "BM EN01.003", kind: "METHODOLOGY", sector: "ENERGY", title: "Electricity and Heat Generation from Biomass" },
];

const tools: CctsRegistryItem[] = [
  { ...base, code: "BM-T-001", kind: "TOOL", sector: "CROSS_SECTOR", title: "Combined tool to identify the baseline scenario and demonstrate additionality" },
  { ...base, code: "BM-T-002", kind: "TOOL", sector: "CROSS_SECTOR", title: "Tool to calculate project or leakage CO2 emissions from fossil fuel combustion" },
  { ...base, code: "BM-T-003", kind: "TOOL", sector: "CROSS_SECTOR", title: "Baseline, project and/or leakage emissions from electricity consumption and monitoring of electricity generation" },
  { ...base, code: "BM-T-004", kind: "TOOL", sector: "CROSS_SECTOR", title: "Project emissions from flaring" },
  { ...base, code: "BM-T-005", kind: "TOOL", sector: "CROSS_SECTOR", title: "Tool to determine the mass flow of a greenhouse gas in a gaseous stream" },
  { ...base, code: "BM-T-006", kind: "TOOL", sector: "CROSS_SECTOR", title: "Tool to determine baseline efficiency of thermal and electricity systems" },
  { ...base, code: "BM-T-008", kind: "TOOL", sector: "CROSS_SECTOR", title: "Project and leakage emissions from anaerobic digesters" },
  { ...base, code: "BM-T-010", kind: "TOOL", sector: "CROSS_SECTOR", title: "Project and leakage emissions from biomass" },
  { ...base, code: "BM-T-011", kind: "TOOL", sector: "WASTE_HANDLING_AND_DISPOSAL", title: "Emissions from solid waste disposal sites" },
  { ...base, code: "BM-T-013", kind: "TOOL", sector: "CROSS_SECTOR", title: "Project and leakage emissions from composting" },
  { ...base, code: "BM-T-014", kind: "TOOL", sector: "CROSS_SECTOR", title: "Apportioning emissions from production processes between main product and co- and by product" },
  { ...base, code: "BM-T-015", kind: "TOOL", sector: "CROSS_SECTOR", title: "Tool to determine the remaining lifetime of equipment" },
  { ...base, code: "BM-T-AR-0002", kind: "TOOL", sector: "FORESTRY", title: "Estimation of non-CO2 GHG emissions resulting from burning of biomass attributable to an A/R ICM project activity" },
  { ...base, code: "BM-T-AR-0003", kind: "TOOL", sector: "FORESTRY", title: "Estimation of carbon stocks and change in carbon stocks in dead wood and litter in A/R ICM project activities" },
  { ...base, code: "BM-T-AR-0004", kind: "TOOL", sector: "FORESTRY", title: "Estimation of carbon stocks and change in carbon stocks of trees and shrubs in A/R ICM project activities" },
  { ...base, code: "BM-T-AR-0005", kind: "TOOL", sector: "FORESTRY", title: "Estimation of the increase in GHG emissions attributable to displacement of pre-project agricultural activities in A/R ICM project activity" },
  { ...base, code: "BMT-T-AR-0006", kind: "TOOL", sector: "FORESTRY", title: "Tool for estimation of change in soil organic carbon stocks due to the implementation of A/R ICM project activities" },
];

export const CCTS_OFFICIAL_REGISTRY_SNAPSHOT: readonly CctsRegistryItem[] = Object.freeze([
  ...methodologies,
  ...tools,
]);

export function getCctsRegistryItem(code: string): CctsRegistryItem | undefined {
  const normalized = code.trim().toUpperCase();
  return CCTS_OFFICIAL_REGISTRY_SNAPSHOT.find((item) => item.code.toUpperCase() === normalized);
}

export function listCctsRegistryItems(filters: {
  kind?: CctsRegistryItemKind;
  sector?: CctsSector;
} = {}): CctsRegistryItem[] {
  return CCTS_OFFICIAL_REGISTRY_SNAPSHOT.filter((item) =>
    (!filters.kind || item.kind === filters.kind) &&
    (!filters.sector || item.sector === filters.sector)
  );
}

/**
 * Registry presence is not project eligibility, methodology implementation, validation,
 * verification, or certificate issuance. The caller must keep these statuses separate.
 */
export function cctsMethodologyReadiness(code: string): {
  status: "UNRESOLVED";
  registryItem: CctsRegistryItem | null;
  reason: string;
} {
  const item = getCctsRegistryItem(code);
  if (!item || item.kind !== "METHODOLOGY") {
    return {
      status: "UNRESOLVED",
      registryItem: null,
      reason: "METHODOLOGY_NOT_FOUND_IN_VERIFIED_REGISTRY_SNAPSHOT",
    };
  }
  return {
    status: "UNRESOLVED",
    registryItem: item,
    reason: "REGISTRY_ONLY_PROJECT_APPLICABILITY_AND_CALCULATION_ADAPTER_NOT_VALIDATED",
  };
}
