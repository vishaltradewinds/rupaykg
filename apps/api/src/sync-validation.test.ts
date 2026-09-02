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
