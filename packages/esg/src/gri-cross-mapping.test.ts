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
