import test from "node:test";
import assert from "node:assert/strict";
import { deriveResidueLotStatus, isCustodyEventSupported } from "./industrial-ccts-routes.js";

test("custody event support blocks one-sided cross-organization transfers and unmeasured processing completion", () => {
  assert.equal(isCustodyEventSupported("COLLECTED"), true);
  assert.equal(isCustodyEventSupported("TRANSPORT_STARTED"), true);
  assert.equal(isCustodyEventSupported("TRANSFERRED"), false);
  assert.equal(isCustodyEventSupported("PROCESSED"), false);
  assert.equal(isCustodyEventSupported("MADE_UP_EVENT"), false);
});

test("residue lot remains DELIVERED until cumulative processor receipts reconcile to measured lot mass", () => {
  assert.equal(deriveResidueLotStatus(1000, 0), "DELIVERED");
  assert.equal(deriveResidueLotStatus(1000, 400), "DELIVERED");
  assert.equal(deriveResidueLotStatus(1000, 999.99995), "PROCESSED");
  assert.equal(deriveResidueLotStatus(1000, 1000), "PROCESSED");
});

test("residue lot mass-balance status rejects invalid numeric values", () => {
  assert.throws(() => deriveResidueLotStatus(0, 0), RangeError);
  assert.throws(() => deriveResidueLotStatus(1000, -1), RangeError);
  assert.throws(() => deriveResidueLotStatus(Number.NaN, 10), RangeError);
});
