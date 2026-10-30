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


test("rejects capture timestamps without an explicit timezone or full time", () => {
  for (const capturedAt of [
    "2026-09-02",
    "2026-09-02T10:00:00",
    "2026-09-02 10:00:00Z",
    "2026-09-02T10:00Z",
  ]) {
    const result = validateSyncEnvelope({
      idempotencyKey: "timestamp-invalid",
      deviceId: "550e8400-e29b-41d4-a716-446655440000",
      clientSequence: 3,
      capturedAt,
      payload: {},
    });
    assert.equal(result.ok, false, capturedAt);
    if (!result.ok) assert.equal(result.code, "INVALID_CAPTURE_TIME", capturedAt);
  }
});

test("rejects impossible calendar dates and clock or timezone values", () => {
  for (const capturedAt of [
    "0000-02-29T10:00:00Z",
    "2026-02-30T10:00:00Z",
    "2024-02-30T10:00:00Z",
    "1900-02-29T10:00:00Z",
    "2026-13-01T10:00:00Z",
    "2026-09-02T24:00:00Z",
    "2026-09-02T10:60:00Z",
    "2026-09-02T10:00:60Z",
    "2026-09-02T10:00:00+25:00",
    "2026-09-02T10:00:00+05:99",
  ]) {
    const result = validateSyncEnvelope({
      idempotencyKey: "timestamp-impossible",
      deviceId: "550e8400-e29b-41d4-a716-446655440000",
      clientSequence: 4,
      capturedAt,
      payload: {},
    });
    assert.equal(result.ok, false, capturedAt);
    if (!result.ok) assert.equal(result.code, "INVALID_CAPTURE_TIME", capturedAt);
  }
});

test("accepts valid timezone-aware RFC3339-style capture timestamps", () => {
  for (const capturedAt of [
    "2026-09-02T10:00:00Z",
    "2024-02-29T10:00:00.123Z",
    "2026-09-02T15:30:00+05:30",
    "2026-09-02T04:30:00-05:30",
  ]) {
    const result = validateSyncEnvelope({
      idempotencyKey: "timestamp-valid",
      deviceId: "550e8400-e29b-41d4-a716-446655440000",
      clientSequence: 5,
      capturedAt,
      payload: {},
    });
    assert.equal(result.ok, true, capturedAt);
  }
});
