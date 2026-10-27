/**
 * ICVCM Core Carbon Principles internal control register.
 *
 * This is a readiness/evidence aid, not an ICVCM assessment, certification,
 * methodology approval, credit issuance, or substitute for applicable law.
 * Keep principle-level controls separate from Indian statutory requirements.
 */
export type CcpControlStatus = "EVIDENCED" | "GAP" | "NOT_ASSESSED";
export type CcpPrincipleAssessment = {
  principleId: string;
  status: CcpControlStatus;
  evidenceReferences?: readonly string[];
  notes?: string;
};

export const ICVCM_CCP_SOURCE_REGISTER = {
  coreCarbonPrinciples: "https://icvcm.org/core-carbon-principles/",
  assessmentFramework: "https://icvcm.org/assessment-framework/",
  assessmentStatus: "https://icvcm.org/assessment-status/",
  methodologyAssessment: "https://icvcm.org/how-we-assess-carbon-crediting-methodologies/",
  programAssessment: "https://www.icvcm.org/how-we-assess-carbon-crediting-programs/",
  approvedMethodologies: "https://icvcm.org/knowledge-resources/ccp-approved-methodologies/",
  eligibleProgramResources: "https://www.icvcm.org/knowledge-resources/eligible-program-resources/",
  applicationPlatformUpdate: "https://icvcm.org/program-application-platform-update-august-2026/",
  ruleArchitectureConsultation: "https://www.icvcm.org/consultation/ccp-rule-architecture/",
} as const;

export type IcvcmCcpPrinciple = {
  id: string;
  name: string;
  pillar: "GOVERNANCE" | "EMISSIONS_IMPACT" | "SUSTAINABLE_DEVELOPMENT";
  intendedControl: string;
};

export const ICVCM_CCP_PRINCIPLES: readonly IcvcmCcpPrinciple[] = [
  { id: "CCP-01", name: "Effective governance", pillar: "GOVERNANCE", intendedControl: "Accountable roles, approval separation, controlled changes, audit trails and continuous improvement." },
  { id: "CCP-02", name: "Tracking", pillar: "GOVERNANCE", intendedControl: "Unique identifiers and traceable lifecycle records for activities, monitoring periods, evidence and external credit references." },
  { id: "CCP-03", name: "Transparency", pillar: "GOVERNANCE", intendedControl: "Maintain accurate, accessible project disclosures while protecting personal, confidential and security-sensitive information." },
  { id: "CCP-04", name: "Robust independent third-party validation and verification", pillar: "GOVERNANCE", intendedControl: "Record independent validator/verifier identity, scope, evidence, findings, conflicts and formal decisions; AI cannot act as the independent verifier." },
  { id: "CCP-05", name: "Additionality", pillar: "EMISSIONS_IMPACT", intendedControl: "Store methodology-specific additionality tests, supporting evidence, assumptions, reviewer decision and unresolved uncertainties." },
  { id: "CCP-06", name: "Permanence", pillar: "EMISSIONS_IMPACT", intendedControl: "Assess reversal risks and document methodology-appropriate prevention, monitoring, buffer or compensation measures where applicable." },
  { id: "CCP-07", name: "Robust quantification of emission reductions and removals", pillar: "EMISSIONS_IMPACT", intendedControl: "Version methodology, baseline, factors, units, monitoring data, uncertainty, leakage, equations and reproducible calculation trace." },
  { id: "CCP-08", name: "No double counting", pillar: "EMISSIONS_IMPACT", intendedControl: "Detect duplicate registration/issuance, track ownership and transfer/retirement states, and assess double claiming under applicable rules." },
  { id: "CCP-09", name: "Sustainable development benefits and safeguards", pillar: "SUSTAINABLE_DEVELOPMENT", intendedControl: "Record environmental/social safeguards, stakeholder engagement, grievance handling, impact evidence and remediation." },
  { id: "CCP-10", name: "Contribution to net zero transition", pillar: "SUSTAINABLE_DEVELOPMENT", intendedControl: "Document a context-appropriate assessment of alignment with long-term net-zero transition and risks of locking in incompatible emissions." },
] as const;

export type CcpAssessmentResult = {
  status: "GAPS_IDENTIFIED" | "INTERNAL_EVIDENCE_CHECK_COMPLETE_PENDING_INDEPENDENT_REVIEW";
  assessedCount: number;
  evidencedCount: number;
  gapCount: number;
  notAssessedCount: number;
  controls: Array<{
    principleId: string;
    principleName: string;
    status: CcpControlStatus;
    evidenceReferences: string[];
    reasons: string[];
  }>;
  limitations: readonly string[];
};

/**
 * Assess only the completeness of the internal evidence register.
 * "EVIDENCED" requires at least one non-empty evidence reference.
 * This deliberately cannot return "ICVCM compliant", "CCP approved",
 * "certified", "verified credit", or an issuance decision.
 */
export function assessIcvcmCcpEvidence(
  assessments: readonly CcpPrincipleAssessment[],
): CcpAssessmentResult {
  const byId = new Map<string, CcpPrincipleAssessment>();
  const validIds = new Set(ICVCM_CCP_PRINCIPLES.map((item) => item.id));
  for (const assessment of assessments) {
    if (!validIds.has(assessment.principleId)) {
      throw new Error(`Unknown ICVCM CCP principle: ${assessment.principleId}`);
    }
    if (byId.has(assessment.principleId)) {
      throw new Error(`Duplicate ICVCM CCP assessment: ${assessment.principleId}`);
    }
    if (!["EVIDENCED", "GAP", "NOT_ASSESSED"].includes(assessment.status)) {
      throw new Error(`Invalid assessment status for ${assessment.principleId}`);
    }
    byId.set(assessment.principleId, assessment);
  }

  const controls = ICVCM_CCP_PRINCIPLES.map((principle) => {
    const assessment = byId.get(principle.id);
    const refs = (assessment?.evidenceReferences ?? []).map((value) => value.trim()).filter(Boolean);
    const reasons: string[] = [];
    let status: CcpControlStatus = assessment?.status ?? "NOT_ASSESSED";
    if (!assessment) reasons.push("No assessment record supplied.");
    if (status === "EVIDENCED" && refs.length === 0) {
      status = "GAP";
      reasons.push("Evidence reference is required for an EVIDENCED status.");
    }
    if (status === "GAP") reasons.push(assessment?.notes?.trim() || "Control gap requires resolution or documented disposition.");
    if (status === "NOT_ASSESSED") reasons.push(assessment?.notes?.trim() || "Control has not been assessed.");
    return { principleId: principle.id, principleName: principle.name, status, evidenceReferences: refs, reasons };
  });

  const evidencedCount = controls.filter((item) => item.status === "EVIDENCED").length;
  const gapCount = controls.filter((item) => item.status === "GAP").length;
  const notAssessedCount = controls.filter((item) => item.status === "NOT_ASSESSED").length;
  const status = evidencedCount === ICVCM_CCP_PRINCIPLES.length
    ? "INTERNAL_EVIDENCE_CHECK_COMPLETE_PENDING_INDEPENDENT_REVIEW"
    : "GAPS_IDENTIFIED";

  return {
    status,
    assessedCount: controls.filter((item) => item.status !== "NOT_ASSESSED").length,
    evidencedCount,
    gapCount,
    notAssessedCount,
    controls,
    limitations: [
      "This is an internal evidence-register completeness check only; it is not an ICVCM assessment or certification.",
      "ICVCM assessment applies to carbon-crediting programs and categories/methodologies under its published framework; implementing this module does not confer CCP eligibility or a CCP label.",
      "Applicable Indian statutory/regulatory requirements remain a separate mandatory gate and must be evaluated for the specific activity and jurisdiction.",
      "RupayKg records and supports MRV workflows; it does not itself issue government or registry carbon credits.",
      "AI-assisted review cannot replace independent third-party validation/verification or authorized decisions.",
    ],
  };
}
