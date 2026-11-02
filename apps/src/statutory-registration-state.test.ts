import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExternalRegistrationReport } from "./statutory-routes.js";

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
