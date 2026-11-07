import { createHash } from "node:crypto";

export const BM_T011_VERSION = "1.0" as const;
export const BM_T011_SOURCE_URL = "https://beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-39324557592c02c2_1776061640.pdf";
export const BM_T011_GWP_CH4_TCO2E_PER_TCH4 = 29.8;

export type BmT011ClimateClass = "TROPICAL_DRY" | "TROPICAL_WET" | "TEMPERATE_DRY" | "TEMPERATE_WET";
export type BmT011WasteType =
  | "WOOD_AND_WOOD_PRODUCTS"
  | "PULP_PAPER_CARDBOARD"
  | "FOOD_BEVERAGES_TOBACCO"
  | "TEXTILES"
  | "GARDEN_PARK_WASTE"
  | "GLASS_PLASTIC_METAL_INERT";
export type BmT011CalculationMode = "WA03_001_BASELINE_POTENTIAL" | "PROJECT_OR_LEAKAGE";

export interface BmT011AnnualWasteRecord {
  /** Sequential year index since the first year in the selected calculation period (x = 1...y). */
  yearIndex: number;
  wasteType: BmT011WasteType;
  /** Wet-basis tonnes, derived from SWDS owner/admin records for Application A. */
  massWetTonnes: number;
  evidenceRefs: string[];
}

export interface BmT011AnnualInput {
  activityId: string;
  calculationPeriodId: string;
  targetYearIndex: number;
  calculationMode: BmT011CalculationMode;
  climateClass: BmT011ClimateClass;
  swdsType: "ANAEROBIC_MANAGED" | "SEMI_AEROBIC_MANAGED" | "UNMANAGED_DEEP" | "UNMANAGED_SHALLOW";
  wasteRecords: BmT011AnnualWasteRecord[];
  /** For project/leakage only; fraction of methane captured, flared/combusted/used. */
  capturedFraction?: number;
  parameterEvidenceRefs: string[];
}

export interface BmT011AnnualResult {
  status: "CALCULATED_PENDING_VERIFICATION";
  method: "BM-T-011.V1.0.ANNUAL_FOD.APPLICATION_A";
  version: "1.0";
  sourceUrl: string;
  activityId: string;
  calculationPeriodId: string;
  targetYearIndex: number;
  emissionsTco2e: number;
  parameters: {
    modelCorrectionFactor: number;
    capturedFraction: number;
    gwpCh4Tco2ePerTch4: number;
    oxidationFactor: number;
    methaneFraction: number;
    docf: number;
    mcf: number;
    climateClass: BmT011ClimateClass;
    swdsType: BmT011Input["swdsType"];
  };
  trace: Array<{
    yearIndex: number;
    wasteType: BmT011WasteType;
    massWetTonnes: number;
    docFraction: number;
    decayRatePerYear: number;
    decayTerm: number;
    methanePotentialTermTco2e: number;
    evidenceRefs: string[];
  }>;
  evidenceRefs: string[];
  inputSha256: string;
  outputSha256: string;
}

type BmT011Input = BmT011AnnualInput;

const DOC: Record<BmT011WasteType, number> = {
  WOOD_AND_WOOD_PRODUCTS: 0.43,
  PULP_PAPER_CARDBOARD: 0.40,
  FOOD_BEVERAGES_TOBACCO: 0.15,
  TEXTILES: 0.24,
  GARDEN_PARK_WASTE: 0.20,
  GLASS_PLASTIC_METAL_INERT: 0,
};

const DECAY: Record<BmT011ClimateClass, Record<BmT011WasteType, number>> = {
  TROPICAL_DRY: {
    WOOD_AND_WOOD_PRODUCTS: 0.02, PULP_PAPER_CARDBOARD: 0.04, FOOD_BEVERAGES_TOBACCO: 0.06,
    TEXTILES: 0.04, GARDEN_PARK_WASTE: 0.05, GLASS_PLASTIC_METAL_INERT: 0,
  },
  TROPICAL_WET: {
    WOOD_AND_WOOD_PRODUCTS: 0.03, PULP_PAPER_CARDBOARD: 0.06, FOOD_BEVERAGES_TOBACCO: 0.185,
    TEXTILES: 0.06, GARDEN_PARK_WASTE: 0.10, GLASS_PLASTIC_METAL_INERT: 0,
  },
  TEMPERATE_DRY: {
    WOOD_AND_WOOD_PRODUCTS: 0.025, PULP_PAPER_CARDBOARD: 0.045, FOOD_BEVERAGES_TOBACCO: 0.085,
    TEXTILES: 0.045, GARDEN_PARK_WASTE: 0.065, GLASS_PLASTIC_METAL_INERT: 0,
  },
  TEMPERATE_WET: {
    WOOD_AND_WOOD_PRODUCTS: 0.035, PULP_PAPER_CARDBOARD: 0.07, FOOD_BEVERAGES_TOBACCO: 0.40,
    TEXTILES: 0.07, GARDEN_PARK_WASTE: 0.17, GLASS_PLASTIC_METAL_INERT: 0,
  },
};

const MCF: Record<BmT011Input["swdsType"], number> = {
  ANAEROBIC_MANAGED: 1.0,
  SEMI_AEROBIC_MANAGED: 0.5,
  UNMANAGED_DEEP: 0.8,
  UNMANAGED_SHALLOW: 0.4,
};

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => JSON.stringify(key) + ":" + canonical(child)).join(",") + "}";
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function finiteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative`);
}

export function calculateBmT011Annual(input: BmT011AnnualInput): BmT011AnnualResult {
  if (!input.activityId.trim() || !input.calculationPeriodId.trim()) throw new Error("BM-T-011 activityId and calculationPeriodId are required");
  if (!Number.isSafeInteger(input.targetYearIndex) || input.targetYearIndex < 1 || input.targetYearIndex > 100) throw new Error("BM-T-011 targetYearIndex must be an integer from 1 to 100");
  if (!["TROPICAL_DRY", "TROPICAL_WET", "TEMPERATE_DRY", "TEMPERATE_WET"].includes(input.climateClass)) throw new Error("BM-T-011 climate class must be explicitly selected from the official table");
  if (!(input.swdsType in MCF)) throw new Error("BM-T-011 SWDS type must be explicitly selected");
  if (!Array.isArray(input.wasteRecords) || input.wasteRecords.length === 0 || input.wasteRecords.length > 1000) throw new Error("BM-T-011 requires 1-1000 waste records");
  if (!Array.isArray(input.parameterEvidenceRefs) || input.parameterEvidenceRefs.length === 0 || input.parameterEvidenceRefs.some(ref => typeof ref !== "string" || !ref.trim())) throw new Error("BM-T-011 parameter evidence references are required");
  const capturedFraction = input.calculationMode === "WA03_001_BASELINE_POTENTIAL" ? 0 : input.capturedFraction;
  if (input.calculationMode === "WA03_001_BASELINE_POTENTIAL" && input.capturedFraction !== undefined && input.capturedFraction !== 0) {
    throw new Error("BM WA03.001 baseline-potential mode requires f=0; capture obligations are handled separately by the methodology");
  }
  if (input.calculationMode === "PROJECT_OR_LEAKAGE" && (capturedFraction === undefined || !Number.isFinite(capturedFraction) || capturedFraction < 0 || capturedFraction > 1)) {
    throw new Error("BM-T-011 project/leakage mode requires capturedFraction in [0,1]");
  }
  const recordKeys = new Set<string>();
  const yearsWithWaste = new Set<number>();
  for (const record of input.wasteRecords) {
    if (!Number.isSafeInteger(record.yearIndex) || record.yearIndex < 1 || record.yearIndex > input.targetYearIndex) throw new Error("Waste yearIndex must fall within 1..targetYearIndex");
    finiteNonNegative(record.massWetTonnes, "massWetTonnes");
    if (!(record.wasteType in DOC)) throw new Error("Waste type is not in the BM-T-011 v1.0 MSW category table");
    if (!Array.isArray(record.evidenceRefs) || record.evidenceRefs.length === 0 || record.evidenceRefs.some(ref => typeof ref !== "string" || !ref.trim())) throw new Error("Every waste record requires source evidence references");
    const key = `${record.yearIndex}:${record.wasteType}`;
    if (recordKeys.has(key)) throw new Error("Duplicate yearIndex/wasteType record; aggregate each waste type once per year");
    recordKeys.add(key);
    yearsWithWaste.add(record.yearIndex);
  }
  for (let year = 1; year <= input.targetYearIndex; year++) {
    if (!yearsWithWaste.has(year)) throw new Error(`BM-T-011 waste history must be contiguous; missing year ${year}`);
  }

  // BEE BM-T-011 v1.0 annual Equation (1). Application A only.
  // phi=0.75 for baseline application A; phi=1 for project/leakage.
  const modelCorrectionFactor = input.calculationMode === "WA03_001_BASELINE_POTENTIAL" ? 0.75 : 1;
  const oxidationFactor = 0.1;
  const methaneFraction = 0.5;
  const docf = 0.5;
  const mcf = MCF[input.swdsType];
  const f = capturedFraction!;
  const trace: BmT011AnnualResult["trace"] = [];
  for (const record of [...input.wasteRecords].sort((a, b) => a.yearIndex - b.yearIndex || a.wasteType.localeCompare(b.wasteType))) {
    const docFraction = DOC[record.wasteType];
    const decayRatePerYear = DECAY[input.climateClass][record.wasteType];
    const decayTerm = Math.exp(-decayRatePerYear * (input.targetYearIndex - record.yearIndex)) * (1 - Math.exp(-decayRatePerYear));
    const methanePotentialTermTco2e = modelCorrectionFactor * (1 - f) * BM_T011_GWP_CH4_TCO2E_PER_TCH4 *
      (1 - oxidationFactor) * (16 / 12) * methaneFraction * docf * mcf *
      (record.massWetTonnes * docFraction * decayTerm);
    trace.push({ yearIndex: record.yearIndex, wasteType: record.wasteType, massWetTonnes: record.massWetTonnes,
      docFraction, decayRatePerYear, decayTerm, methanePotentialTermTco2e, evidenceRefs: [...record.evidenceRefs].sort() });
  }
  const emissionsTco2e = trace.reduce((sum, item) => sum + item.methanePotentialTermTco2e, 0);
  finiteNonNegative(emissionsTco2e, "emissionsTco2e");
  const evidenceRefs = [...new Set([...input.parameterEvidenceRefs, ...input.wasteRecords.flatMap(record => record.evidenceRefs)])].sort();
  const inputSha256 = sha256({ ...input, capturedFraction: f, modelCorrectionFactor, oxidationFactor, methaneFraction, docf, mcf, sourceUrl: BM_T011_SOURCE_URL, version: BM_T011_VERSION });
  const outputCore = { activityId: input.activityId, calculationPeriodId: input.calculationPeriodId, targetYearIndex: input.targetYearIndex,
    emissionsTco2e, parameters: { modelCorrectionFactor, capturedFraction: f, gwpCh4Tco2ePerTch4: BM_T011_GWP_CH4_TCO2E_PER_TCH4,
      oxidationFactor, methaneFraction, docf, mcf, climateClass: input.climateClass, swdsType: input.swdsType }, trace, evidenceRefs, inputSha256 };
  return { status: "CALCULATED_PENDING_VERIFICATION", method: "BM-T-011.V1.0.ANNUAL_FOD.APPLICATION_A", version: "1.0",
    sourceUrl: BM_T011_SOURCE_URL, activityId: input.activityId, calculationPeriodId: input.calculationPeriodId,
    targetYearIndex: input.targetYearIndex, emissionsTco2e, parameters: outputCore.parameters, trace, evidenceRefs,
    inputSha256, outputSha256: sha256(outputCore) };
}
