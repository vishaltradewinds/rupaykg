import test from "node:test";
import assert from "node:assert/strict";
import { assertEvidenceBeforeValue, assertPositiveQuantity } from "./resource-flows.js";

test("resource quantities must be finite and positive", () => {
  assert.doesNotThrow(() => assertPositiveQuantity(10));
  assert.throws(() => assertPositiveQuantity(0));
  assert.throws(() => assertPositiveQuantity(-1));
  assert.throws(() => assertPositiveQuantity(Number.NaN));
});

test("value realization requires verified evidence and approved verification", () => {
  assert.doesNotThrow(() => assertEvidenceBeforeValue(true, true));
  assert.throws(() => assertEvidenceBeforeValue(false, true));
  assert.throws(() => assertEvidenceBeforeValue(true, false));
});
