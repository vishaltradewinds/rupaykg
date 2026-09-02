export type CarbonInput = {
  activityId: string;
  methodologyCode: string;
  methodologyVersion: string;
  baselineTco2e: number;
  projectTco2e: number;
  leakageTco2e?: number;
  uncertaintyTco2e?: number;
};

export type CarbonResult = {
  grossReductionTco2e: number;
  netReductionTco2e: number;
  uncertaintyTco2e: number;
  status: "CALCULATED_PENDING_VERIFICATION";
};

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
  const gross = input.baselineTco2e - input.projectTco2e;
  const net = Math.max(0, gross - leakage);
  return {
    grossReductionTco2e: gross,
    netReductionTco2e: net,
    uncertaintyTco2e: uncertainty,
    status: "CALCULATED_PENDING_VERIFICATION",
  };
}

export function isIssuableCarbonValue(status: string, verificationCount: number): boolean {
  return status === "CALCULATED_PENDING_VERIFICATION" && verificationCount > 0;
}
