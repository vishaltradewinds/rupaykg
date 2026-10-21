import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEprRegistrationInput } from "./statutory-routes.js";

test("generic EPR writes never assert externally registered CPCB status", () => {
  const result = normalizeEprRegistrationInput(" CPCB-REF-9 ", "REGISTERED_EXTERNALLY", { source: "user" });
  assert.equal(result.persistedStatus, "NOT_ASSERTED");
  assert.equal(result.reference, " CPCB-REF-9 ");
  assert.equal(result.basis.cpcb_registration_reference_trust_state, "USER_REPORTED_UNVERIFIED");
  assert.equal(result.basis.cpcb_registration_status_reported_by_user, "REGISTERED_EXTERNALLY");
  assert.equal(result.basis.source, "user");
});

test("generic EPR writes without external reference remain not asserted", () => {
  const result = normalizeEprRegistrationInput(null, null, {});
  assert.equal(result.persistedStatus, "NOT_ASSERTED");
  assert.equal(result.reference, null);
  assert.equal(result.basis.cpcb_registration_reference_trust_state, undefined);
});

test("existing basis JSON string is preserved when adding unverified registration metadata", () => {
  const result = normalizeEprRegistrationInput("REF-2", "REGISTERED_EXTERNALLY", '{"existing":"keep"}');
  assert.equal(result.basis.existing, "keep");
  assert.equal(result.basis.cpcb_registration_reference_trust_state, "USER_REPORTED_UNVERIFIED");
});

import { isValidIsoCalendarDate, positiveEprQuantity } from "./epr-return-routes.js";

test("EPR return quantity accepts only positive finite JSON numbers", () => {
  for (const value of ["12", "1e2", null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(positiveEprQuantity({ quantity: value }, "quantity"), null, `reject ${String(value)}`);
  }
  assert.equal(positiveEprQuantity({ quantity: 12 }, "quantity"), 12);
  assert.equal(positiveEprQuantity({ quantity: 1.5 }, "quantity"), 1.5);
});

test("EPR return periods require real ISO calendar dates", () => {
  for (const value of ["2026-02-30", "2026-13-01", "2026-1-01", "01-10-2026", "2026-10-21T00:00:00Z", ""]) {
    assert.equal(isValidIsoCalendarDate(value), false, `reject ${value}`);
  }
  assert.equal(isValidIsoCalendarDate("2026-10-21"), true);
  assert.equal(isValidIsoCalendarDate("2024-02-29"), true);
});
