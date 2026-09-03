import { createHash } from "node:crypto";

export type CarbonInput = {
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

export type BmWa03001Result = {
  methodologyCode: "BM WA03.001";
  methodologyVersion: "1.0";
  resultTco2e: number;
  status: "CALCULATED_PENDING_VERIFICATION";
  trace: CarbonTraceStep[];
};

export const BM_WA03001_SOURCE = {
  reference: "https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf",
  publicationDate: "2025-03-27",
  version: "1.0",
  sector: "Waste Handling and Disposal",
  equation: "ERy,calculated = (FCH4,PJ,y - FCH4,BL,y) × GWPCH4 × (1 - OX) - PEy - LEy",
  equationId: "BM.WA03.001.EQ4.V1",
} as const;

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

export function calculateEmissionReduction(input: CarbonInput): CarbonResult {
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${key} must be a finite non-negative number`);
    }
  }
  if (!input.activityId.trim()) throw new Error("activityId is required");
  if (!input.methodologyCode.trim() || !input.methodologyVersion.trim()) {
    throw new Error("methodologyCode and methodologyVersion are required");
  }
  const leakage = input.leakageTco2e ?? 0;
  const uncertainty = input.uncertaintyTco2e ?? 0;
  const normalizedInputs: Required<CarbonInput> = {
    activityId: input.activityId.trim(),
    methodologyCode: input.methodologyCode.trim(),
    methodologyVersion: input.methodologyVersion.trim(),
    baselineTco2e: input.baselineTco2e,
    projectTco2e: input.projectTco2e,
    leakageTco2e: leakage,
    uncertaintyTco2e: uncertainty,
  };
  const gross = normalizedInputs.baselineTco2e - normalizedInputs.projectTco2e;
  const netBeforeFloor = gross - leakage;
  const net = Math.max(0, netBeforeFloor);
  return {
    grossReductionTco2e: gross,
    netReductionTco2e: net,
    uncertaintyTco2e: uncertainty,
    status: "CALCULATED_PENDING_VERIFICATION",
    normalizedInputs,
    trace: [
      { equationId: "CARBON.GROSS_REDUCTION.V1", inputs: { baselineTco2e: normalizedInputs.baselineTco2e, projectTco2e: normalizedInputs.projectTco2e }, result: gross },
      { equationId: "CARBON.NET_REDUCTION.V1", inputs: { grossReductionTco2e: gross, leakageTco2e: leakage }, result: netBeforeFloor },
      { equationId: "CARBON.NET_NON_NEGATIVE_FLOOR.V1", inputs: { netBeforeFloor }, result: net },
    ],
  };
}

/**
 * Implements the actual annual BM WA03.001 Equation (4) once its dependent
 * monitored quantities/tools have been independently established. It does not
 * implement BM-T-011, BM-T-004, BM-T-003 or additionality; callers must supply
 * their authoritative outputs and retain their evidence separately.
 */
export function calculateBmWa03001(input: BmWa03001Input): BmWa03001Result {
  for (const [key, value] of Object.entries(input)) assertFiniteNonNegative(value, key);
  if (input.oxidationFactor > 1) throw new Error("oxidationFactor must be between 0 and 1");
  if (input.gwpCh4Tco2ePerTch4 === 0) throw new Error("gwpCh4Tco2ePerTch4 must be greater than zero");

  const methaneDelta = input.fch4ProjectTch4 - input.fch4BaselineTch4;
  const oxidationAdjusted = methaneDelta * input.gwpCh4Tco2ePerTch4 * (1 - input.oxidationFactor);
  const result = oxidationAdjusted - input.projectEmissionsTco2e - input.leakageTco2e;

  return {
    methodologyCode: "BM WA03.001",
    methodologyVersion: "1.0",
    resultTco2e: result,
    status: "CALCULATED_PENDING_VERIFICATION",
    trace: [
      { equationId: "BM.WA03.001.EQ4.METHANE_DELTA.V1", inputs: { fch4ProjectTch4: input.fch4ProjectTch4, fch4BaselineTch4: input.fch4BaselineTch4 }, result: methaneDelta },
      { equationId: "BM.WA03.001.EQ4.OXIDATION_ADJUSTMENT.V1", inputs: { methaneDelta, gwpCh4Tco2ePerTch4: input.gwpCh4Tco2ePerTch4, oxidationFactor: input.oxidationFactor }, result: oxidationAdjusted },
      { equationId: "BM.WA03.001.EQ4.PROJECT_AND_LEAKAGE_DEDUCTION.V1", inputs: { oxidationAdjusted, projectEmissionsTco2e: input.projectEmissionsTco2e, leakageTco2e: input.leakageTco2e }, result },
    ],
  };
}

export function isIssuableCarbonValue(status: string, verificationCount: number): boolean {
  return status === "CALCULATED_PENDING_VERIFICATION" && verificationCount > 0;
}
