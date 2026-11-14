import test from "node:test";
import assert from "node:assert/strict";
import { exactNumericText, normalizeReportQuality, parseReportRunId, parseSwmReportQuery, stakeholderFromVerifiedRole } from "./reporting-routes.js";

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

test("saved report run IDs accept only canonical UUIDs", () => {
  const valid = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(parseReportRunId(valid), valid);
  assert.equal(parseReportRunId("not-a-uuid"), null);
  assert.equal(parseReportRunId(undefined), null);
});
test("database numeric values remain exact decimal strings without floating-point coercion", () => {
  assert.equal(exactNumericText("99999999999999.999999"), "99999999999999.999999");
  assert.equal(exactNumericText("-0.000001"), "-0.000001");
  assert.equal(exactNumericText("1e3"), "1e3");
  assert.equal(exactNumericText(""), null);
  assert.equal(exactNumericText("NaN"), null);
  assert.equal(exactNumericText(Number.POSITIVE_INFINITY), null);
});

test("stakeholder attribution requires exactly one verified canonical role", () => {
  assert.deepEqual(stakeholderFromVerifiedRole("aggregator", 1), { stakeholder: "AGGREGATOR", attribution: "VERIFIED" });
  assert.deepEqual(stakeholderFromVerifiedRole("industry_generator", 1), { stakeholder: "GENERATOR", attribution: "VERIFIED" });
  assert.deepEqual(stakeholderFromVerifiedRole("collector_transporter", 1), { stakeholder: "TRANSPORTER", attribution: "VERIFIED" });
  assert.deepEqual(stakeholderFromVerifiedRole("recycler", 1), { stakeholder: "RECYCLER", attribution: "VERIFIED" });
  assert.deepEqual(stakeholderFromVerifiedRole("processor", 1), { stakeholder: "PROCESSOR", attribution: "VERIFIED" });
  assert.deepEqual(stakeholderFromVerifiedRole("bwg", 1), { stakeholder: "BWG", attribution: "VERIFIED" });
  assert.deepEqual(stakeholderFromVerifiedRole("municipal_admin", 1), { stakeholder: "ULB", attribution: "VERIFIED" });
  assert.deepEqual(stakeholderFromVerifiedRole("gram_panchayat_admin", 1), { stakeholder: "GRAM_PANCHAYAT", attribution: "VERIFIED" });
  assert.deepEqual(stakeholderFromVerifiedRole("aggregator", 2), { stakeholder: "OTHER", attribution: "UNMAPPED" });
  assert.deepEqual(stakeholderFromVerifiedRole("custom_role", 1), { stakeholder: "OTHER", attribution: "UNMAPPED" });
  assert.deepEqual(stakeholderFromVerifiedRole(null, 0), { stakeholder: "OTHER", attribution: "UNMAPPED" });
});
