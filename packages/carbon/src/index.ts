import { createHash } from "node:crypto";
import { canClaimIssuedCarbonCredit, type ExternalIssuanceEvidence } from "./market-mechanisms.js";
export * from "./market-mechanisms.js";

type CarbonInput = {
  activityId: string;
  methodologyCode: string;
  methodologyVersion: string;
  baselineTco2e: number;
  projectTco2e: number;
  leakageTco2e?: number;
  uncertaintyTco2e?: number;
};

export type CarbonTraceStep = {
  equationId: string;
  inputs: Record<string, number>;
  result: number;
};

export type CarbonResult = {
  grossReductionTco2e: number;
  netReductionTco2e: number;
  uncertaintyTco2e: number;
  status: "CALCULATED_PENDING_VERIFICATION";
  normalizedInputs: Required<CarbonInput>;
  trace: CarbonTraceStep[];
};

export type BmWa03001Input = {
  fch4ProjectTch4: number;
  fch4BaselineTch4: number;
  gwpCh4Tco2ePerTch4: number;
  projectEmissionsTco2e: number;
  leakageTco2e: number;
  oxidationFactor: number;
};

export type BmWa03001ApplicabilityInput = {
  sector: string;
  activity: string;
  reducesOrganicWasteRecycling: boolean;
  managementDeliberatelyChangedToIncreaseMethane: boolean;
  changeWasRequiredForTechnicalOrRegulatoryReasons: boolean;
};

export const BM_WA03001_SOURCE = {
  reference: "https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf",
  publicationDate: "2025-03-27",
  version: "1.0",
  sector: "Waste Handling and Disposal",
  equation: "ERy,calculated = (FCH4,PJ,y - FCH4,BL,y) × GWPCH4 × (1 - OX) - PEy - LEy",
  equationId: "BM.WA03.001.EQ4.V1",
} as const;

export type BmWa03001Result = {
  methodologyCode: "BM WA03.001";
  methodologyVersion: "1.0";
  resultTco2e: number;
  status: "CALCULATED_PENDING_VERIFICATION";
  trace: CarbonTraceStep[];
};

export type BmWa03001ApplicabilityResult = {
  eligible: boolean;
  reasons: string[];
};

export type BmWa03001ParameterDefinition = {
  code: keyof BmWa03001Input;
  unit: string;
  required: true;
  sourceClass: "MONITORED" | "CALCULATED" | "METHODOLOGY_CONSTANT";
  equationIds: readonly string[];
};

export const BM_WA03001_PARAMETER_DICTIONARY: readonly BmWa03001ParameterDefinition[] = [
  { code: "fch4ProjectTch4", unit: "tCH4", required: true, sourceClass: "MONITORED", equationIds: ["BM.WA03.001.EQ4.V1"] },
  { code: "fch4BaselineTch4", unit: "tCH4", required: true, sourceClass: "CALCULATED", equationIds: ["BM.WA03.001.EQ4.V1"] },
  { code: "gwpCh4Tco2ePerTch4", unit: "tCO2e/tCH4", required: true, sourceClass: "METHODOLOGY_CONSTANT", equationIds: ["BM.WA03.001.EQ4.V1"] },
  { code: "projectEmissionsTco2e", unit: "tCO2e", required: true, sourceClass: "MONITORED", equationIds: ["BM.WA03.001.EQ4.V1"] },
  { code: "leakageTco2e", unit: "tCO2e", required: true, sourceClass: "CALCULATED", equationIds: ["BM.WA03.001.EQ4.V1"] },
  { code: "oxidationFactor", unit: "fraction", required: true, sourceClass: "METHODOLOGY_CONSTANT", equationIds: ["BM.WA03.001.EQ4.V1"] },
] as const;

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
}

export function validateBmWa03001Input(input: BmWa03001Input): void {
  for (const definition of BM_WA03001_PARAMETER_DICTIONARY) {
    const value = input[definition.code];
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${definition.code} is required and must be finite`);
    assertFiniteNonNegative(value, definition.code);
  }
  if (input.oxidationFactor > 1) throw new Error("oxidationFactor must be between 0 and 1");
  if (input.gwpCh4Tco2ePerTch4 === 0) throw new Error("gwpCh4Tco2ePerTch4 must be greater than zero");
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

/**
 * The baseline-minus-project helper is a generic arithmetic utility, not an
 * implementation of an official methodology. Official BEE CCTS methodology
 * and tool identifiers must use a reviewed, method-specific adapter.
 */
export function isGenericCalculationMethodAllowed(methodologyCode: string): boolean {
  const normalized = methodologyCode.trim().toUpperCase();
  return normalized.length > 0 && !/^BM/.test(normalized);
}

export function calculateEmissionReduction(input: CarbonInput): CarbonResult {
  if (!isGenericCalculationMethodAllowed(input.methodologyCode)) {
    throw new Error("Official BEE CCTS methodologies/tools require a reviewed method-specific calculation adapter");
  }
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) throw new Error(`${key} must be a finite non-negative number`);
  }
  if (!input.activityId.trim()) throw new Error("activityId is required");
  if (!input.methodologyCode.trim() || !input.methodologyVersion.trim()) throw new Error("methodologyCode and methodologyVersion are required");
  const leakage = input.leakageTco2e ?? 0;
  const uncertainty = input.uncertaintyTco2e ?? 0;
  const normalizedInputs: Required<CarbonInput> = { activityId: input.activityId.trim(), methodologyCode: input.methodologyCode.trim(), methodologyVersion: input.methodologyVersion.trim(), baselineTco2e: input.baselineTco2e, projectTco2e: input.projectTco2e, leakageTco2e: leakage, uncertaintyTco2e: uncertainty };
  const gross = normalizedInputs.baselineTco2e - normalizedInputs.projectTco2e;
  const netBeforeFloor = gross - leakage;
  const net = Math.max(0, netBeforeFloor);
  return { grossReductionTco2e: gross, netReductionTco2e: net, uncertaintyTco2e: uncertainty, status: "CALCULATED_PENDING_VERIFICATION", normalizedInputs, trace: [
    { equationId: "CARBON.GROSS_REDUCTION.V1", inputs: { baselineTco2e: normalizedInputs.baselineTco2e, projectTco2e: normalizedInputs.projectTco2e }, result: gross },
    { equationId: "CARBON.NET_REDUCTION.V1", inputs: { grossReductionTco2e: gross, leakageTco2e: leakage }, result: netBeforeFloor },
    { equationId: "CARBON.NET_NON_NEGATIVE_FLOOR.V1", inputs: { netBeforeFloor }, result: net },
  ] };
}

export function evaluateBmWa03001Applicability(input: BmWa03001ApplicabilityInput): BmWa03001ApplicabilityResult {
  const reasons: string[] = [];
  if (input.sector.trim().toLowerCase() !== "waste handling and disposal") reasons.push("sector must be Waste Handling and Disposal");
  if (!input.activity.trim()) reasons.push("activity is required");
  if (input.reducesOrganicWasteRecycling) reasons.push("project must not reduce organic-waste recycling");
  if (input.managementDeliberatelyChangedToIncreaseMethane && !input.changeWasRequiredForTechnicalOrRegulatoryReasons) reasons.push("SWDS management must not be deliberately changed to increase methane generation unless required for technical or regulatory reasons");
  return { eligible: reasons.length === 0, reasons };
}


export type BmWa03001ToolStatus = "CURRENT_APPROVED_VERSION_CONFIRMED" | "NOT_CONFIRMED";
export type BmWa03001ReadinessInput = BmWa03001ApplicabilityInput & {
  landfillSiteType: "SOLID_WASTE_DISPOSAL_SITE" | "OTHER" | "UNRESOLVED";
  containsBiodegradableOrganicMatter: boolean | null;
  recoveredGasUse: "FLARING_ONLY" | "POWER_OR_HEAT" | "OTHER_NON_FLARING_USE" | "UNRESOLVED";
  additionalityPath: "POSITIVE_LIST_BM_T_012" | "BM_T_001" | "UNRESOLVED";
  projectBoundaryDefined: boolean | null;
  flowMetersCalibrated: boolean | null;
  continuousFlowMetering: boolean | null;
  methaneMeasurementMethod: "CONTINUOUS_ANALYSER" | "PERIODIC_90_10" | "OTHER" | "UNRESOLVED";
  flowAndMethaneHumidityBasisAligned: boolean | null;
  baselineAndAdditionalityEvidence: boolean | null;
  toolStatuses: Partial<Record<"BM-T-001" | "BM-T-002" | "BM-T-003" | "BM-T-004" | "BM-T-006" | "BM-T-011" | "BM-T-012", BmWa03001ToolStatus>>;
};

export type BmWa03001ReadinessResult = {
  status: "INELIGIBLE" | "UNRESOLVED" | "ELIGIBLE_FOR_FURTHER_ASSESSMENT";
  requiredSectoralScopes: string[];
  requiredTools: string[];
  reasons: string[];
  source: { url: string; version: "1.0"; publicationDate: "2025-03-27" };
};

/**
 * Full first-pass readiness gate grounded in BEE BM WA03.001 v1.0.
 * This is not formal CCTS eligibility or a substitute for ACVA validation.
 * Required tool status must be confirmed against current official documents.
 */
export function evaluateBmWa03001Readiness(input: BmWa03001ReadinessInput): BmWa03001ReadinessResult {
  const disqualifiers: string[] = [];
  const unresolved: string[] = [];
  if (input.sector.trim().toLowerCase() !== "waste handling and disposal") disqualifiers.push("Sector must be Waste Handling and Disposal.");
  if (!input.activity.trim()) disqualifiers.push("Project activity description is required.");
  if (input.reducesOrganicWasteRecycling) disqualifiers.push("Project must not reduce organic-waste recycling.");
  if (input.managementDeliberatelyChangedToIncreaseMethane && !input.changeWasRequiredForTechnicalOrRegulatoryReasons) disqualifiers.push("Management must not be deliberately changed to increase methane unless technically or regulatorily required.");
  if (input.landfillSiteType === "OTHER") disqualifiers.push("Activity is not at a solid waste disposal site/landfill.");
  if (input.landfillSiteType === "UNRESOLVED") unresolved.push("Solid waste disposal site and project boundary evidence are unresolved.");
  if (input.containsBiodegradableOrganicMatter === false) disqualifiers.push("Site waste does not contain biodegradable organic matter.");
  if (input.containsBiodegradableOrganicMatter === null) unresolved.push("Biodegradable organic matter content is not evidenced.");
  const scopes = input.recoveredGasUse === "FLARING_ONLY"
    ? ["03: Waste handling and disposal"]
    : input.recoveredGasUse === "POWER_OR_HEAT" || input.recoveredGasUse === "OTHER_NON_FLARING_USE"
      ? ["03: Waste handling and disposal", "01: Energy"]
      : [];
  if (input.recoveredGasUse === "UNRESOLVED") unresolved.push("Recovered landfill-gas use (flaring only versus non-flaring use) is unresolved.");
  if (input.projectBoundaryDefined !== true) unresolved.push("The physical/geographical landfill project boundary is not confirmed.");
  if (input.flowMetersCalibrated !== true) unresolved.push("Flow-meter maintenance, testing and calibration evidence is missing.");
  if (input.continuousFlowMetering !== true) unresolved.push("Continuous flow-meter measurement and accumulated-volume records are not confirmed.");
  if (input.methaneMeasurementMethod !== "CONTINUOUS_ANALYSER" && input.methaneMeasurementMethod !== "PERIODIC_90_10") unresolved.push("Methane concentration monitoring must use a continuous analyser or periodic measurement meeting the 90/10 confidence/precision requirement.");
  if (input.flowAndMethaneHumidityBasisAligned !== true) unresolved.push("Flow and methane concentration measurement humidity basis/location alignment is not confirmed.");
  if (input.baselineAndAdditionalityEvidence !== true) unresolved.push("Baseline and additionality evidence has not been confirmed.");
  const requiredTools = ["BM-T-001", "BM-T-002", "BM-T-003", "BM-T-004", "BM-T-006", "BM-T-011"];
  if (input.additionalityPath === "UNRESOLVED") {
    unresolved.push("Additionality path is unresolved: confirm the positive-list pathway or the BM-T-001 pathway.");
  } else if (input.additionalityPath === "POSITIVE_LIST_BM_T_012") {
    requiredTools.push("BM-T-012");
    unresolved.push("BM-T-012 is referenced by BM WA03.001 v1.0 but is absent from the BEE approved-tools register snapshot checked 2026-10-18; its current approved status must be resolved before relying on this pathway.");
  }
  for (const tool of requiredTools) {
    if (input.toolStatuses[tool as keyof typeof input.toolStatuses] !== "CURRENT_APPROVED_VERSION_CONFIRMED") {
      unresolved.push("Current approved version and applicable use of " + tool + " are not confirmed.");
    }
  }
  return {
    status: disqualifiers.length ? "INELIGIBLE" : unresolved.length ? "UNRESOLVED" : "ELIGIBLE_FOR_FURTHER_ASSESSMENT",
    requiredSectoralScopes: scopes,
    requiredTools,
    reasons: [...disqualifiers, ...unresolved],
    source: { url: BM_WA03001_SOURCE.reference, version: "1.0", publicationDate: "2025-03-27" },
  };
}

export function calculateBmWa03001(input: BmWa03001Input): BmWa03001Result {
  validateBmWa03001Input(input);
  const methaneDelta = input.fch4ProjectTch4 - input.fch4BaselineTch4;
  const oxidationAdjusted = methaneDelta * input.gwpCh4Tco2ePerTch4 * (1 - input.oxidationFactor);
  const result = oxidationAdjusted - input.projectEmissionsTco2e - input.leakageTco2e;
  return { methodologyCode: "BM WA03.001", methodologyVersion: "1.0", resultTco2e: result, status: "CALCULATED_PENDING_VERIFICATION", trace: [
    { equationId: "BM.WA03.001.EQ4.METHANE_DELTA.V1", inputs: { fch4ProjectTch4: input.fch4ProjectTch4, fch4BaselineTch4: input.fch4BaselineTch4 }, result: methaneDelta },
    { equationId: "BM.WA03.001.EQ4.OXIDATION_ADJUSTMENT.V1", inputs: { methaneDelta, gwpCh4Tco2ePerTch4: input.gwpCh4Tco2ePerTch4, oxidationFactor: input.oxidationFactor }, result: oxidationAdjusted },
    { equationId: "BM.WA03.001.EQ4.PROJECT_AND_LEAKAGE_DEDUCTION.V1", inputs: { oxidationAdjusted, projectEmissionsTco2e: input.projectEmissionsTco2e, leakageTco2e: input.leakageTco2e }, result },
  ] };
}

export function isIssuableCarbonValue(status: string, issuanceEvidence?: ExternalIssuanceEvidence): boolean {
  // A completed calculation or a count of internal reviews is never proof of CCC issuance.
  return status === "ISSUED" && canClaimIssuedCarbonCredit("ISSUED", issuanceEvidence);
}
