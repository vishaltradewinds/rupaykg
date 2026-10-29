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

/**
 * Snake-case projection of the persisted JSON Schema fields used by the review
 * gate. Callers must validate the complete record against the JSON Schema before
 * adapting it; this type is not a substitute for runtime schema validation.
 */
export type GriCrossMappingSchemaProjection = {
  status: GriCrossMappingReviewInput["status"];
  source_requirement: {
    version: string;
    source_url: string;
    official_source_verified_at?: string | null;
  };
  target_disclosure: {
    version: string;
    standard_id: string;
    disclosure_id: string;
  };
  relationship: GriCrossMappingReviewInput["relationship"];
  rationale: string;
  applicability: {
    determination: GriApplicability;
    basis: string;
  };
  evidence: {
    required: boolean;
    items: Array<{ integrity_status: GriEvidenceIntegrity }>;
    lineage_status: GriLineageStatus;
  };
  controls: {
    double_counting_check: GriDoubleCountingCheck;
    compliance_conclusion: string;
    credit_eligibility_conclusion: string;
  };
};

/** Map the schema's persisted snake_case representation to the internal review DTO. */
export function toGriCrossMappingReviewInput(
  record: GriCrossMappingSchemaProjection,
): GriCrossMappingReviewInput {
  return {
    status: record.status,
    sourceRequirement: {
      version: record.source_requirement.version,
      sourceUrl: record.source_requirement.source_url,
      officialSourceVerifiedAt: record.source_requirement.official_source_verified_at,
    },
    targetDisclosure: {
      version: record.target_disclosure.version,
      standardId: record.target_disclosure.standard_id,
      disclosureId: record.target_disclosure.disclosure_id,
    },
    relationship: record.relationship,
    rationale: record.rationale,
    applicability: {
      determination: record.applicability.determination,
      basis: record.applicability.basis,
    },
    evidence: {
      required: record.evidence.required,
      items: record.evidence.items.map((item) => ({ integrityStatus: item.integrity_status })),
      lineageStatus: record.evidence.lineage_status,
    },
    controls: {
      doubleCountingCheck: record.controls.double_counting_check,
      complianceConclusion: record.controls.compliance_conclusion,
      creditEligibilityConclusion: record.controls.credit_eligibility_conclusion,
    },
  };
}

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
