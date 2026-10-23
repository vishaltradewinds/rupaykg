import test from "node:test";
import assert from "node:assert/strict";
import { isValidIsoReportingDate, nonNegativeValueInput } from "./value-routes.js";

test("MRV and ESG numeric inputs reject strings and non-finite values", () => {
  for (const value of ["12", "1e2", null, true, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.equal(nonNegativeValueInput({ value }, "value"), null);
  }
  assert.equal(nonNegativeValueInput({ value: 0 }, "value"), 0);
  assert.equal(nonNegativeValueInput({ value: 1.25 }, "value"), 1.25);
});

test("MRV reporting periods reject impossible and non-ISO dates", () => {
  for (const value of ["2026-02-30", "2026-13-01", "2026-1-01", "21/10/2026", "2026-10-21T00:00:00Z", ""]) {
    assert.equal(isValidIsoReportingDate(value), false);
  }
  assert.equal(isValidIsoReportingDate("2026-10-21"), true);
  assert.equal(isValidIsoReportingDate("2024-02-29"), true);
});
