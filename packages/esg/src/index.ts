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

/**
 * This context must be produced by a trusted, persisted-record validation path,
 * never copied from an HTTP request or accepted from the metric payload.
 */
export type AuthoritativeEsgVerification = {
  evidencePersisted: boolean;
  evidenceApproved: boolean;
  verificationPersisted: boolean;
  verifierCurrentlyAuthorized: boolean;
  organizationMatches: boolean;
  geographyMatches: boolean;
  reportingPeriodMatches: boolean;
  methodologyMatches: boolean;
  evidenceCurrentAndNotRevoked: boolean;
};

export function hasAuthoritativeEsgVerification(
  verification: AuthoritativeEsgVerification | undefined,
): boolean {
  return verification !== undefined
    && Object.values(verification).every((value) => value === true);
}

export function classifyMetric(
  metric: EsgMetric,
  verification?: AuthoritativeEsgVerification,
): EsgMetricState {
  if (!metric.code.trim() || !metric.unit.trim() || !Number.isFinite(metric.value)) {
    throw new Error("metric code, unit and finite value are required");
  }
  // Reference IDs prove only that IDs were supplied. They do not establish
  // persistence, approval, scope, period, methodology, or current authority.
  return metric.evidenceId
    && metric.verificationId
    && hasAuthoritativeEsgVerification(verification)
    ? "VERIFIED"
    : "PENDING";
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
