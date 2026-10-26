import test from "node:test";
import assert from "node:assert/strict";
import { validateWasteCustodyEvent } from "./waste-custody.js";

const flow = "550e8400-e29b-41d4-a716-446655440000";
const actor = "550e8400-e29b-41d4-a716-446655440001";
const counterparty = "550e8400-e29b-41d4-a716-446655440002";
const evidence = "550e8400-e29b-41d4-a716-446655440003";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    resourceFlowId: flow,
    idempotencyKey: "field-device:00001",
    eventType: "GENERATOR_HANDOVER",
    actorOrganizationId: actor,
    counterpartyOrganizationId: counterparty,
    quantity: 120,
    unit: "kg",
    quantityBasis: "DECLARED",
    quantitySource: "generator declaration",
    occurredAt: "2026-10-26T09:30:00Z",
    evidenceIds: [evidence],
    ...overrides,
  };
}

test("accepts a custody event with explicit parties and quantity provenance", () => {
  const result = validateWasteCustodyEvent(valid());
  assert.equal(result.ok, true);
});

test("rejects unknown event types instead of silently accepting them", () => {
  const result = validateWasteCustodyEvent(valid({ eventType: "RECYCLED_CERTIFIED" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "CUSTODY_EVENT_TYPE_UNKNOWN");
});

test("requires an explicit counterparty for handover and receipt events", () => {
  const result = validateWasteCustodyEvent(valid({ counterpartyOrganizationId: undefined }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "CUSTODY_COUNTERPARTY_REQUIRED");
});

test("measured quantities require method and instrument provenance", () => {
  const missing = validateWasteCustodyEvent(valid({ quantityBasis: "MEASURED" }));
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, "CUSTODY_MEASUREMENT_PROVENANCE_REQUIRED");
  assert.equal(validateWasteCustodyEvent(valid({
    quantityBasis: "MEASURED",
    measurementMethod: "verified weighbridge",
    instrumentId: "WB-UNIT-17",
  })).ok, true);
});

test("partial acceptance, rejection and disputes require reason codes", () => {
  for (const eventType of ["PARTIAL_ACCEPTANCE", "REJECTION", "QUANTITY_DISPUTE"]) {
    const result = validateWasteCustodyEvent(valid({ eventType, reasonCode: undefined }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "CUSTODY_REASON_REQUIRED");
  }
});

test("weighment requires measured quantity with method and instrument provenance", () => {
  const declared = validateWasteCustodyEvent(valid({ eventType: "WEIGHMENT_CAPTURED" }));
  assert.equal(declared.ok, false);
  if (!declared.ok) assert.equal(declared.code, "CUSTODY_WEIGHMENT_MUST_BE_MEASURED");
  assert.equal(validateWasteCustodyEvent(valid({
    eventType: "WEIGHMENT_CAPTURED",
    quantityBasis: "MEASURED",
    measurementMethod: "verified weighbridge",
    instrumentId: "WB-UNIT-17",
  })).ok, true);
});

test("corrections require a superseded event and a reason", () => {
  const missingTarget = validateWasteCustodyEvent(valid({ eventType: "CORRECTION", reasonCode: "SOURCE_FIX" }));
  assert.equal(missingTarget.ok, false);
  if (!missingTarget.ok) assert.equal(missingTarget.code, "CUSTODY_SUPERSESSION_REQUIRED");
  const missingReason = validateWasteCustodyEvent(valid({
    eventType: "CORRECTION",
    supersedesEventId: evidence,
    reasonCode: undefined,
  }));
  assert.equal(missingReason.ok, false);
  if (!missingReason.ok) assert.equal(missingReason.code, "CUSTODY_REASON_REQUIRED");
});

test("rejects normalized invalid dates and non-ISO timestamps", () => {
  for (const occurredAt of ["2026-02-31T09:30:00Z", "1", "2026-10-26T09:30:00", "2026-13-01T09:30:00Z"]) {
    const result = validateWasteCustodyEvent(valid({ occurredAt }));
    assert.equal(result.ok, false, `accepted malformed timestamp: ${occurredAt}`);
    if (!result.ok) assert.equal(result.code, "CUSTODY_EVENT_TIME_INVALID");
  }
});

test("requires explicit timezone and bounded idempotency key", () => {
  const noTimezone = validateWasteCustodyEvent(valid({ occurredAt: "2026-10-26T09:30:00" }));
  assert.equal(noTimezone.ok, false);
  if (!noTimezone.ok) assert.equal(noTimezone.code, "CUSTODY_EVENT_TIME_INVALID");
  const oversizedKey = validateWasteCustodyEvent(valid({ idempotencyKey: "x".repeat(201) }));
  assert.equal(oversizedKey.ok, false);
  if (!oversizedKey.ok) assert.equal(oversizedKey.code, "CUSTODY_EVENT_IDENTITY_REQUIRED");
});

test("rejects non-positive quantities and invalid evidence references", () => {
  assert.equal(validateWasteCustodyEvent(valid({ quantity: 0 })).ok, false);
  const result = validateWasteCustodyEvent(valid({ evidenceIds: ["not-a-uuid"] }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "CUSTODY_EVIDENCE_REFERENCE_INVALID");
});
