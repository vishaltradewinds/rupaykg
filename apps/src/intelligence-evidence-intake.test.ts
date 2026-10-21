import test from "node:test";
import assert from "node:assert/strict";
import { validateWasteLogExtraction } from "./intelligence-evidence-intake.js";

const base = {
  recordType: "WASTE_MEASUREMENT",
  observedAt: "2026-10-19T08:30:00Z",
  quantity: 1,
  unit: "kg",
  wasteStream: "WET",
  facilityReference: null,
  notes: "",
  confidence: 0.5,
  warnings: [],
};

test("timestamp offset fields are rejected when out of range", () => {
  assert.equal(validateWasteLogExtraction({ ...base, observedAt: "2026-10-19T08:30:00+25:00" }), null);
  assert.equal(validateWasteLogExtraction({ ...base, observedAt: "2026-10-19T08:30:00+01:60" }), null);
  assert.ok(validateWasteLogExtraction({ ...base, observedAt: "2026-10-19T08:30:00+05:30" }));
});
