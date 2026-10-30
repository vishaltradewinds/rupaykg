import test from "node:test";
import assert from "node:assert/strict";
import { validateConflictResolution, validateSyncEnvelope } from "./sync-validation.js";

const validEnvelope = (capturedAt: string) => ({
  idempotencyKey: "op-001",
  deviceId: "550e8400-e29b-41d4-a716-446655440000",
  clientSequence: 1,
  capturedAt,
  payload: { operation: "MEASUREMENT", value: 42 },
});

test("accepts a valid field-sync envelope", () => {
  const result = validateSyncEnvelope(validEnvelope("2026-09-02T10:00:00Z"));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.clientSequence, 1);
});

test("accepts explicit timezone offsets and fractional seconds", () => {
  for (const timestamp of [
    "2026-09-02T10:00:00+05:30",
    "2026-09-02T10:00:00.123456Z",
  ]) {
    assert.equal(validateSyncEnvelope(validEnvelope(timestamp)).ok, true);
  }
});

test("rejects timezone-naive and date-only capture timestamps", () => {
  for (const timestamp of [
    "2026-09-02",
    "2026-09-02T10:00:00",
    "2026-09-02 10:00:00",
  ]) {
    const result = validateSyncEnvelope(validEnvelope(timestamp));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "INVALID_CAPTURE_TIME");
  }
});

test("rejects impossible calendar and clock fields instead of normalizing them", () => {
  for (const timestamp of [
    "0000-02-29T10:00:00Z",
    "1900-02-29T10:00:00Z",
    "2026-02-30T10:00:00Z",
    "2026-13-01T10:00:00Z",
    "2026-09-02T25:00:00Z",
    "2026-09-02T10:61:00Z",
    "2026-09-02T10:00:60Z",
    "2026-09-02T10:00:00+05:99",
  ]) {
    const result = validateSyncEnvelope(validEnvelope(timestamp));
    assert.equal(result.ok, false, timestamp);
    if (!result.ok) assert.equal(result.code, "INVALID_CAPTURE_TIME", timestamp);
  }
});

test("rejects invalid field-sync device ids", () => {
  const result = validateSyncEnvelope({
    ...validEnvelope("2026-09-02T10:00:00Z"),
    deviceId: "not-a-uuid",
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
