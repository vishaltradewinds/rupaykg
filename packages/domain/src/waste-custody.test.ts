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

test("corrections must supersede a prior event rather than overwrite history", () => {
  const result = validateWasteCustodyEvent(valid({ eventType: "CORRECTION", supersedesEventId: undefined }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "CUSTODY_SUPERSESSION_REQUIRED");
});

test("rejects non-positive quantities and invalid evidence references", () => {
  assert.equal(validateWasteCustodyEvent(valid({ quantity: 0 })).ok, false);
  const result = validateWasteCustodyEvent(valid({ evidenceIds: ["not-a-uuid"] }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "CUSTODY_EVIDENCE_REFERENCE_INVALID");
});
