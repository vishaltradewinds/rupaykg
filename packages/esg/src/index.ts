export type EsgMetric = {
  code: string;
  scope: "1" | "2" | "3" | "IMPACT";
  value: number;
  unit: string;
  evidenceId?: string;
  verificationId?: string;
};

export type EsgMetricState = "VERIFIED" | "PENDING";

export function classifyMetric(metric: EsgMetric): EsgMetricState {
  if (!metric.code.trim() || !metric.unit.trim() || !Number.isFinite(metric.value)) {
    throw new Error("metric code, unit and finite value are required");
  }
  return metric.evidenceId && metric.verificationId ? "VERIFIED" : "PENDING";
}

export function buildDisclosure(metrics: EsgMetric[]): { metrics: Array<EsgMetric & { state: EsgMetricState }> } {
  return { metrics: metrics.map((metric) => ({ ...metric, state: classifyMetric(metric) })) };
}
