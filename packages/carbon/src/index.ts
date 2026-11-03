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

export type BmWa03002CapturePath = "NEW_CAPTURE_SYSTEM" | "EXISTING_SYSTEM_IMPROVEMENT";
export type BmWa03002PreProjectUse = "VENTED_OR_FLARED_NOT_USED" | "USED" | "UNKNOWN";
export type BmWa03002EndUse = "FLARING" | "ELECTRICITY" | "HEAT_ALLOWED_EQUIPMENT" | "NATURAL_GAS_NETWORK" | "DEDICATED_PIPELINE" | "TRUCKED_COMPRESSED_OR_LIQUEFIED_LFG";

export type BmWa03002ApplicabilityInput = {
  sector: string;
  activity: string;
  capturePath: BmWa03002CapturePath;
  noPriorCaptureSystemInstalledOrPlanned: boolean | null;
  increasedRecoveryRateOrChangedUse: boolean | null;
  preProjectUse: BmWa03002PreProjectUse;
  capturedAmountCanBeSeparatedFromExistingSystem: boolean | null;
  existingSystemEfficiencyImpactedByProject: boolean | null;
  historicalCaptureDataAvailable: boolean | null;
  endUses: readonly BmWa03002EndUse[];
  reducesOrganicWasteRecycling: boolean | null;
  combinedWithAnotherApprovedMethodology: boolean | null;
  managementDeliberatelyChangedToIncreaseMethane: boolean | null;
  baselineScenarioConfirmed: boolean | null;
};

export const BM_WA03002_SOURCE = {
  reference: "https://www.beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-a0e3f856720a5c57_1776061241.pdf",
  publicationDate: "2025-03-27",
  version: "1.0",
  sector: "Waste Handling and Disposal",
  title: "Flaring or use of landfill gas",
  requiredTools: ["BM-T-001", "BM-T-002", "BM-T-003", "BM-T-004", "BM-T-005", "BM-T-006", "BM-T-007", "BM-T-011", "BM-T-012"],
  dependencyReconciliationRequired: true,
} as const;

export type BmWa03002ApplicabilityResult = {
  methodologyCode: "BM WA03.002";
  methodologyVersion: "1.0";
  screeningStatus: "PASS_FOR_FURTHER_REVIEW" | "UNRESOLVED" | "FAIL";
  reasons: string[];
  requiredSectoralScopes: string[];
  requiredTools: readonly string[];
  dependencyReconciliationRequired: true;
  productionEligible: false;
};

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

/**
 * Screens BM WA03.002 against its published scope/applicability conditions.
 * This is not a full methodology calculation, project eligibility decision, or ACVA validation.
 * Required tools and their currently approved versions must be reconciled before production use.
 */
export function evaluateBmWa03002Applicability(input: BmWa03002ApplicabilityInput): BmWa03002ApplicabilityResult {
  const failures: string[] = [];
  const unresolved: string[] = [];
  if (typeof input.sector !== "string" || input.sector.trim().toLowerCase() !== "waste handling and disposal") failures.push("sector must be Waste Handling and Disposal");
  if (typeof input.activity !== "string" || !input.activity.trim()) unresolved.push("activity description is required");
  if (input.reducesOrganicWasteRecycling === true) failures.push("project activity must not reduce organic-waste recycling");
  else if (input.reducesOrganicWasteRecycling === null) unresolved.push("effect on organic-waste recycling is unresolved");
  if (input.combinedWithAnotherApprovedMethodology === true) failures.push("BM WA03.002 is not applicable in combination with another approved methodology");
  else if (input.combinedWithAnotherApprovedMethodology === null) unresolved.push("combination with another approved methodology is unresolved");
  if (input.managementDeliberatelyChangedToIncreaseMethane === true) failures.push("SWDS management must not be deliberately changed to increase methane generation");
  else if (input.managementDeliberatelyChangedToIncreaseMethane === null) unresolved.push("whether SWDS management was changed to increase methane is unresolved");
  if (input.baselineScenarioConfirmed !== true) unresolved.push("the methodology's required baseline scenario has not been confirmed");
  const allowedEndUses = new Set(["FLARING", "ELECTRICITY", "HEAT_ALLOWED_EQUIPMENT", "NATURAL_GAS_NETWORK", "DEDICATED_PIPELINE", "TRUCKED_COMPRESSED_OR_LIQUEFIED_LFG"]);
  const endUses = Array.isArray(input.endUses) ? input.endUses : [];
  if (endUses.length === 0) unresolved.push("at least one permitted landfill-gas end use must be evidenced");
  else if (endUses.some((use) => typeof use !== "string" || !allowedEndUses.has(use))) failures.push("one or more landfill-gas end uses are not supported by the current screen");

  if (input.capturePath === "NEW_CAPTURE_SYSTEM") {
    if (input.noPriorCaptureSystemInstalledOrPlanned === null) unresolved.push("absence of a prior or planned capture system is unresolved");
    else if (!input.noPriorCaptureSystemInstalledOrPlanned) failures.push("new-system pathway requires no prior or planned capture system before the project");
  } else if (input.capturePath === "EXISTING_SYSTEM_IMPROVEMENT") {
    if (input.increasedRecoveryRateOrChangedUse === null) unresolved.push("effect of the investment on recovery rate or gas use is unresolved");
    else if (!input.increasedRecoveryRateOrChangedUse) failures.push("existing-system pathway requires increased recovery or changed use");
    if (input.preProjectUse === "UNKNOWN") unresolved.push("pre-project captured-gas use is unresolved");
    else if (input.preProjectUse !== "VENTED_OR_FLARED_NOT_USED") failures.push("existing-system pathway requires gas to have been vented or flared and not used before the project");
    if (input.capturedAmountCanBeSeparatedFromExistingSystem === null) unresolved.push("separability of existing-system captured gas is unresolved");
    else if (!input.capturedAmountCanBeSeparatedFromExistingSystem && input.existingSystemEfficiencyImpactedByProject === null) unresolved.push("existing-system efficiency impact is unresolved");
    else if (!input.capturedAmountCanBeSeparatedFromExistingSystem && input.existingSystemEfficiencyImpactedByProject === false) {
      if (input.historicalCaptureDataAvailable === null) unresolved.push("historical capture data availability is unresolved");
      else if (!input.historicalCaptureDataAvailable) failures.push("historical capture data is required when existing-system gas cannot be separated and system efficiency is not impacted");
    }
  } else {
    failures.push("capture pathway is not supported by BM WA03.002");
  }

  const usesBeyondFlaring = endUses.some((use) => use !== "FLARING");
  const requiredSectoralScopes = usesBeyondFlaring
    ? ["03: Waste handling and disposal", "01: Energy"]
    : ["03: Waste handling and disposal"];
  const screeningStatus = failures.length > 0 ? "FAIL" : unresolved.length > 0 ? "UNRESOLVED" : "PASS_FOR_FURTHER_REVIEW";
  return {
    methodologyCode: "BM WA03.002",
    methodologyVersion: "1.0",
    screeningStatus,
    reasons: [...failures, ...unresolved],
    requiredSectoralScopes,
    requiredTools: BM_WA03002_SOURCE.requiredTools,
    dependencyReconciliationRequired: true,
    productionEligible: false,
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

export * from "./icvcm-ccp-integrity.js";
