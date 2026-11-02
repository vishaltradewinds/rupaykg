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
