export type EsgFramework = "BRSR" | "BRSR_CORE" | "BRSR_VALUE_CHAIN" | "INTERNAL_ESG";
export type EsgAssuranceStatus = "PENDING" | "ASSESSMENT_READY" | "ASSESSED" | "ASSURANCE_READY" | "ASSURED" | "NOT_REQUIRED";

export type EsgMetric = {
  code: string;
  scope: "1" | "2" | "3" | "IMPACT";
  value: number;
  unit: string;
  evidenceId?: string;
  verificationId?: string;
  disclosureId?: string;
  esgAttribute?: string;
  valueChainDirection?: "UPSTREAM" | "DOWNSTREAM" | "BOTH";
  methodology?: string;
  assumptions?: string;
  reportingBoundary?: string;
  dataQuality?: string;
  assuranceStatus?: EsgAssuranceStatus;
};

export type EsgMetricState = "VERIFIED" | "PENDING";

export function classifyMetric(metric: EsgMetric): EsgMetricState {
  if (!metric.code.trim() || !metric.unit.trim() || !Number.isFinite(metric.value)) {
    throw new Error("metric code, unit and finite value are required");
  }
  return metric.evidenceId && metric.verificationId ? "VERIFIED" : "PENDING";
}

export function validateEsgFramework(framework: string): EsgFramework {
  if (!["BRSR", "BRSR_CORE", "BRSR_VALUE_CHAIN", "INTERNAL_ESG"].includes(framework)) {
    throw new Error("unsupported ESG reporting framework");
  }
  return framework as EsgFramework;
}

export function buildDisclosure(metrics: EsgMetric[]): { metrics: Array<EsgMetric & { state: EsgMetricState }> } {
  return { metrics: metrics.map((metric) => ({ ...metric, state: classifyMetric(metric) })) };
}
