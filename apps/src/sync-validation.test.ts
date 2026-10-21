import test from "node:test";
import assert from "node:assert/strict";
import { validateConflictResolution, validateSyncEnvelope } from "./sync-validation.js";

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
  ]) {
    const result = validateSyncEnvelope({ ...base, capturedAt });
    assert.equal(result.ok, false, `expected invalid timestamp to be rejected: ${capturedAt}`);
    if (!result.ok) assert.equal(result.code, "INVALID_CAPTURE_TIME");
  }
});
