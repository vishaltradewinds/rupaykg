import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { hashRawInstrumentFrame, validateParameterUncertainty, type ParameterUncertaintyInput } from "./mrv-measurement-integrity.js";

const artifactBytes = Buffer.from("reviewed calibration certificate fixture");
const artifactHash = createHash("sha256").update(artifactBytes).digest("hex");
const uncertainty = (overrides: Partial<ParameterUncertaintyInput> = {}): ParameterUncertaintyInput => ({
  parameterCode: "WASTE_MASS",
  parameterUnit: "kg",
  kind: "ABSOLUTE",
  value: 0.25,
  valueUnit: "kg",
  expression: "EXPANDED",
  coverageFactor: 2,
  confidenceLevelPercent: 95,
  calibrationArtifactVersionId: "artifact-version-001",
  calibrationArtifactSha256: artifactHash,
  calibrationReviewDecision: "APPROVED",
  decisionRuleId: "methodology-rule-v1",
  ...overrides,
});

test("accepts parameter-specific expanded absolute uncertainty bound to approved calibration evidence", () => {
  const result = validateParameterUncertainty(uncertainty(), "WASTE_MASS", "kg");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.calibrationArtifactSha256, artifactHash);
});

test("supports a relative uncertainty as a dimensionless percentage", () => {
  const result = validateParameterUncertainty(uncertainty({
    kind: "RELATIVE", value: 1.5, valueUnit: "%", expression: "STANDARD",
    coverageFactor: null, confidenceLevelPercent: null,
  }), "WASTE_MASS", "kg");
  assert.equal(result.ok, true);
});

test("rejects cross-parameter and mismatched absolute units", () => {
  assert.deepEqual(validateParameterUncertainty(uncertainty(), "GAS_FLOW", "m3/h"), {
    ok: false, reason: "UNCERTAINTY_PARAMETER_MISMATCH",
  });
  assert.deepEqual(validateParameterUncertainty(uncertainty({ valueUnit: "g" }), "WASTE_MASS", "kg"), {
    ok: false, reason: "ABSOLUTE_UNCERTAINTY_UNIT_MISMATCH",
  });
});

test("rejects expanded uncertainty without a positive coverage factor", () => {
  const result = validateParameterUncertainty(uncertainty({ coverageFactor: null }), "WASTE_MASS", "kg");
  assert.deepEqual(result, { ok: false, reason: "EXPANDED_UNCERTAINTY_REQUIRES_COVERAGE_FACTOR" });
});

test("rejects unapproved calibration evidence and missing decision rule", () => {
  assert.deepEqual(validateParameterUncertainty(uncertainty({ calibrationReviewDecision: "PENDING" }), "WASTE_MASS", "kg"), {
    ok: false, reason: "UNCERTAINTY_CALIBRATION_EVIDENCE_NOT_APPROVED",
  });
  assert.deepEqual(validateParameterUncertainty(uncertainty({ decisionRuleId: " " }), "WASTE_MASS", "kg"), {
    ok: false, reason: "UNCERTAINTY_DECISION_RULE_REQUIRED",
  });
});

test("hashes exact raw bytes server-side and detects a claimed digest mismatch", () => {
  const bytes = Buffer.from([0x02, 0x10, 0x00, 0xff, 0x41]);
  const expected = createHash("sha256").update(bytes).digest("hex");
  assert.deepEqual(hashRawInstrumentFrame(bytes, expected), {
    sha256: expected, byteLength: bytes.byteLength, claimedDigestMatched: true,
  });
  assert.equal(hashRawInstrumentFrame(bytes, "0".repeat(64)).claimedDigestMatched, false);
});

test("different raw frames remain distinguishable even when they may parse to the same values", () => {
  const first = hashRawInstrumentFrame(Buffer.from("1.0"));
  const second = hashRawInstrumentFrame(Buffer.from("1.00"));
  assert.notEqual(first.sha256, second.sha256);
});

test("rejects empty and oversized raw frames", () => {
  assert.throws(() => hashRawInstrumentFrame(Buffer.alloc(0)), /RAW_FRAME_EMPTY_OR_INVALID/);
  assert.throws(() => hashRawInstrumentFrame(Buffer.from("1234"), null, 3), /RAW_FRAME_SIZE_LIMIT_EXCEEDED/);
});
