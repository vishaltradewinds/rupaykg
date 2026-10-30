import assert from "node:assert/strict";
import test from "node:test";
import { validateEdgeObservation, type EdgeObservation } from "./index.js";

const goodObservation = (): EdgeObservation => ({
  schemaVersion: "rupaykg.edge-observation.v1",
  eventId: "event-001",
  deviceId: "edge-device-001",
  instrumentId: "instrument-001",
  siteId: "site-001",
  organizationId: "org-001",
  parameterCode: "WASTE_MASS",
  observedAt: "2026-10-30T07:00:00.000Z",
  receivedAt: "2026-10-30T07:00:02.000Z",
  sequence: 1,
  value: 123.45,
  unit: "kg",
  rawPayloadSha256: "a".repeat(64),
  firmwareVersion: "1.0.0",
  calibrationRecordId: "cal-001",
  calibrationState: "VERIFIED_CURRENT",
  authenticationState: "AUTHENTICATED",
  clockQuality: "TRUSTED",
  qualityFlags: [],
});

test("valid adapter observation is only ready for human/canonical review", () => {
  assert.deepEqual(validateEdgeObservation(goodObservation()), {
    disposition: "READY_FOR_REVIEW",
    blockers: [],
  });
});

test("unauthenticated device is quarantined", () => {
  const value = goodObservation();
  value.authenticationState = "UNVERIFIED";
  assert.equal(validateEdgeObservation(value).disposition, "QUARANTINED");
  assert.ok(validateEdgeObservation(value).blockers.includes("DEVICE_NOT_AUTHENTICATED"));
});

test("invalid numeric value and raw payload digest are quarantined", () => {
  const value = goodObservation();
  value.value = Number.NaN;
  value.rawPayloadSha256 = "not-a-hash";
  const result = validateEdgeObservation(value);
  assert.equal(result.disposition, "QUARANTINED");
  assert.ok(result.blockers.includes("INVALID_MEASUREMENT_VALUE"));
  assert.ok(result.blockers.includes("INVALID_RAW_PAYLOAD_SHA256"));
});

test("missing or expired calibration blocks an otherwise valid observation", () => {
  const value = goodObservation();
  value.calibrationState = "EXPIRED";
  const result = validateEdgeObservation(value);
  assert.equal(result.disposition, "CALIBRATION_BLOCKED");
  assert.deepEqual(result.blockers, ["CALIBRATION_EVIDENCE_MISSING_OR_EXPIRED"]);
});

test("uncertain device clock is quarantined, not silently rewritten", () => {
  const value = goodObservation();
  value.clockQuality = "UNCERTAIN";
  assert.ok(validateEdgeObservation(value).blockers.includes("DEVICE_CLOCK_UNCERTAIN"));
});

test("negative or fractional sequence is rejected", () => {
  const negative = goodObservation();
  negative.sequence = -1;
  assert.ok(validateEdgeObservation(negative).blockers.includes("INVALID_SEQUENCE"));
  const fractional = goodObservation();
  fractional.sequence = 1.5;
  assert.ok(validateEdgeObservation(fractional).blockers.includes("INVALID_SEQUENCE"));
});

test("unjustified non-applicable calibration cannot pass locally", () => {
  const value = goodObservation();
  value.calibrationState = "NOT_APPLICABLE_WITH_JUSTIFICATION";
  value.calibrationRecordId = null;
  const result = validateEdgeObservation(value);
  assert.equal(result.disposition, "CALIBRATION_BLOCKED");
  assert.deepEqual(result.blockers, ["CALIBRATION_NOT_APPLICABLE_REQUIRES_REVIEWED_REGISTER_RECORD"]);
});

test("null payload is rejected without throwing", () => {
  assert.equal(validateEdgeObservation(null).disposition, "QUARANTINED");
});

test("unknown calibration state is rejected", () => {
  const value = { ...goodObservation(), calibrationState: "UNKNOWN" };
  const result = validateEdgeObservation(value);
  assert.equal(result.disposition, "QUARANTINED");
  assert.ok(result.blockers.includes("INVALID_CALIBRATION_STATE"));
});

test("receive time before observation time is rejected", () => {
  const value = goodObservation();
  value.receivedAt = "2026-10-30T06:59:59.000Z";
  assert.ok(validateEdgeObservation(value).blockers.includes("RECEIVED_BEFORE_OBSERVED"));
});
