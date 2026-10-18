import test from "node:test";
import assert from "node:assert/strict";
import { assessBwgEligibility, initialSwmChecklist, type BwgEligibilityInputs } from "./cpcb-swm.js";

function observation(value: number | null, unit: string, sourceReference = "evidence://measurement", periodStart = "2026-09-01", periodEnd = "2026-09-30") {
  return { value, unit, sourceReference, periodStart, periodEnd };
}

function inputs(overrides: Partial<BwgEligibilityInputs> = {}): BwgEligibilityInputs {
  return {
    floorAreaM2: observation(100, "m2"),
    waterConsumptionLitresPerDay: observation(100, "L/day"),
    wasteGenerationKgPerDay: observation(10, "kg/day"),
    ...overrides,
  };
}

test("BWG thresholds are alternative OR criteria, not cumulative", () => {
  const result = assessBwgEligibility(inputs({ floorAreaM2: observation(20_000, "m2") }));
  assert.equal(result.status, "ELIGIBLE_PRECHECK");
  assert.deepEqual(result.qualifyingCriteria, ["FLOOR_AREA"]);
});

test("BWG threshold boundaries qualify at 20,000 m2, 40,000 L/day and 100 kg/day", () => {
  assert.equal(assessBwgEligibility(inputs({ floorAreaM2: observation(20_000, "m2") })).status, "ELIGIBLE_PRECHECK");
  assert.equal(assessBwgEligibility(inputs({ waterConsumptionLitresPerDay: observation(40_000, "L/day") })).status, "ELIGIBLE_PRECHECK");
  assert.equal(assessBwgEligibility(inputs({ wasteGenerationKgPerDay: observation(100, "kg/day") })).status, "ELIGIBLE_PRECHECK");
});

test("missing values do not become zero or a negative eligibility determination", () => {
  const result = assessBwgEligibility(inputs({ floorAreaM2: observation(null, "m2"), waterConsumptionLitresPerDay: observation(null, "L/day"), wasteGenerationKgPerDay: observation(null, "kg/day") }));
  assert.equal(result.status, "UNRESOLVED");
  assert.equal(result.missingOrInvalid.length, 3);
});

test("invalid unit, missing source, invalid period and negative value fail closed", () => {
  const result = assessBwgEligibility(inputs({
    floorAreaM2: observation(25_000, "sqft"),
    waterConsumptionLitresPerDay: observation(50_000, "L/day", ""),
    wasteGenerationKgPerDay: observation(-1, "kg/day"),
  }));
  assert.equal(result.status, "UNRESOLVED");
  assert.ok(result.missingOrInvalid.includes("floorAreaM2:UNIT_MISMATCH"));
  assert.ok(result.missingOrInvalid.includes("waterConsumptionLitresPerDay:SOURCE_MISSING"));
  assert.ok(result.missingOrInvalid.includes("wasteGenerationKgPerDay:INVALID_VALUE"));
});

test("below-threshold complete, sourced observations are a pre-check only", () => {
  const result = assessBwgEligibility(inputs());
  assert.equal(result.status, "NOT_ELIGIBLE_PRECHECK");
  assert.equal(result.disclaimer, "READINESS_AID_NOT_OFFICIAL_CPCB_DETERMINATION");
});

test("stakeholder checklists distinguish guide-listed from rule-derived requirements", () => {
  const bwg = initialSwmChecklist("BWG");
  assert.ok(bwg.some(item => item.key === "property_or_building_document" && item.officialRequirement === "GUIDE_LISTED"));
  assert.ok(bwg.some(item => item.key === "ebwgr_evidence" && item.officialRequirement === "RULE_DERIVED"));
  assert.ok(bwg.every(item => item.status === "MISSING"));
  const facility = initialSwmChecklist("WASTE_FACILITY");
  assert.ok(facility.some(item => item.key === "consent_to_operate"));
  const localBody = initialSwmChecklist("ULB");
  assert.ok(localBody.some(item => item.key === "certificate_issuance_boundary"));
});
