import test from "node:test";
import assert from "node:assert/strict";
import { BM_WA03001_PARAMETER_DICTIONARY, BM_WA03002_SOURCE, calculateBmWa03001, calculateEmissionReduction, evaluateBmWa03001Applicability, evaluateBmWa03002Applicability, isGenericCalculationMethodAllowed, isIssuableCarbonValue, sha256Canonical, validateBmWa03001Input } from "./index.js";

test("calculates a methodology-versioned result without issuing a credential", () => {
  const result = calculateEmissionReduction({ activityId: "activity-1", methodologyCode: "CCTS-OFFSET", methodologyVersion: "2026-01", baselineTco2e: 100, projectTco2e: 65, leakageTco2e: 5, uncertaintyTco2e: 2 });
  assert.equal(result.grossReductionTco2e, 35);
  assert.equal(result.netReductionTco2e, 30);
  assert.equal(result.status, "CALCULATED_PENDING_VERIFICATION");
  assert.equal(result.normalizedInputs.leakageTco2e, 5);
  assert.equal(result.trace.length, 3);
  assert.equal(result.trace[0].equationId, "CARBON.GROSS_REDUCTION.V1");
  assert.equal(result.trace[2].result, 30);
  const authorityEvidence = {
    authorityName: "Bureau of Energy Efficiency",
    officialSourceUrl: "https://beeindia.gov.in/",
    issuanceReference: "USER-REPORTED-REF-001",
    artifactSha256: "a".repeat(64),
    verificationStatus: "VERIFIED" as const,
    verificationRecordId: "verification-record-001",
    verifiedAt: "2026-10-18T17:00:00Z",
  };
  assert.equal(isIssuableCarbonValue(result.status, authorityEvidence), false);
  assert.equal(isIssuableCarbonValue("ISSUED", undefined), false);
  assert.equal(isIssuableCarbonValue("ISSUED", { ...authorityEvidence, verificationStatus: "UNVERIFIED" }), false);
  assert.equal(isIssuableCarbonValue("ISSUED", { ...authorityEvidence, artifactSha256: "not-a-hash" }), false);
  assert.equal(isIssuableCarbonValue("ISSUED", authorityEvidence), true);
});

test("canonical hashing is deterministic regardless of object key order", () => {
  assert.equal(sha256Canonical({ b: 2, a: 1 }), sha256Canonical({ a: 1, b: 2 }));
  assert.notEqual(sha256Canonical({ a: 1 }), sha256Canonical({ a: 2 }));
});

test("rejects negative physical inputs", () => {
  assert.throws(() => calculateEmissionReduction({ activityId: "activity-1", methodologyCode: "CCTS-OFFSET", methodologyVersion: "2026-01", baselineTco2e: -1, projectTco2e: 0 }));
});

test("reconciles BM WA03.001 Equation 4 deterministically", () => {
  const result = calculateBmWa03001({ fch4ProjectTch4: 1000, fch4BaselineTch4: 150, gwpCh4Tco2ePerTch4: 29.8, projectEmissionsTco2e: 14, leakageTco2e: 0, oxidationFactor: 0.1 });
  assert.equal(result.methodologyCode, "BM WA03.001");
  assert.equal(result.methodologyVersion, "1.0");
  assert.equal(result.resultTco2e, 22783);
  assert.equal(result.status, "CALCULATED_PENDING_VERIFICATION");
  assert.deepEqual(result.trace.map(step => step.equationId), ["BM.WA03.001.EQ4.METHANE_DELTA.V1", "BM.WA03.001.EQ4.OXIDATION_ADJUSTMENT.V1", "BM.WA03.001.EQ4.PROJECT_AND_LEAKAGE_DEDUCTION.V1"]);
});

test("BM WA03.001 parameter dictionary is explicit and unit-bound", () => {
  assert.deepEqual(BM_WA03001_PARAMETER_DICTIONARY.map(parameter => [parameter.code, parameter.unit, parameter.sourceClass]), [
    ["fch4ProjectTch4", "tCH4", "MONITORED"],
    ["fch4BaselineTch4", "tCH4", "CALCULATED"],
    ["gwpCh4Tco2ePerTch4", "tCO2e/tCH4", "METHODOLOGY_CONSTANT"],
    ["projectEmissionsTco2e", "tCO2e", "MONITORED"],
    ["leakageTco2e", "tCO2e", "CALCULATED"],
    ["oxidationFactor", "fraction", "METHODOLOGY_CONSTANT"],
  ]);
});

test("BM WA03.001 parameter validation fails closed when a required input is absent", () => {
  assert.throws(() => validateBmWa03001Input({ fch4ProjectTch4: 100, fch4BaselineTch4: 10, gwpCh4Tco2ePerTch4: 29.8, projectEmissionsTco2e: 1, leakageTco2e: Number.NaN, oxidationFactor: 0.1 }), /leakageTco2e/);
});

test("BM WA03.001 applicability gate accepts an in-scope landfill activity", () => {
  const result = evaluateBmWa03001Applicability({ sector: "Waste Handling and Disposal", activity: "Landfill methane recovery", reducesOrganicWasteRecycling: false, managementDeliberatelyChangedToIncreaseMethane: false, changeWasRequiredForTechnicalOrRegulatoryReasons: false });
  assert.deepEqual(result, { eligible: true, reasons: [] });
});

test("BM WA03.001 applicability gate fails closed for restricted activities", () => {
  const result = evaluateBmWa03001Applicability({ sector: "Waste Handling and Disposal", activity: "Landfill methane recovery", reducesOrganicWasteRecycling: true, managementDeliberatelyChangedToIncreaseMethane: true, changeWasRequiredForTechnicalOrRegulatoryReasons: false });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.length, 2);
});

test("BM WA03.001 applicability gate rejects the wrong sector", () => {
  const result = evaluateBmWa03001Applicability({ sector: "Energy Industries", activity: "Landfill methane recovery", reducesOrganicWasteRecycling: false, managementDeliberatelyChangedToIncreaseMethane: false, changeWasRequiredForTechnicalOrRegulatoryReasons: false });
  assert.equal(result.eligible, false);
  assert.match(result.reasons[0], /sector/);
});

test("BM WA03.001 rejects invalid oxidation factors", () => {
  assert.throws(() => calculateBmWa03001({ fch4ProjectTch4: 1, fch4BaselineTch4: 0, gwpCh4Tco2ePerTch4: 29.8, projectEmissionsTco2e: 0, leakageTco2e: 0, oxidationFactor: 1.1 }));
});


test("official BEE CCTS methods and tools cannot use generic baseline/project arithmetic", () => {
  for (const code of ["BM EN01.001", "BM IN02.001", "BM WA03.001", "BM WA03.002", "BM WA03.003", "BM-T-011", "BMT-T-AR-0006"]) {
    assert.equal(isGenericCalculationMethodAllowed(code), false, code);
    assert.throws(() => calculateEmissionReduction({
      activityId: "activity-1",
      methodologyCode: code,
      methodologyVersion: "1.0",
      baselineTco2e: 100,
      projectTco2e: 65,
      leakageTco2e: 0,
    }), /method-specific calculation adapter/);
  }
  assert.equal(isGenericCalculationMethodAllowed("RUPAYKG_GENERIC_BASELINE_DELTA_V1"), true);
});

test("empty methodology identifiers cannot enter generic calculator", () => {
  assert.equal(isGenericCalculationMethodAllowed("  "), false);
  assert.throws(() => calculateEmissionReduction({
    activityId: "activity-1",
    methodologyCode: " ",
    methodologyVersion: "1.0",
    baselineTco2e: 100,
    projectTco2e: 65,
  }), /method-specific calculation adapter/);
});


test("BM WA03.002 screens a supported new capture-and-flare project without claiming production eligibility", () => {
  const result = evaluateBmWa03002Applicability({
    sector: "Waste Handling and Disposal",
    activity: "Capture and flare landfill gas",
    capturePath: "NEW_CAPTURE_SYSTEM",
    noPriorCaptureSystemInstalledOrPlanned: true,
    increasedRecoveryRateOrChangedUse: null,
    preProjectUse: "UNKNOWN",
    capturedAmountCanBeSeparatedFromExistingSystem: null,
    existingSystemEfficiencyImpactedByProject: null,
    historicalCaptureDataAvailable: null,
    endUses: ["FLARING"],
    reducesOrganicWasteRecycling: false,
    combinedWithAnotherApprovedMethodology: false,
    managementDeliberatelyChangedToIncreaseMethane: false,
    baselineScenarioConfirmed: true,
  });
  assert.equal(result.methodologyCode, "BM WA03.002");
  assert.equal(result.methodologyVersion, "1.0");
  assert.equal(result.screeningStatus, "PASS_FOR_FURTHER_REVIEW");
  assert.deepEqual(result.requiredSectoralScopes, ["03: Waste handling and disposal"]);
  assert.equal(result.productionEligible, false);
  assert.equal(result.dependencyReconciliationRequired, true);
  assert.deepEqual(result.requiredTools, BM_WA03002_SOURCE.requiredTools);
});

test("BM WA03.002 screen fails for restricted recycling, mixed-methodology, and methane-increase conditions", () => {
  const result = evaluateBmWa03002Applicability({
    sector: "Waste Handling and Disposal",
    activity: "Capture and use landfill gas",
    capturePath: "NEW_CAPTURE_SYSTEM",
    noPriorCaptureSystemInstalledOrPlanned: true,
    increasedRecoveryRateOrChangedUse: null,
    preProjectUse: "UNKNOWN",
    capturedAmountCanBeSeparatedFromExistingSystem: null,
    existingSystemEfficiencyImpactedByProject: null,
    historicalCaptureDataAvailable: null,
    endUses: ["ELECTRICITY"],
    reducesOrganicWasteRecycling: true,
    combinedWithAnotherApprovedMethodology: true,
    managementDeliberatelyChangedToIncreaseMethane: true,
    baselineScenarioConfirmed: true,
  });
  assert.equal(result.screeningStatus, "FAIL");
  assert.equal(result.productionEligible, false);
  assert.ok(result.reasons.some(reason => reason.includes("recycling")));
  assert.ok(result.reasons.some(reason => reason.includes("combination")));
  assert.ok(result.reasons.some(reason => reason.includes("increase methane")));
  assert.deepEqual(result.requiredSectoralScopes, ["03: Waste handling and disposal", "01: Energy"]);
});

test("BM WA03.002 screen remains unresolved when existing-system evidence is missing", () => {
  const result = evaluateBmWa03002Applicability({
    sector: "Waste Handling and Disposal",
    activity: "Improve existing landfill-gas capture",
    capturePath: "EXISTING_SYSTEM_IMPROVEMENT",
    noPriorCaptureSystemInstalledOrPlanned: null,
    increasedRecoveryRateOrChangedUse: true,
    preProjectUse: "UNKNOWN",
    capturedAmountCanBeSeparatedFromExistingSystem: false,
    existingSystemEfficiencyImpactedByProject: false,
    historicalCaptureDataAvailable: null,
    endUses: ["NATURAL_GAS_NETWORK"],
    reducesOrganicWasteRecycling: false,
    combinedWithAnotherApprovedMethodology: false,
    managementDeliberatelyChangedToIncreaseMethane: false,
    baselineScenarioConfirmed: false,
  });
  assert.equal(result.screeningStatus, "UNRESOLVED");
  assert.ok(result.reasons.some(reason => reason.includes("pre-project")));
  assert.ok(result.reasons.some(reason => reason.includes("historical capture data")));
  assert.ok(result.reasons.some(reason => reason.includes("baseline scenario")));
  assert.deepEqual(result.requiredSectoralScopes, ["03: Waste handling and disposal", "01: Energy"]);
});

test("BM WA03.002 existing-system pathway requires historical data when gas cannot be separated and efficiency is unaffected", () => {
  const result = evaluateBmWa03002Applicability({
    sector: "Waste Handling and Disposal",
    activity: "Improve existing landfill-gas capture",
    capturePath: "EXISTING_SYSTEM_IMPROVEMENT",
    noPriorCaptureSystemInstalledOrPlanned: null,
    increasedRecoveryRateOrChangedUse: true,
    preProjectUse: "VENTED_OR_FLARED_NOT_USED",
    capturedAmountCanBeSeparatedFromExistingSystem: false,
    existingSystemEfficiencyImpactedByProject: false,
    historicalCaptureDataAvailable: false,
    endUses: ["FLARING"],
    reducesOrganicWasteRecycling: false,
    combinedWithAnotherApprovedMethodology: false,
    managementDeliberatelyChangedToIncreaseMethane: false,
    baselineScenarioConfirmed: true,
  });
  assert.equal(result.screeningStatus, "FAIL");
  assert.ok(result.reasons.some(reason => reason.includes("historical capture data is required")));
});


test("BM WA03.002 screen does not treat missing safeguards as false", () => {
  const result = evaluateBmWa03002Applicability({
    sector: "Waste Handling and Disposal",
    activity: "Capture landfill gas",
    capturePath: "NEW_CAPTURE_SYSTEM",
    noPriorCaptureSystemInstalledOrPlanned: true,
    increasedRecoveryRateOrChangedUse: null,
    preProjectUse: "UNKNOWN",
    capturedAmountCanBeSeparatedFromExistingSystem: null,
    existingSystemEfficiencyImpactedByProject: null,
    historicalCaptureDataAvailable: null,
    endUses: ["FLARING"],
    reducesOrganicWasteRecycling: null,
    combinedWithAnotherApprovedMethodology: null,
    managementDeliberatelyChangedToIncreaseMethane: null,
    baselineScenarioConfirmed: true,
  });
  assert.equal(result.screeningStatus, "UNRESOLVED");
  assert.ok(result.reasons.some(reason => reason.includes("recycling is unresolved")));
  assert.ok(result.reasons.some(reason => reason.includes("combination with another")));
  assert.ok(result.reasons.some(reason => reason.includes("increase methane is unresolved")));
});
