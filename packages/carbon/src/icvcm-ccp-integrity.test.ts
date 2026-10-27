import test from "node:test";
import assert from "node:assert/strict";
import { assessIcvcmCcpEvidence, ICVCM_CCP_PRINCIPLES, ICVCM_CCP_SOURCE_REGISTER } from "./icvcm-ccp-integrity.js";

test("source register uses official ICVCM resources", () => {
  assert.match(ICVCM_CCP_SOURCE_REGISTER.coreCarbonPrinciples, /^https:\/\/icvcm\.org\//);
  assert.match(ICVCM_CCP_SOURCE_REGISTER.assessmentFramework, /^https:\/\/icvcm\.org\//);
  assert.equal(ICVCM_CCP_PRINCIPLES.length, 10);
});

test("empty assessment fails closed and reports all principles as not assessed", () => {
  const result = assessIcvcmCcpEvidence([]);
  assert.equal(result.status, "GAPS_IDENTIFIED");
  assert.equal(result.evidencedCount, 0);
  assert.equal(result.notAssessedCount, 10);
  assert.equal(result.controls.length, 10);
  assert.ok(result.limitations.some((item) => item.includes("not an ICVCM assessment or certification")));
});

test("evidenced status without a reference is downgraded to a gap", () => {
  const result = assessIcvcmCcpEvidence([{ principleId: "CCP-01", status: "EVIDENCED" }]);
  assert.equal(result.controls[0].status, "GAP");
  assert.match(result.controls[0].reasons.join(" "), /Evidence reference is required/);
});

test("all ten controls with evidence return internal completeness only, pending independent review", () => {
  const result = assessIcvcmCcpEvidence(ICVCM_CCP_PRINCIPLES.map((item) => ({
    principleId: item.id,
    status: "EVIDENCED" as const,
    evidenceReferences: [`evidence:${item.id}`],
  })));
  assert.equal(result.evidencedCount, 10);
  assert.equal(result.gapCount, 0);
  assert.equal(result.notAssessedCount, 0);
  assert.equal(result.status, "INTERNAL_EVIDENCE_CHECK_COMPLETE_PENDING_INDEPENDENT_REVIEW");
  assert.ok(!result.status.includes("CERTIFIED"));
  assert.ok(!result.status.includes("APPROVED"));
});

test("unknown and duplicate principle IDs are rejected", () => {
  assert.throws(() => assessIcvcmCcpEvidence([{ principleId: "CCP-99", status: "GAP" }]), /Unknown ICVCM CCP principle/);
  assert.throws(() => assessIcvcmCcpEvidence([
    { principleId: "CCP-01", status: "GAP" },
    { principleId: "CCP-01", status: "GAP" },
  ]), /Duplicate ICVCM CCP assessment/);
});
