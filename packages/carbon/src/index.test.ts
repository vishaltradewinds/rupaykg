import test from "node:test";
import assert from "node:assert/strict";
import { calculateEmissionReduction, isIssuableCarbonValue, sha256Canonical } from "./index.js";

test("calculates a methodology-versioned result without issuing a credential", () => {
  const result = calculateEmissionReduction({
    activityId: "activity-1",
    methodologyCode: "CCTS-OFFSET",
    methodologyVersion: "2026-01",
    baselineTco2e: 100,
    projectTco2e: 65,
    leakageTco2e: 5,
    uncertaintyTco2e: 2,
  });
  assert.equal(result.grossReductionTco2e, 35);
  assert.equal(result.netReductionTco2e, 30);
  assert.equal(result.status, "CALCULATED_PENDING_VERIFICATION");
  assert.equal(result.normalizedInputs.leakageTco2e, 5);
  assert.equal(result.trace.length, 3);
  assert.equal(result.trace[0].equationId, "CARBON.GROSS_REDUCTION.V1");
  assert.equal(result.trace[2].result, 30);
  assert.equal(isIssuableCarbonValue(result.status, 0), false);
  assert.equal(isIssuableCarbonValue(result.status, 1), true);
});

test("canonical hashing is deterministic regardless of object key order", () => {
  assert.equal(sha256Canonical({ b: 2, a: 1 }), sha256Canonical({ a: 1, b: 2 }));
  assert.notEqual(sha256Canonical({ a: 1 }), sha256Canonical({ a: 2 }));
});

test("rejects negative physical inputs", () => {
  assert.throws(() => calculateEmissionReduction({
    activityId: "activity-1",
    methodologyCode: "CCTS-OFFSET",
    methodologyVersion: "2026-01",
    baselineTco2e: -1,
    projectTco2e: 0,
  }));
});
