import test from "node:test";
import assert from "node:assert/strict";
import { validateWasteLogExtraction } from "./intelligence-evidence-intake.js";

const valid = {
  recordType: "WASTE_MEASUREMENT",
  observedAt: "2026-10-19T08:30:00Z",
  quantity: 125.5,
  unit: "kg",
  wasteStream: "WET",
  facilityReference: "FAC-001",
  notes: "Scale reading transcribed from log",
  confidence: 0.92,
  warnings: [],
};

test("accepts a well-formed extraction only as a review-only proposal", () => {
  const result = validateWasteLogExtraction(valid);
  assert.ok(result);
  assert.equal(result.validationStatus, "SCHEMA_VALIDATED_NOT_FACT_VERIFIED");
  assert.equal(result.requiresHumanReview, true);
  assert.equal(result.authoritativeMutation, false);
  assert.equal(result.quantity, 125.5);
});

test("rejects type hallucinations instead of coercing numeric strings", () => {
  assert.equal(validateWasteLogExtraction({ ...valid, quantity: "125.5" }), null);
  assert.equal(validateWasteLogExtraction({ ...valid, confidence: "0.9" }), null);
  assert.equal(validateWasteLogExtraction({ ...valid, quantity: 12, unit: null }), null);
  assert.equal(validateWasteLogExtraction({ ...valid, quantity: null, unit: "kg" }), null);
});

test("rejects unknown keys, invalid units and out-of-range confidence", () => {
  assert.equal(validateWasteLogExtraction({ ...valid, approved: true }), null);
  assert.equal(validateWasteLogExtraction({ ...valid, unit: "x".repeat(41) }), null);
  assert.equal(validateWasteLogExtraction({ ...valid, confidence: 1.01 }), null);
});

test("rejects invalid timestamps, stream labels and unbounded warning arrays", () => {
  assert.equal(validateWasteLogExtraction({ ...valid, observedAt: "yesterday" }), null);
  assert.equal(validateWasteLogExtraction({ ...valid, wasteStream: "BIOCARBON_CREDIT" }), null);
  assert.equal(validateWasteLogExtraction({ ...valid, warnings: Array(11).fill("warning") }), null);
});

test("allows missing measurements only when explicitly null, never as invented zero", () => {
  const result = validateWasteLogExtraction({ ...valid, quantity: null, unit: null });
  assert.ok(result);
  assert.equal(result.quantity, null);
  assert.equal(result.unit, null);
});


test("rejects impossible calendar dates and out-of-range clock fields", () => {
  assert.equal(validateWasteLogExtraction({ ...valid, observedAt: "2026-02-31T08:30:00Z" }), null);
  assert.equal(validateWasteLogExtraction({ ...valid, observedAt: "2026-13-01T08:30:00Z" }), null);
  assert.equal(validateWasteLogExtraction({ ...valid, observedAt: "2026-10-19T24:30:00Z" }), null);
  assert.equal(validateWasteLogExtraction({ ...valid, observedAt: "2026-10-19T08:60:00Z" }), null);
  assert.equal(validateWasteLogExtraction({ ...valid, observedAt: "2026-10-19T08:30:00+25:00" }), null);
  assert.ok(validateWasteLogExtraction({ ...valid, observedAt: "2024-02-29T08:30:00Z" }));
});
