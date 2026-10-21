import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExternalRegistrationReport, nonNegativeEprInput } from "./statutory-routes.js";

test("a user-entered external registration reference never becomes authority-verified status", () => {
  assert.deepEqual(
    normalizeExternalRegistrationReport("CPCB-REF-123", "REGISTERED_EXTERNALLY"),
    {
      reference: "CPCB-REF-123",
      persistedStatus: "NOT_ASSERTED",
      trustState: "USER_REPORTED_UNVERIFIED",
    },
  );
});

test("missing reference or unsupported status is rejected", () => {
  assert.equal(normalizeExternalRegistrationReport(null, "REGISTERED_EXTERNALLY"), null);
  assert.equal(normalizeExternalRegistrationReport("", "REGISTERED_EXTERNALLY"), null);
  assert.equal(normalizeExternalRegistrationReport("CPCB-REF-123", "APPROVED"), null);
  assert.equal(normalizeExternalRegistrationReport("CPCB-REF-123", null), null);
});

test("optional statutory measurements reject numeric strings and non-finite values", () => {
  for (const value of ["12", "1e2", true, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.equal(nonNegativeEprInput({ quantity: value }, "quantity"), null);
  }
  assert.equal(nonNegativeEprInput({ quantity: 0 }, "quantity"), 0);
  assert.equal(nonNegativeEprInput({ quantity: 1.25 }, "quantity"), 1.25);
  assert.equal(nonNegativeEprInput({}, "quantity"), undefined);
});
