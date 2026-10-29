import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateGriCrossMappingForReview,
  toGriCrossMappingReviewInput,
  type GriCrossMappingReviewInput,
  type GriCrossMappingSchemaProjection,
} from "./gri-cross-mapping.js";

const validReviewInput: GriCrossMappingReviewInput = {
  status: "draft",
  sourceRequirement: {
    version: "2026-01",
    sourceUrl: "https://example.gov.in/regulation",
    officialSourceVerifiedAt: "2026-10-29T10:00:00Z",
    sourceValidation: { status: "VERIFIED_AND_APPROVED", sourceId: "TEST-SOURCE-001", sha256: "a".repeat(64) },
  },
  targetDisclosure: { version: "GRI 306: Waste 2020", standardId: "GRI 306", disclosureId: "306-3" },
  relationship: "supports",
  rationale: "Waste activity evidence can support, but does not replace, the disclosure.",
  applicability: { determination: "applicable", basis: "Documented materiality and entity review." },
  evidence: { required: true, items: [{ integrityStatus: "validated" }], lineageStatus: "complete" },
  controls: {
    doubleCountingCheck: "passed",
    complianceConclusion: "not_assessed",
    creditEligibilityConclusion: "not_assessed",
  },
};

test("GRI mapping evaluator only clears records for human review", () => {
  const result = evaluateGriCrossMappingForReview(validReviewInput);
  assert.equal(result.decision, "READY_FOR_HUMAN_REVIEW");
  assert.deepEqual(result.blockers, []);
  assert.equal(result.complianceConclusion, "NOT_CHANGED");
  assert.equal(result.creditEligibilityConclusion, "NOT_CHANGED");
});

test("undetermined applicability and incomplete evidence fail closed", () => {
  const result = evaluateGriCrossMappingForReview({
    ...validReviewInput,
    applicability: { determination: "undetermined", basis: "Not assessed yet." },
    evidence: { required: true, items: [{ integrityStatus: "unverified" }], lineageStatus: "partial" },
    controls: { ...validReviewInput.controls, doubleCountingCheck: "not_run" },
  });
  assert.equal(result.decision, "BLOCKED");
  assert.ok(result.blockers.includes("APPLICABILITY_UNDETERMINED"));
  assert.ok(result.blockers.includes("EVIDENCE_LINEAGE_INCOMPLETE"));
  assert.ok(result.blockers.includes("EVIDENCE_INTEGRITY_NOT_VALIDATED"));
  assert.ok(result.blockers.includes("DOUBLE_COUNTING_CHECK_NOT_RUN"));
});

test("GRI relationship cannot override Indian compliance or credit eligibility conclusions", () => {
  const result = evaluateGriCrossMappingForReview({
    ...validReviewInput,
    relationship: "equivalent",
    controls: {
      ...validReviewInput.controls,
      complianceConclusion: "compliant",
      creditEligibilityConclusion: "independently_verified",
    },
  });
  assert.equal(result.decision, "READY_FOR_HUMAN_REVIEW");
  assert.equal(result.complianceConclusion, "NOT_CHANGED");
  assert.equal(result.creditEligibilityConclusion, "NOT_CHANGED");
});

test("conflicts and conditional applicability require review", () => {
  const result = evaluateGriCrossMappingForReview({
    ...validReviewInput,
    relationship: "conflict_requires_review",
    applicability: { determination: "conditional", basis: "Threshold confirmation required." },
  });
  assert.equal(result.decision, "BLOCKED");
  assert.ok(result.blockers.includes("CONDITIONAL_APPLICABILITY_REQUIRES_REVIEW"));
  assert.ok(result.blockers.includes("MAPPING_CONFLICT_REQUIRES_REVIEW"));
});

test("schema snake_case fields adapt without changing compliance or credit conclusions", () => {
  const record: GriCrossMappingSchemaProjection = {
    status: "draft",
    source_requirement: {
      version: "2026-01",
      source_url: "https://example.gov.in/regulation",
      official_source_verified_at: "2026-10-29T10:00:00Z",
      source_validation: { status: "VERIFIED_AND_APPROVED", source_id: "TEST-SOURCE-001", sha256: "a".repeat(64) },
    },
    target_disclosure: {
      version: "GRI 306: Waste 2020",
      standard_id: "GRI 306",
      disclosure_id: "306-3",
    },
    relationship: "supports",
    rationale: "Waste activity evidence supports but does not replace the disclosure.",
    applicability: { determination: "applicable", basis: "Documented materiality and entity review." },
    evidence: {
      required: true,
      items: [{ integrity_status: "validated" }],
      lineage_status: "complete",
    },
    controls: {
      double_counting_check: "passed",
      compliance_conclusion: "not_assessed",
      credit_eligibility_conclusion: "not_assessed",
    },
  };

  const adapted = toGriCrossMappingReviewInput(record);
  const result = evaluateGriCrossMappingForReview(adapted);
  assert.equal(adapted.sourceRequirement.sourceUrl, record.source_requirement.source_url);
  assert.equal(adapted.targetDisclosure.disclosureId, record.target_disclosure.disclosure_id);
  assert.equal(result.decision, "READY_FOR_HUMAN_REVIEW");
  assert.equal(result.complianceConclusion, "NOT_CHANGED");
  assert.equal(result.creditEligibilityConclusion, "NOT_CHANGED");
});

test("approved mappings require a versioned change instead of being reopened in place", () => {
  const result = evaluateGriCrossMappingForReview({
    ...validReviewInput,
    status: "approved",
  });
  assert.equal(result.decision, "BLOCKED");
  assert.ok(result.blockers.includes("APPROVED_MAPPING_IMMUTABLE_VERSION_REQUIRED"));
});


test("missing source version, target version and rationale block human review", () => {
  const result = evaluateGriCrossMappingForReview({
    ...validReviewInput,
    sourceRequirement: { ...validReviewInput.sourceRequirement, version: " " },
    targetDisclosure: { ...validReviewInput.targetDisclosure, version: "" },
    rationale: "short",
  });
  assert.equal(result.decision, "BLOCKED");
  assert.ok(result.blockers.includes("SOURCE_VERSION_REQUIRED"));
  assert.ok(result.blockers.includes("TARGET_VERSION_REQUIRED"));
  assert.ok(result.blockers.includes("MAPPING_RATIONALE_INSUFFICIENT"));
});

test("rejected or quarantined evidence blocks the mapping even with complete lineage", () => {
  for (const integrityStatus of ["rejected", "quarantined"] as const) {
    const result = evaluateGriCrossMappingForReview({
      ...validReviewInput,
      evidence: {
        required: true,
        items: [{ integrityStatus }],
        lineageStatus: "complete",
      },
    });
    assert.equal(result.decision, "BLOCKED");
    assert.ok(result.blockers.includes("EVIDENCE_INTEGRITY_NOT_VALIDATED"));
  }
});

test("failed double-counting checks and non-reviewable lifecycle states block", () => {
  const doubleCount = evaluateGriCrossMappingForReview({
    ...validReviewInput,
    controls: { ...validReviewInput.controls, doubleCountingCheck: "failed" },
  });
  assert.equal(doubleCount.decision, "BLOCKED");
  assert.ok(doubleCount.blockers.includes("DOUBLE_COUNTING_CHECK_FAILED"));

  for (const status of ["blocked", "deprecated"] as const) {
    const result = evaluateGriCrossMappingForReview({ ...validReviewInput, status });
    assert.equal(result.decision, "BLOCKED");
    assert.ok(result.blockers.includes("MAPPING_STATUS_NOT_REVIEWABLE"));
  }
});


test("invalid source URLs and ambiguous verification timestamps fail closed", () => {
  const invalidUrl = evaluateGriCrossMappingForReview({
    ...validReviewInput,
    sourceRequirement: {
      ...validReviewInput.sourceRequirement,
      sourceUrl: "javascript:alert(1)",
    },
  });
  assert.equal(invalidUrl.decision, "BLOCKED");
  assert.ok(invalidUrl.blockers.includes("SOURCE_URL_INVALID"));

  const insecureUrl = evaluateGriCrossMappingForReview({
    ...validReviewInput,
    sourceRequirement: {
      ...validReviewInput.sourceRequirement,
      sourceUrl: "http://example.gov.in/regulation",
    },
  });
  assert.equal(insecureUrl.decision, "BLOCKED");
  assert.ok(insecureUrl.blockers.includes("SOURCE_URL_INVALID"));

  for (const officialSourceVerifiedAt of [
    "not-a-timestamp",
    "2026-10-29T10:00:00",
    "2026-02-30T10:00:00Z",
  ]) {
    const invalidTimestamp = evaluateGriCrossMappingForReview({
      ...validReviewInput,
      sourceRequirement: {
        ...validReviewInput.sourceRequirement,
        officialSourceVerifiedAt,
      },
    });
    assert.equal(invalidTimestamp.decision, "BLOCKED");
    assert.ok(
      invalidTimestamp.blockers.includes("OFFICIAL_SOURCE_VERIFICATION_TIMESTAMP_INVALID"),
      `expected invalid timestamp to be rejected: ${officialSourceVerifiedAt}`,
    );
  }
});

test("unarchived or unresolved regulatory sources block authoritative review", () => {
  for (const status of ["DISCOVERY_SOURCE", "NOT_ARCHIVED_HASH_PENDING", "CURRENT_VERSION_MUST_BE_RECONFIRMED", "UNRESOLVED"] as const) {
    const result = evaluateGriCrossMappingForReview({ ...validReviewInput, sourceRequirement: { ...validReviewInput.sourceRequirement, sourceValidation: { status, sourceId: "CPCB-SWM-RULES-2026", sha256: null } } });
    assert.equal(result.decision, "BLOCKED");
    assert.ok(result.blockers.includes("AUTHORITATIVE_SOURCE_NOT_VERIFIED_AND_ARCHIVED"));
    assert.equal(result.complianceConclusion, "NOT_CHANGED");
    assert.equal(result.creditEligibilityConclusion, "NOT_CHANGED");
  }
});
test("verified source status without a valid SHA-256 still blocks", () => {
  const result = evaluateGriCrossMappingForReview({ ...validReviewInput, sourceRequirement: { ...validReviewInput.sourceRequirement, sourceValidation: { status: "VERIFIED_AND_APPROVED", sourceId: "CPCB-SWM-RULES-2026", sha256: "not-a-hash" } } });
  assert.equal(result.decision, "BLOCKED");
  assert.ok(result.blockers.includes("AUTHORITATIVE_SOURCE_NOT_VERIFIED_AND_ARCHIVED"));
});
test("HTTPS source URLs with embedded credentials are rejected", () => {
  const result = evaluateGriCrossMappingForReview({
    ...validReviewInput,
    sourceRequirement: {
      ...validReviewInput.sourceRequirement,
      sourceUrl: "https://trusted.example@attacker.invalid/regulation",
    },
  });
  assert.equal(result.decision, "BLOCKED");
  assert.ok(result.blockers.includes("SOURCE_URL_INVALID"));
  assert.equal(result.complianceConclusion, "NOT_CHANGED");
  assert.equal(result.creditEligibilityConclusion, "NOT_CHANGED");
});

test("missing source-register identity, archive hash or verification timestamp fails closed", () => {
  const cases = [
    {
      sourceRequirement: {
        ...validReviewInput.sourceRequirement,
        sourceValidation: { status: "VERIFIED_AND_APPROVED" as const, sourceId: " ", sha256: "a".repeat(64) },
      },
      blocker: "SOURCE_REGISTER_ID_REQUIRED",
    },
    {
      sourceRequirement: {
        ...validReviewInput.sourceRequirement,
        sourceValidation: { status: "VERIFIED_AND_APPROVED" as const, sourceId: "CPCB-SWM-RULES-2026", sha256: null },
      },
      blocker: "AUTHORITATIVE_SOURCE_NOT_VERIFIED_AND_ARCHIVED",
    },
    {
      sourceRequirement: {
        ...validReviewInput.sourceRequirement,
        officialSourceVerifiedAt: null,
      },
      blocker: "OFFICIAL_SOURCE_VERIFICATION_REQUIRED",
    },
  ];
  for (const item of cases) {
    const result = evaluateGriCrossMappingForReview({ ...validReviewInput, sourceRequirement: item.sourceRequirement });
    assert.equal(result.decision, "BLOCKED");
    assert.ok(result.blockers.includes(item.blocker));
    assert.equal(result.complianceConclusion, "NOT_CHANGED");
    assert.equal(result.creditEligibilityConclusion, "NOT_CHANGED");
  }
});

test("trusted source binding requires exact registry identity, URL, version and archive hash", async () => {
  const { validateGriSourceBinding } = await import("./gri-cross-mapping.js");
  const trusted = {
    sourceId: "CPCB-SWM-2026",
    canonicalUrl: "https://cpcb.nic.in/solid-waste/",
    version: "2026-01",
    sha256: "b".repeat(64),
    validationStatus: "VERIFIED_AND_APPROVED" as const,
  };
  const submitted = {
    sourceId: trusted.sourceId,
    sourceUrl: trusted.canonicalUrl,
    sourceVersion: trusted.version,
    sha256: trusted.sha256,
  };

  assert.deepEqual(validateGriSourceBinding(submitted, trusted), { valid: true, blockers: [] });

  const cases = [
    { ...submitted, sourceId: "ATTACKER-CONTROLLED-ID" },
    { ...submitted, sourceUrl: "https://cpcb.nic.in.attacker.invalid/solid-waste/" },
    { ...submitted, sourceVersion: "old-version" },
    { ...submitted, sha256: "c".repeat(64) },
    { ...submitted, sha256: null },
  ];
  for (const candidate of cases) {
    const result = validateGriSourceBinding(candidate, trusted);
    assert.equal(result.valid, false);
    assert.ok(result.blockers.length > 0);
  }

  assert.ok(validateGriSourceBinding(submitted, null).blockers.includes("TRUSTED_SOURCE_REGISTER_RECORD_NOT_FOUND"));
  assert.ok(validateGriSourceBinding(submitted, { ...trusted, validationStatus: "UNRESOLVED" }).blockers.includes("TRUSTED_SOURCE_REGISTER_RECORD_NOT_APPROVED"));
});
