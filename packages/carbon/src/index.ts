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

export function isIssuableCarbonValue(status: string, verificationCount: number): boolean {
  return status === "CALCULATED_PENDING_VERIFICATION" && verificationCount > 0;
}
