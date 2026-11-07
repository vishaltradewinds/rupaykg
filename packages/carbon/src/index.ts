import { createHash } from "node:crypto";
export * from "./bm-t-011.js";
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

/** Evidence-backed inputs required before BM WA03.001 Equation 4 can be prepared for Guardian. */
export type BmWa03001BaselineLink = {
  activityId: string;
  organizationId: string;
  baselineRecordId: string;
  methodologyCode: "BM WA03.001";
  methodologyVersion: "1.0";
  baselinePeriod: string;
  baselineStatus: "SUBMITTED" | "APPROVED" | "REJECTED";
  baselineFch4Tch4: number;
  baselineEvidenceRefs: readonly string[];
  submittedByIdentityId: string;
  baselineRecordSha256: string;
  approvedBy: string | null;
  approvedAt: string | null;
};

export type BmWa03001MonitoringLink = {
  activityId: string;
  monitoringRecordId: string;
  monitoringPeriodId: string;
  projectMethane: BmWa03001ProjectMethaneResult;
  projectEmissionsTco2e: number;
  leakageTco2e: number;
  oxidationFactor: number;
  evidenceRefs: readonly string[];
};

export type BmWa03001ReconciledEquation4Input = {
  activityId: string;
  baselineRecordId: string;
  baselineEvidenceSha256: string;
  monitoringRecordId: string;
  monitoringPeriodId: string;
  input: BmWa03001Input;
  status: "RECONCILED_PENDING_VERIFICATION";
  provenanceSha256: string;
};

export type BmWa03001FlowPeriod = {
  periodId: string;
  lfgVolumeM3: number;
  methaneVolumeFraction: number;
  methaneDensityTPerM3: number;
  methaneDensityEvidence: string;
  densityBasis: "MEASURED_T_P" | "NORMALIZED_REFERENCE_CONDITIONS";
  densityReferenceConditions: string;
  gasTemperatureC?: number;
  gasPressurePa?: number;
  volumeAndCompositionBasis: "DRY" | "SAME_HUMIDITY";
  flowMeterId: string;
  flowMeterCalibrationEvidence: string;
  flowMeasurementEvidence: string;
  methaneAnalyserId: string;
  analyserCalibrationEvidence: string;
  methaneMeasurementEvidence: string;
  measuredAt: string;
};

export type BmWa03001ProjectMethaneResult = {
  fch4ProjectTch4: number;
  method: "BM.WA03.001.EQ5.FLOW_AND_COMPOSITION.V1";
  status: "CALCULATED_PENDING_VERIFICATION";
  inputSha256: string;
  outputSha256: string;
  trace: Array<{ periodId: string; lfgVolumeM3: number; methaneVolumeFraction: number; methaneDensityTPerM3: number; resultTch4: number; evidenceRefs: string[]; inputSha256: string; resultSha256: string }>;
};

export type BmWa03001ApplicabilityInput = {
  sector: string;
  activity: string;
  reducesOrganicWasteRecycling: boolean;
  managementDeliberatelyChangedToIncreaseMethane: boolean;
  changeWasRequiredForTechnicalOrRegulatoryReasons: boolean;
};

export const BM_WA03001_GWP_CH4_TCO2E_PER_TCH4 = 29.8 as const;

export const BM_WA03001_SOURCE = {
  reference: "https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf",
  publicationDate: "2025-03-27",
  version: "1.0",
  sector: "Waste Handling and Disposal",
  equation: "ERy,calculated = (FCH4,PJ,y - FCH4,BL,y) * GWPCH4 * (1 - OX) - PEy - LEy",
  equationId: "BM.WA03.001.EQ4.V1",
  requiredTools: ["BM-T-001", "BM-T-002", "BM-T-003", "BM-T-004", "BM-T-006", "BM-T-011", "BM-T-012"],
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

export type BmWa03001MonitoringParameterDefinition = {
  code: "PEpower,y" | "PEflare,y" | "PEprocess,y" | "LFGi,y" | "wCH4,y" | "T" | "P" | "EGy" | "EEy" | "GWPCH4";
  unit: string;
  applicability: "ALWAYS" | "WHEN_APPLICABLE" | "WHEN_NOT_NORMALIZED";
  monitoringRule: string;
  officialReference: string;
};

export const BM_WA03001_MONITORING_PARAMETER_DICTIONARY: readonly BmWa03001MonitoringParameterDefinition[] = [
  { code: "PEpower,y", unit: "tCO2e", applicability: "ALWAYS", monitoringRule: "Calculate project electricity/fuel emissions using BM-T-003 and BM-T-002 as applicable; follow the official equipment-capacity method where specified.", officialReference: "BM WA03.001 v1.0, paragraph 14 and monitoring table 1" },
  { code: "PEflare,y", unit: "tCO2e", applicability: "WHEN_APPLICABLE", monitoringRule: "Determine flare emissions for each flare using BM-T-004.", officialReference: "BM WA03.001 v1.0, paragraph 15 and monitoring table 2" },
  { code: "PEprocess,y", unit: "tCO2e", applicability: "WHEN_APPLICABLE", monitoringRule: "Account for landfill-gas upgrading emissions where the upgrading process applies.", officialReference: "BM WA03.001 v1.0, paragraph 13 and monitoring table 3" },
  { code: "LFGi,y", unit: "m3 LFG", applicability: "ALWAYS", monitoringRule: "Continuous flow meter with accumulated volume recording; preserve device, timestamp, calibration, and volume reference conditions.", officialReference: "BM WA03.001 v1.0, monitoring table 4" },
  { code: "wCH4,y", unit: "volume fraction", applicability: "ALWAYS", monitoringRule: "Direct methane analyser measured continuously at flow frequency, or periodic measurements meeting 90/10 confidence/precision; inferred methane content from CO2 or other constituents is not permitted.", officialReference: "BM WA03.001 v1.0, monitoring table 5" },
  { code: "T", unit: "degC", applicability: "WHEN_NOT_NORMALIZED", monitoringRule: "Measure near flow point at the same time as methane content unless the meter outputs normalized flow using measured temperature and pressure.", officialReference: "BM WA03.001 v1.0, monitoring table 6" },
  { code: "P", unit: "Pa", applicability: "WHEN_NOT_NORMALIZED", monitoringRule: "Measure near flow point at the same time as methane content unless the meter outputs normalized flow using measured temperature and pressure.", officialReference: "BM WA03.001 v1.0, monitoring table 7" },
  { code: "EGy", unit: "MWh", applicability: "WHEN_APPLICABLE", monitoringRule: "Required only when recovered methane is used for power generation under the electricity-generation alternative.", officialReference: "BM WA03.001 v1.0, paragraph 19 and monitoring table 8" },
  { code: "EEy", unit: "%", applicability: "WHEN_APPLICABLE", monitoringRule: "Use equipment-manufacturer efficiency for biogas where specified; use the methodology default of 40% where permitted; range handling follows paragraph 19.", officialReference: "BM WA03.001 v1.0, paragraph 19 and monitoring table 9" },
  { code: "GWPCH4", unit: "tCO2e/tCH4", applicability: "ALWAYS", monitoringRule: "Pin to 29.8 for v1.0 (IPCC AR6); change only after a formally approved methodology/constant revision.", officialReference: "BM WA03.001 v1.0, monitoring table 10" },
] as const;
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

export function calculateBmWa03001ProjectMethaneFromFlow(periods: readonly BmWa03001FlowPeriod[]): BmWa03001ProjectMethaneResult {
  if (!Array.isArray(periods) || periods.length === 0) throw new Error("At least one measured flow period is required");
  const seen = new Set<string>();
  const trace = periods.map((period) => {
    if (!period.periodId.trim() || seen.has(period.periodId)) throw new Error("Each flow period requires a unique non-empty periodId");
    seen.add(period.periodId);
    if (!period.flowMeterId.trim() || !period.methaneAnalyserId.trim()) throw new Error(`${period.periodId}: flow meter and methane analyser IDs are required`);
    if (!period.flowMeterCalibrationEvidence.trim() || !period.analyserCalibrationEvidence.trim()) throw new Error(`${period.periodId}: flow meter and analyser calibration evidence are required`);
    if (!period.flowMeasurementEvidence.trim() || !period.methaneMeasurementEvidence.trim()) throw new Error(`${period.periodId}: raw flow and methane measurement evidence are required`);
    if (!period.methaneDensityEvidence.trim() || !period.densityReferenceConditions.trim()) throw new Error(`${period.periodId}: methane density evidence and reference conditions are required`);
    if (period.densityBasis === "MEASURED_T_P") {
      if (!Number.isFinite(period.gasTemperatureC) || (period.gasTemperatureC as number) <= -273.15) throw new Error(`${period.periodId}: valid gas temperature in degC is required to substantiate methane density`);
      if (!Number.isFinite(period.gasPressurePa) || (period.gasPressurePa as number) <= 0) throw new Error(`${period.periodId}: positive gas pressure in Pa is required to substantiate methane density`);
    } else if (period.densityBasis !== "NORMALIZED_REFERENCE_CONDITIONS") {
      throw new Error(`${period.periodId}: density basis must be explicit`);
    }
    if (!Number.isFinite(Date.parse(period.measuredAt))) throw new Error(`${period.periodId}: measuredAt must be a valid timestamp`);
    assertFiniteNonNegative(period.lfgVolumeM3, `${period.periodId}.lfgVolumeM3`);
    if (!Number.isFinite(period.methaneVolumeFraction) || period.methaneVolumeFraction < 0 || period.methaneVolumeFraction > 1) throw new Error(`${period.periodId}.methaneVolumeFraction must be a fraction between 0 and 1`);
    if (!Number.isFinite(period.methaneDensityTPerM3) || period.methaneDensityTPerM3 <= 0) throw new Error(`${period.periodId}.methaneDensityTPerM3 must be finite and greater than zero`);
    if (period.volumeAndCompositionBasis !== "DRY" && period.volumeAndCompositionBasis !== "SAME_HUMIDITY") throw new Error(`${period.periodId}: flow volume and methane composition must share the same humidity basis`);
    const resultTch4 = period.lfgVolumeM3 * period.methaneVolumeFraction * period.methaneDensityTPerM3;
    if (!Number.isFinite(resultTch4)) throw new Error(`${period.periodId}: calculated methane mass is not finite`);
    const evidenceRefs = [period.flowMeasurementEvidence, period.methaneMeasurementEvidence, period.methaneDensityEvidence, period.flowMeterCalibrationEvidence, period.analyserCalibrationEvidence];
    const inputSha256 = sha256Canonical(period);
    const resultPayload = { periodId: period.periodId, lfgVolumeM3: period.lfgVolumeM3, methaneVolumeFraction: period.methaneVolumeFraction, methaneDensityTPerM3: period.methaneDensityTPerM3, resultTch4, evidenceRefs };
    return { ...resultPayload, inputSha256, resultSha256: sha256Canonical(resultPayload) };
  });
  const fch4ProjectTch4 = trace.reduce((sum, period) => sum + period.resultTch4, 0);
  if (!Number.isFinite(fch4ProjectTch4)) throw new Error("Aggregated project methane mass is not finite");
  const result = { fch4ProjectTch4, method: "BM.WA03.001.EQ5.FLOW_AND_COMPOSITION.V1" as const, status: "CALCULATED_PENDING_VERIFICATION" as const, trace };
  return { ...result, inputSha256: sha256Canonical(periods), outputSha256: sha256Canonical(result) };
}
export function validateBmWa03001Input(input: BmWa03001Input): void {
  for (const definition of BM_WA03001_PARAMETER_DICTIONARY) {
    const value = input[definition.code];
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${definition.code} is required and must be finite`);
    assertFiniteNonNegative(value, definition.code);
  }
  if (input.oxidationFactor > 1) throw new Error("oxidationFactor must be between 0 and 1");
  if (input.gwpCh4Tco2ePerTch4 !== BM_WA03001_GWP_CH4_TCO2E_PER_TCH4) throw new Error(`gwpCh4Tco2ePerTch4 must match the official BM WA03.001 v1.0 value ${BM_WA03001_GWP_CH4_TCO2E_PER_TCH4}; update only with an approved methodology revision`);
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

/**
 * Reconciles the separate approved baseline record with a monitoring record before preparing
 * Equation 4 inputs. The baseline record hash is recomputed, not trusted as a caller-supplied
 * assertion. This does not approve the calculation or issue credits.
 */
export function reconcileBmWa03001Equation4Inputs(
  baseline: BmWa03001BaselineLink,
  monitoring: BmWa03001MonitoringLink,
): BmWa03001ReconciledEquation4Input {
  if (!baseline.activityId.trim() || !monitoring.activityId.trim() || baseline.activityId !== monitoring.activityId) {
    throw new Error("Baseline and monitoring records must reference the same non-empty activityId");
  }
  if (!baseline.baselineRecordId.trim() || !monitoring.monitoringRecordId.trim() || !monitoring.monitoringPeriodId.trim()) {
    throw new Error("Baseline record ID, monitoring record ID, and monitoring period ID are required");
  }
  if (baseline.baselineStatus !== "APPROVED" || !baseline.approvedBy?.trim() || !baseline.approvedAt || !Number.isFinite(Date.parse(baseline.approvedAt))) {
    throw new Error("An approved baseline with approver identity and valid approval timestamp is required");
  }
  if (!Array.isArray(baseline.baselineEvidenceRefs) || baseline.baselineEvidenceRefs.length === 0 || baseline.baselineEvidenceRefs.some((ref) => typeof ref !== "string" || !ref.trim())) {
    throw new Error("Approved baseline evidence references are required");
  }
  if (!/^[a-f0-9]{64}$/i.test(baseline.baselineRecordSha256)) throw new Error("baselineRecordSha256 must be a SHA-256 hex digest");
  if (baseline.methodologyCode !== "BM WA03.001" || baseline.methodologyVersion !== "1.0" || !baseline.organizationId.trim() || !baseline.baselinePeriod.trim() || !baseline.submittedByIdentityId.trim()) {
    throw new Error("Baseline must carry its persisted organization, methodology version, period, and submitter identity");
  }
  if (baseline.approvedBy === baseline.submittedByIdentityId) throw new Error("Baseline submitter cannot approve their own record");
  const baselineRecord = {
    activityId: baseline.activityId,
    organizationId: baseline.organizationId,
    methodologyCode: baseline.methodologyCode,
    methodologyVersion: baseline.methodologyVersion,
    baselineFch4Tch4: baseline.baselineFch4Tch4,
    baselinePeriod: baseline.baselinePeriod,
    evidenceIds: [...baseline.baselineEvidenceRefs].sort(),
    submittedByIdentityId: baseline.submittedByIdentityId,
  };
  if (sha256Canonical(baselineRecord) !== baseline.baselineRecordSha256.toLowerCase()) {
    throw new Error("Baseline record hash mismatch; baseline record was changed or the wrong record was supplied");
  }
  if (monitoring.projectMethane.status !== "CALCULATED_PENDING_VERIFICATION" || monitoring.projectMethane.method !== "BM.WA03.001.EQ5.FLOW_AND_COMPOSITION.V1") {
    throw new Error("Project methane must be calculated by the evidence-backed BM WA03.001 Equation 5 flow-and-composition method");
  }
  if (!/^[a-f0-9]{64}$/i.test(monitoring.projectMethane.inputSha256) || !/^[a-f0-9]{64}$/i.test(monitoring.projectMethane.outputSha256)) {
    throw new Error("Project methane input/output provenance hashes are required");
  }
  if (!Array.isArray(monitoring.evidenceRefs) || monitoring.evidenceRefs.length === 0 || monitoring.evidenceRefs.some((ref) => typeof ref !== "string" || !ref.trim())) {
    throw new Error("Monitoring evidence references are required");
  }
  assertFiniteNonNegative(baseline.baselineFch4Tch4, "baseline.baselineFch4Tch4");
  assertFiniteNonNegative(monitoring.projectEmissionsTco2e, "monitoring.projectEmissionsTco2e");
  assertFiniteNonNegative(monitoring.leakageTco2e, "monitoring.leakageTco2e");
  if (!Number.isFinite(monitoring.oxidationFactor) || monitoring.oxidationFactor < 0 || monitoring.oxidationFactor > 1) throw new Error("monitoring.oxidationFactor must be a fraction between 0 and 1");
  const input: BmWa03001Input = {
    fch4ProjectTch4: monitoring.projectMethane.fch4ProjectTch4,
    fch4BaselineTch4: baseline.baselineFch4Tch4,
    gwpCh4Tco2ePerTch4: BM_WA03001_GWP_CH4_TCO2E_PER_TCH4,
    projectEmissionsTco2e: monitoring.projectEmissionsTco2e,
    leakageTco2e: monitoring.leakageTco2e,
    oxidationFactor: monitoring.oxidationFactor,
  };
  validateBmWa03001Input(input);
  const provenance = {
    activityId: baseline.activityId,
    baselineRecordId: baseline.baselineRecordId,
    baselineRecordSha256: baseline.baselineRecordSha256.toLowerCase(),
    monitoringRecordId: monitoring.monitoringRecordId,
    monitoringPeriodId: monitoring.monitoringPeriodId,
    monitoringInputSha256: monitoring.projectMethane.inputSha256,
    monitoringOutputSha256: monitoring.projectMethane.outputSha256,
    baselineEvidenceRefs: [...baseline.baselineEvidenceRefs],
    monitoringEvidenceRefs: [...monitoring.evidenceRefs],
    input,
  };
  return {
    activityId: baseline.activityId,
    baselineRecordId: baseline.baselineRecordId,
    baselineEvidenceSha256: baseline.baselineRecordSha256.toLowerCase(),
    monitoringRecordId: monitoring.monitoringRecordId,
    monitoringPeriodId: monitoring.monitoringPeriodId,
    input,
    status: "RECONCILED_PENDING_VERIFICATION",
    provenanceSha256: sha256Canonical(provenance),
  };
}

export function isIssuableCarbonValue(status: string, issuanceEvidence?: ExternalIssuanceEvidence): boolean {
  // A completed calculation or a count of internal reviews is never proof of CCC issuance.
  return status === "ISSUED" && canClaimIssuedCarbonCredit("ISSUED", issuanceEvidence);
}
