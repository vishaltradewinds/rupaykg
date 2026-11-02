import assert from "node:assert/strict";
import test from "node:test";
import { BM_T011_GWP_CH4_TCO2E_PER_TCH4, calculateBmT011Annual, type BmT011AnnualInput } from "./bm-t-011.js";

const valid: BmT011AnnualInput = {
  activityId: "activity-test-001",
  calculationPeriodId: "baseline-period-2024-2025",
  targetYearIndex: 2,
  calculationMode: "WA03_001_BASELINE_POTENTIAL",
  climateClass: "TROPICAL_WET",
  swdsType: "ANAEROBIC_MANAGED",
  wasteRecords: [
    { yearIndex: 1, wasteType: "PULP_PAPER_CARDBOARD", massWetTonnes: 1000, evidenceRefs: ["evidence://waste/2024/paper"] },
    { yearIndex: 2, wasteType: "FOOD_BEVERAGES_TOBACCO", massWetTonnes: 800, evidenceRefs: ["evidence://waste/2025/food"] },
  ],
  parameterEvidenceRefs: ["evidence://site/climate", "evidence://site/type"],
};

test("BM-T-011 v1.0 annual Application A applies the official FOD equation and deterministic provenance", () => {
  const result = calculateBmT011Annual(valid);
  const expectedPaper = 0.75 * BM_T011_GWP_CH4_TCO2E_PER_TCH4 * 0.9 * (16 / 12) * 0.5 * 0.5 * 1 *
    (1000 * 0.40 * Math.exp(-0.06 * (2 - 1)) * (1 - Math.exp(-0.06)));
  const expectedFood = 0.75 * BM_T011_GWP_CH4_TCO2E_PER_TCH4 * 0.9 * (16 / 12) * 0.5 * 0.5 * 1 *
    (800 * 0.15 * (1 - Math.exp(-0.185)));
  assert.ok(Math.abs(result.emissionsTco2e - expectedPaper - expectedFood) < 1e-10);
  assert.equal(result.status, "CALCULATED_PENDING_VERIFICATION");
  assert.equal(result.parameters.modelCorrectionFactor, 0.75);
  assert.equal(result.parameters.capturedFraction, 0);
  assert.equal(result.trace.length, 2);
  assert.match(result.inputSha256, /^[a-f0-9]{64}$/);
  assert.match(result.outputSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.evidenceRefs, ["evidence://site/climate", "evidence://site/type", "evidence://waste/2024/paper", "evidence://waste/2025/food"]);
  assert.equal(calculateBmT011Annual(valid).outputSha256, result.outputSha256);
});

test("BM-T-011 fails closed for missing years, duplicate waste types, unsupported waste, and missing evidence", () => {
  assert.throws(() => calculateBmT011Annual({ ...valid, wasteRecords: [valid.wasteRecords[1]!] }), /missing year 1/);
  assert.throws(() => calculateBmT011Annual({ ...valid, wasteRecords: [...valid.wasteRecords, valid.wasteRecords[0]!] }), /Duplicate yearIndex/);
  assert.throws(() => calculateBmT011Annual({ ...valid, wasteRecords: [{ ...valid.wasteRecords[0]!, evidenceRefs: [] }, valid.wasteRecords[1]!] }), /evidence references/);
  assert.throws(() => calculateBmT011Annual({ ...valid, parameterEvidenceRefs: [] }), /parameter evidence/);
  assert.throws(() => calculateBmT011Annual({ ...valid, wasteRecords: [{ ...valid.wasteRecords[0]!, massWetTonnes: -1 }, valid.wasteRecords[1]!] }), /finite and non-negative/);
});

test("BM-T-011 does not silently treat the potential calculation as FCH4,BL or accept unsupported application assumptions", () => {
  assert.throws(() => calculateBmT011Annual({ ...valid, capturedFraction: 0.1 }), /requires f=0/);
  assert.throws(() => calculateBmT011Annual({ ...valid, calculationMode: "PROJECT_OR_LEAKAGE" }), /capturedFraction in \[0,1\]/);
  assert.throws(() => calculateBmT011Annual({ ...valid, targetYearIndex: 101 }), /targetYearIndex/);
  assert.equal(calculateBmT011Annual(valid).method, "BM-T-011.V1.0.ANNUAL_FOD.APPLICATION_A");
  assert.equal(calculateBmT011Annual(valid).parameters.gwpCh4Tco2ePerTch4, 29.8);
});
