import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReportQuality, parseSwmReportQuery } from "./reporting-routes.js";

test("SWM report query accepts explicit urban and rural periods", () => {
  assert.deepEqual(parseSwmReportQuery({ periodStart: "2026-04-01", periodEnd: "2026-04-30", context: "urban" }), {
    periodStart: "2026-04-01", periodEnd: "2026-04-30", context: "urban",
  });
  assert.deepEqual(parseSwmReportQuery({ periodStart: "2026-04-01", periodEnd: "2026-04-30", context: "rural" }), {
    periodStart: "2026-04-01", periodEnd: "2026-04-30", context: "rural",
  });
});

test("SWM report query accepts only a valid optional geography UUID", () => {
  const valid = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(parseSwmReportQuery({ periodStart: "2026-04-01", periodEnd: "2026-04-30", context: "urban", geographyId: valid })?.geographyId, valid);
  assert.equal(parseSwmReportQuery({ periodStart: "2026-04-01", periodEnd: "2026-04-30", context: "urban", geographyId: "not-a-uuid" }), null);
});

test("SWM report query rejects invalid dates, reversed periods and missing/unknown context", () => {
  assert.equal(parseSwmReportQuery({ periodStart: "2026-02-31", periodEnd: "2026-03-31", context: "urban" }), null);
  assert.equal(parseSwmReportQuery({ periodStart: "2026-04-30", periodEnd: "2026-04-01", context: "urban" }), null);
  assert.equal(parseSwmReportQuery({ periodStart: "2026-04-01", periodEnd: "2026-04-30" }), null);
  assert.equal(parseSwmReportQuery({ periodStart: "2026-04-01", periodEnd: "2026-04-30", context: "national" }), null);
});

test("unknown and absent measurement quality never upgrades to observed", () => {
  assert.equal(normalizeReportQuality(null), "MISSING");
  assert.equal(normalizeReportQuality("PENDING"), "MISSING");
  assert.equal(normalizeReportQuality("ESTIMATED"), "ESTIMATED");
  assert.equal(normalizeReportQuality("DISPUTED"), "DISPUTED");
  assert.equal(normalizeReportQuality("OBSERVED"), "OBSERVED");
});
