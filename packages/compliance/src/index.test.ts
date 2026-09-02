import test from "node:test";
import assert from "node:assert/strict";
import { assessEprObligation } from "./index.js";

test("EPR compliance counts only approved, verified evidence", () => {
  const result = assessEprObligation(100, [
    { evidenceId: "e1", verificationId: "v1", approved: true, quantity: 70 },
    { evidenceId: "e2", approved: true, quantity: 50 },
    { evidenceId: "e3", verificationId: "v3", approved: false, quantity: 40 },
  ]);
  assert.equal(result.verifiedQuantity, 70);
  assert.equal(result.remainingQuantity, 30);
  assert.equal(result.status, "EVIDENCE_PENDING");
});

test("zero obligation can be compliant without fabricated evidence", () => {
  const result = assessEprObligation(0, []);
  assert.equal(result.status, "COMPLIANT");
});
