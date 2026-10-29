export type GriApplicability = "applicable" | "not_applicable" | "conditional" | "undetermined";
export type GriEvidenceIntegrity = "unverified" | "validated" | "rejected" | "quarantined";
export type GriLineageStatus = "missing" | "partial" | "complete" | "exception";
export type GriDoubleCountingCheck = "not_run" | "passed" | "failed" | "not_applicable";
export type GriSourceValidationStatus = "DISCOVERY_SOURCE" | "NOT_ARCHIVED_HASH_PENDING" | "CURRENT_VERSION_MUST_BE_RECONFIRMED" | "VERIFIED_AND_APPROVED" | "UNRESOLVED";

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
    sourceValidation: { status: GriSourceValidationStatus; sourceId: string; sha256: string | null };
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
    source_validation: { status: GriSourceValidationStatus; source_id: string; sha256: string | null };
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
      sourceValidation: { status: record.source_requirement.source_validation.status, sourceId: record.source_requirement.source_validation.source_id, sha256: record.source_requirement.source_validation.sha256 },
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

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    // Reject HTTPS URLs with embedded credentials: they can visually disguise
    // the actual host and must not be accepted as authoritative-source links.
    return url.protocol === "https:" &&
      url.hostname.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0;
  } catch {
    return false;
  }
}

function isValidIsoDateTime(value: string): boolean {
  // Require an explicit timezone so the verification timestamp is unambiguous.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return false;
  }
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

export function evaluateGriCrossMappingForReview(
  mapping: GriCrossMappingReviewInput,
): GriCrossMappingReviewResult {
  const blockers: string[] = [];

  if (!mapping.sourceRequirement.version.trim()) blockers.push("SOURCE_VERSION_REQUIRED");
  if (!mapping.sourceRequirement.sourceValidation.sourceId.trim()) blockers.push("SOURCE_REGISTER_ID_REQUIRED");
  if (mapping.sourceRequirement.sourceValidation.status !== "VERIFIED_AND_APPROVED" || !mapping.sourceRequirement.sourceValidation.sha256 || !/^[a-fA-F0-9]{64}$/.test(mapping.sourceRequirement.sourceValidation.sha256)) {
    blockers.push("AUTHORITATIVE_SOURCE_NOT_VERIFIED_AND_ARCHIVED");
  }
  if (!mapping.sourceRequirement.sourceUrl.trim()) blockers.push("SOURCE_URL_REQUIRED");
  else if (!isHttpsUrl(mapping.sourceRequirement.sourceUrl)) blockers.push("SOURCE_URL_INVALID");
  if (!mapping.sourceRequirement.officialSourceVerifiedAt) {
    blockers.push("OFFICIAL_SOURCE_VERIFICATION_REQUIRED");
  } else if (!isValidIsoDateTime(mapping.sourceRequirement.officialSourceVerifiedAt)) {
    blockers.push("OFFICIAL_SOURCE_VERIFICATION_TIMESTAMP_INVALID");
  }
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
  if (mapping.status === "approved") blockers.push("APPROVED_MAPPING_IMMUTABLE_VERSION_REQUIRED");
  if (mapping.status === "blocked" || mapping.status === "deprecated") blockers.push("MAPPING_STATUS_NOT_REVIEWABLE");

  return {
    decision: blockers.length ? "BLOCKED" : "READY_FOR_HUMAN_REVIEW",
    blockers: [...new Set(blockers)],
    // This module must never derive these outcomes from a GRI mapping.
    complianceConclusion: "NOT_CHANGED",
    creditEligibilityConclusion: "NOT_CHANGED",
  };
}

/**
 * Server-side binding check between a submitted mapping and a trusted,
 * version-pinned registry record. The registry record must be loaded by the
 * server from an approved source; never pass client-supplied registry data here.
 * This pure function does not fetch URLs or establish registry authenticity.
 */
export type TrustedGriSourceRegistryRecord = {
  sourceId: string;
  canonicalUrl: string;
  version: string;
  sha256: string;
  validationStatus: GriSourceValidationStatus;
  /** Registry-wide activation gate; research-only registries must never authorize mappings. */
  registryStatus: "RESEARCH_ONLY" | "ACTIVE" | "SUSPENDED";
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export type GriSourceBindingInput = {
  sourceId: string;
  sourceUrl: string;
  sourceVersion: string;
  sha256: string | null;
};

function isValidIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function validateGriSourceBinding(
  submitted: GriSourceBindingInput,
  trusted: TrustedGriSourceRegistryRecord | null,
): { valid: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!trusted) {
    blockers.push("TRUSTED_SOURCE_REGISTER_RECORD_NOT_FOUND");
    return { valid: false, blockers };
  }
  if (trusted.registryStatus !== "ACTIVE") {
    blockers.push("TRUSTED_SOURCE_REGISTER_NOT_ACTIVE");
  }
  if (trusted.validationStatus !== "VERIFIED_AND_APPROVED") {
    blockers.push("TRUSTED_SOURCE_REGISTER_RECORD_NOT_APPROVED");
  }
  if (trusted.effectiveFrom != null && !/^\d{4}-\d{2}-\d{2}$/.test(trusted.effectiveFrom)) {
    blockers.push("TRUSTED_SOURCE_EFFECTIVE_FROM_INVALID");
  }
  if (trusted.effectiveTo != null && !/^\d{4}-\d{2}-\d{2}$/.test(trusted.effectiveTo)) {
    blockers.push("TRUSTED_SOURCE_EFFECTIVE_TO_INVALID");
  }
  if (trusted.effectiveFrom && trusted.effectiveTo && trusted.effectiveFrom > trusted.effectiveTo) {
    blockers.push("TRUSTED_SOURCE_EFFECTIVE_DATE_RANGE_INVALID");
  }
  if (!/^[a-fA-F0-9]{64}$/.test(trusted.sha256)) {
    blockers.push("TRUSTED_SOURCE_REGISTER_HASH_INVALID");
  }
  if (!submitted.sourceId.trim() || submitted.sourceId !== trusted.sourceId) {
    blockers.push("SOURCE_REGISTER_ID_MISMATCH");
  }
  if (!submitted.sourceUrl.trim() || submitted.sourceUrl !== trusted.canonicalUrl) {
    blockers.push("SOURCE_CANONICAL_URL_MISMATCH");
  }
  if (!submitted.sourceVersion.trim() || submitted.sourceVersion !== trusted.version) {
    blockers.push("SOURCE_VERSION_MISMATCH");
  }
  if (
    !submitted.sha256 ||
    !/^[a-fA-F0-9]{64}$/.test(submitted.sha256) ||
    !/^[a-fA-F0-9]{64}$/.test(trusted.sha256) ||
    submitted.sha256.toLowerCase() !== trusted.sha256.toLowerCase()
  ) {
    blockers.push("SOURCE_ARCHIVE_HASH_MISMATCH");
  }
  return { valid: blockers.length === 0, blockers: [...new Set(blockers)] };
}
