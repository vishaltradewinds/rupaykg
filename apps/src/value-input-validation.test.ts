import test from "node:test";
import assert from "node:assert/strict";
import { nonNegativeValueInput } from "./value-routes.js";

test("MRV and ESG numeric inputs reject strings and non-finite values", () => {
  for (const value of ["12", "1e2", null, true, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.equal(nonNegativeValueInput({ value }, "value"), null);
  }
  assert.equal(nonNegativeValueInput({ value: 0 }, "value"), 0);
  assert.equal(nonNegativeValueInput({ value: 1.25 }, "value"), 1.25);
});
