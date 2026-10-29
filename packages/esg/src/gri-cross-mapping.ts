export type GriApplicability = "applicable" | "not_applicable" | "conditional" | "undetermined";
export type GriEvidenceIntegrity = "unverified" | "validated" | "rejected" | "quarantined";
export type GriLineageStatus = "missing" | "partial" | "complete" | "exception";
export type GriDoubleCountingCheck = "not_run" | "passed" | "failed" | "not_applicable";

/**
 * Minimal runtime view of the versioned JSON Schema record. This evaluator is
 * deliberately advisory: it can identify review blockers, but cannot establish
 * statutory compliance, independent assurance, GRI conformity, or credit issuance.
 */
export type GriCrossMappingReviewInput = {
  status: "draft" | "reviewed" | "approved" | "deprecated" | "blocked";
  sourceRequirement: {
    version: string;
    sourceUrl: string;
    officialSourceVerifiedAt?: string | null;
  };
  targetDisclosure: {
    version: string;
    standardId: string;
    disclosureId: string;
  };
  relationship:
    | "equivalent"
    | "partial_overlap"
    | "supports"
    | "contextual"
    | "no_direct_equivalence"
    | "conflict_requires_review";
  rationale: string;
  applicability: {
    determination: GriApplicability;
    basis: string;
  };
  evidence: {
    required: boolean;
    items: Array<{ integrityStatus: GriEvidenceIntegrity }>;
    lineageStatus: GriLineageStatus;
  };
  controls: {
    doubleCountingCheck: GriDoubleCountingCheck;
    complianceConclusion: string;
    creditEligibilityConclusion: string;
  };
};

export type GriCrossMappingReviewResult = {
  decision: "BLOCKED" | "READY_FOR_HUMAN_REVIEW";
  blockers: string[];
  complianceConclusion: "NOT_CHANGED";
  creditEligibilityConclusion: "NOT_CHANGED";
};

export function evaluateGriCrossMappingForReview(
  mapping: GriCrossMappingReviewInput,
): GriCrossMappingReviewResult {
  const blockers: string[] = [];

  if (!mapping.sourceRequirement.version.trim()) blockers.push("SOURCE_VERSION_REQUIRED");
  if (!mapping.sourceRequirement.sourceUrl.trim()) blockers.push("SOURCE_URL_REQUIRED");
  if (!mapping.sourceRequirement.officialSourceVerifiedAt) blockers.push("OFFICIAL_SOURCE_VERIFICATION_REQUIRED");
  if (!mapping.targetDisclosure.version.trim()) blockers.push("TARGET_VERSION_REQUIRED");
  if (!mapping.targetDisclosure.standardId.trim() || !mapping.targetDisclosure.disclosureId.trim()) {
    blockers.push("TARGET_DISCLOSURE_ID_REQUIRED");
  }
  if (mapping.rationale.trim().length < 10) blockers.push("MAPPING_RATIONALE_INSUFFICIENT");
  if (!mapping.applicability.basis.trim()) blockers.push("APPLICABILITY_BASIS_REQUIRED");
  if (mapping.applicability.determination === "undetermined") blockers.push("APPLICABILITY_UNDETERMINED");
  if (mapping.applicability.determination === "conditional") blockers.push("CONDITIONAL_APPLICABILITY_REQUIRES_REVIEW");

  if (mapping.evidence.required && mapping.evidence.items.length === 0) {
    blockers.push("REQUIRED_EVIDENCE_MISSING");
  }
  if (mapping.evidence.required && mapping.evidence.lineageStatus !== "complete") {
    blockers.push("EVIDENCE_LINEAGE_INCOMPLETE");
  }
  if (mapping.evidence.items.some((item) => item.integrityStatus !== "validated")) {
    blockers.push("EVIDENCE_INTEGRITY_NOT_VALIDATED");
  }
  if (mapping.controls.doubleCountingCheck === "failed") blockers.push("DOUBLE_COUNTING_CHECK_FAILED");
  if (mapping.controls.doubleCountingCheck === "not_run") blockers.push("DOUBLE_COUNTING_CHECK_NOT_RUN");
  if (mapping.relationship === "conflict_requires_review") blockers.push("MAPPING_CONFLICT_REQUIRES_REVIEW");
  if (mapping.status === "blocked" || mapping.status === "deprecated") blockers.push("MAPPING_STATUS_NOT_REVIEWABLE");

  return {
    decision: blockers.length ? "BLOCKED" : "READY_FOR_HUMAN_REVIEW",
    blockers: [...new Set(blockers)],
    // This module must never derive these outcomes from a GRI mapping.
    complianceConclusion: "NOT_CHANGED",
    creditEligibilityConclusion: "NOT_CHANGED",
  };
}
