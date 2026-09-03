import test from "node:test";
import assert from "node:assert/strict";
import { calculateBmWa03001, calculateEmissionReduction, evaluateBmWa03001Applicability, isIssuableCarbonValue, sha256Canonical } from "./index.js";

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

test("reconciles BM WA03.001 Equation 4 deterministically", () => {
  const result = calculateBmWa03001({
    fch4ProjectTch4: 1000,
    fch4BaselineTch4: 150,
    gwpCh4Tco2ePerTch4: 29.8,
    projectEmissionsTco2e: 14,
    leakageTco2e: 0,
    oxidationFactor: 0.1,
  });
  assert.equal(result.methodologyCode, "BM WA03.001");
  assert.equal(result.methodologyVersion, "1.0");
  assert.equal(result.resultTco2e, 22783);
  assert.equal(result.status, "CALCULATED_PENDING_VERIFICATION");
  assert.deepEqual(result.trace.map(step => step.equationId), [
    "BM.WA03.001.EQ4.METHANE_DELTA.V1",
    "BM.WA03.001.EQ4.OXIDATION_ADJUSTMENT.V1",
    "BM.WA03.001.EQ4.PROJECT_AND_LEAKAGE_DEDUCTION.V1",
  ]);
});

test("BM WA03.001 applicability gate accepts an in-scope landfill activity", () => {
  const result = evaluateBmWa03001Applicability({
    sector: "Waste Handling and Disposal",
    activity: "Landfill methane recovery",
    reducesOrganicWasteRecycling: false,
    managementDeliberatelyChangedToIncreaseMethane: false,
    changeWasRequiredForTechnicalOrRegulatoryReasons: false,
  });
  assert.deepEqual(result, { eligible: true, reasons: [] });
});

test("BM WA03.001 applicability gate fails closed for restricted activities", () => {
  const result = evaluateBmWa03001Applicability({
    sector: "Waste Handling and Disposal",
    activity: "Landfill methane recovery",
    reducesOrganicWasteRecycling: true,
    managementDeliberatelyChangedToIncreaseMethane: true,
    changeWasRequiredForTechnicalOrRegulatoryReasons: false,
  });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.length, 2);
});

test("BM WA03.001 applicability gate rejects the wrong sector", () => {
  const result = evaluateBmWa03001Applicability({
    sector: "Energy Industries",
    activity: "Landfill methane recovery",
    reducesOrganicWasteRecycling: false,
    managementDeliberatelyChangedToIncreaseMethane: false,
    changeWasRequiredForTechnicalOrRegulatoryReasons: false,
  });
  assert.equal(result.eligible, false);
  assert.match(result.reasons[0], /sector/);
});

test("BM WA03.001 rejects invalid oxidation factors", () => {
  assert.throws(() => calculateBmWa03001({
    fch4ProjectTch4: 1,
    fch4BaselineTch4: 0,
    gwpCh4Tco2ePerTch4: 29.8,
    projectEmissionsTco2e: 0,
    leakageTco2e: 0,
    oxidationFactor: 1.1,
  }));
});
