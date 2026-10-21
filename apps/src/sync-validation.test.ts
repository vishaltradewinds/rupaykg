import test from "node:test";
import assert from "node:assert/strict";
import { isValidRfc3339Timestamp, validateConflictResolution, validateSyncEnvelope } from "./sync-validation.js";
import { positiveSyncNumber, validSyncDateValue } from "./sync-routes.js";

test("accepts a valid field-sync envelope", () => {
  const result = validateSyncEnvelope({
    idempotencyKey: "op-001",
    deviceId: "550e8400-e29b-41d4-a716-446655440000",
    clientSequence: 1,
    capturedAt: "2026-09-02T10:00:00Z",
    payload: { operation: "MEASUREMENT", value: 42 },
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.clientSequence, 1);
});

test("rejects invalid field-sync device ids", () => {
  const result = validateSyncEnvelope({
    idempotencyKey: "op-002",
    deviceId: "not-a-uuid",
    clientSequence: 2,
    capturedAt: "2026-09-02T10:00:00Z",
    payload: {},
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "INVALID_DEVICE");
});

test("requires the authoritative conflict-resolution field name", () => {
  const valid = validateConflictResolution({ resolutionStatus: "RESOLVED", resolutionReason: "Reviewed by operations" });
  assert.deepEqual(valid, { ok: true, resolutionStatus: "RESOLVED", resolutionReason: "Reviewed by operations" });

  const legacy = validateConflictResolution({ resolutionStatus: "RESOLVED", reason: "Reviewed by operations" });
  assert.equal(legacy.ok, false);
  if (!legacy.ok) assert.equal(legacy.code, "INVALID_RESOLUTION");
});


test("field-sync client sequence requires a positive safe JSON integer", () => {
  const base = {
    idempotencyKey: "op-sequence",
    deviceId: "550e8400-e29b-41d4-a716-446655440000",
    capturedAt: "2026-10-20T10:15:30Z",
    payload: { operation: "MEASUREMENT", value: 42 },
  };
  for (const clientSequence of ["1", "01", 1.5, 0, -1, Number.MAX_SAFE_INTEGER + 1, null]) {
    const result = validateSyncEnvelope({ ...base, clientSequence });
    assert.equal(result.ok, false, `expected invalid sequence to be rejected: ${String(clientSequence)}`);
    if (!result.ok) assert.equal(result.code, "INVALID_ENVELOPE");
  }
  assert.equal(validateSyncEnvelope({ ...base, clientSequence: 1 }).ok, true);
});

test("field-sync capture timestamps require a valid timezone-bearing RFC 3339 value", () => {
  const base = {
    idempotencyKey: "op-timestamp",
    deviceId: "550e8400-e29b-41d4-a716-446655440000",
    clientSequence: 7,
    payload: { operation: "MEASUREMENT", value: 42 },
  };
  assert.equal(validateSyncEnvelope({ ...base, capturedAt: "2026-10-20T10:15:30Z" }).ok, true);
  assert.equal(validateSyncEnvelope({ ...base, capturedAt: "2026-10-20T10:15:30.123+05:30" }).ok, true);

  for (const capturedAt of [
    "2026-10-20 10:15:30",
    "2026-10-20T10:15:30",
    "2026-02-30T10:15:30Z",
    "2026-10-20T25:15:30Z",
    "2026-10-20T10:61:30Z",
    "2026-10-20T10:15:30+05",
    "2026-10-20T10:15:30+25:00",
    "2026-10-20T10:15:30+01:60",
  ]) {
    const result = validateSyncEnvelope({ ...base, capturedAt });
    assert.equal(result.ok, false, `expected invalid timestamp to be rejected: ${capturedAt}`);
    if (!result.ok) assert.equal(result.code, "INVALID_CAPTURE_TIME");
  }
});

test("field operation measurements reject numeric strings and invalid timestamps", () => {
  for (const value of ["42", "1e2", null, true, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(positiveSyncNumber({ value }, "value"), null);
  }
  assert.equal(positiveSyncNumber({ value: 42 }, "value"), 42);
  assert.equal(positiveSyncNumber({ value: 0.25 }, "value"), 0.25);
  for (const value of ["2026-02-30T10:00:00Z", "2026-10-21", "2026-10-21T10:00:00", "2026-10-21T25:00:00Z", ""]) {
    assert.equal(validSyncDateValue({ capturedAt: value }, "capturedAt"), null);
  }
  assert.equal(validSyncDateValue({ capturedAt: "2026-10-21T10:00:00+05:30" }, "capturedAt"), "2026-10-21T10:00:00+05:30");
});

test("RFC3339 timestamp validator rejects impossible calendar dates and timezone offsets", () => {
  assert.equal(isValidRfc3339Timestamp("2026-02-30T10:00:00Z"), false);
  assert.equal(isValidRfc3339Timestamp("2026-10-21T10:00:00+25:00"), false);
  assert.equal(isValidRfc3339Timestamp("2026-10-21T10:00:00+01:60"), false);
  assert.equal(isValidRfc3339Timestamp("2024-02-29T10:00:00Z"), true);
});
