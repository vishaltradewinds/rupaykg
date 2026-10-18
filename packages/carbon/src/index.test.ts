import test from "node:test";
import assert from "node:assert/strict";
import { BM_WA03001_PARAMETER_DICTIONARY, calculateBmWa03001, calculateEmissionReduction, evaluateBmWa03001Applicability, evaluateBmWa03001Readiness, isGenericCalculationMethodAllowed, isIssuableCarbonValue, sha256Canonical, validateBmWa03001Input, type BmWa03001ReadinessInput } from "./index.js";

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

function completeBmWa03001ReadinessInput(overrides: Partial<BmWa03001ReadinessInput> = {}): BmWa03001ReadinessInput {
  const toolStatuses = Object.fromEntries(["BM-T-001","BM-T-002","BM-T-003","BM-T-004","BM-T-006","BM-T-011"].map(code => [code,"CURRENT_APPROVED_VERSION_CONFIRMED"])) as BmWa03001ReadinessInput["toolStatuses"];
  return {
    sector: "Waste Handling and Disposal",
    activity: "Capture and combust methane from a landfill containing biodegradable organic matter",
    reducesOrganicWasteRecycling: false,
    managementDeliberatelyChangedToIncreaseMethane: false,
    changeWasRequiredForTechnicalOrRegulatoryReasons: false,
    landfillSiteType: "SOLID_WASTE_DISPOSAL_SITE",
    containsBiodegradableOrganicMatter: true,
    recoveredGasUse: "FLARING_ONLY",
    methaneQuantificationPath: "FLOW_AND_METHANE_MEASUREMENT",
    additionalityPath: "BM_T_001",
    projectBoundaryDefined: true,
    flowMetersCalibrated: true,
    samplingAndGasAnalyserCalibrated: true,
    continuousFlowMetering: true,
    methaneMeasurementMethod: "CONTINUOUS_ANALYSER",
    flowAndMethaneHumidityBasisAligned: true,
    gasFlowIsNormalized: true,
    gasTemperaturePressureEvidence: null,
    electricityGenerationEvidence: null,
    equipmentEfficiencyEvidence: null,
    landfillGasOnlyPowerEvidence: null,
    startupFuelWithinLimit: null,
    baselineAndAdditionalityEvidence: true,
    toolStatuses,
    ...overrides,
  };
}

test("BM WA03.001 full readiness is conditional and returns required sectoral scope and tools", () => {
  const result = evaluateBmWa03001Readiness(completeBmWa03001ReadinessInput());
  assert.equal(result.status, "ELIGIBLE_FOR_FURTHER_ASSESSMENT");
  assert.deepEqual(result.requiredSectoralScopes, ["03: Waste handling and disposal"]);
  assert.deepEqual(result.requiredTools, ["BM-T-001","BM-T-002","BM-T-003","BM-T-004","BM-T-006","BM-T-011"]);
  assert.equal(result.source.version, "1.0");
  assert.match(result.source.url, /BM%20WA03\.001\.pdf/);
});

test("BM WA03.001 requires both Waste and Energy scopes when recovered gas is used beyond flaring", () => {
  const result = evaluateBmWa03001Readiness(completeBmWa03001ReadinessInput({ recoveredGasUse: "POWER_GENERATION" }));
  assert.deepEqual(result.requiredSectoralScopes, ["03: Waste handling and disposal", "01: Energy"]);
  assert.equal(result.status, "ELIGIBLE_FOR_FURTHER_ASSESSMENT");
});

test("BM WA03.001 fails closed when current tool approval or monitoring evidence is unresolved", () => {
  const toolStatuses = { ...completeBmWa03001ReadinessInput().toolStatuses, "BM-T-011": "NOT_CONFIRMED" as const };
  const result = evaluateBmWa03001Readiness(completeBmWa03001ReadinessInput({ toolStatuses, flowMetersCalibrated: null, samplingAndGasAnalyserCalibrated: null, baselineAndAdditionalityEvidence: null }));
  assert.equal(result.status, "UNRESOLVED");
  assert.ok(result.reasons.some(reason => reason.includes("BM-T-011")));
  assert.ok(result.reasons.some(reason => reason.includes("calibration")));
  assert.ok(result.reasons.some(reason => reason.includes("baseline and additionality")));
});

test("BM WA03.001 positive-list pathway remains unresolved while referenced BM-T-012 is absent from current BEE register", () => {
  const result = evaluateBmWa03001Readiness(completeBmWa03001ReadinessInput({ additionalityPath: "POSITIVE_LIST_BM_T_012" }));
  assert.equal(result.status, "UNRESOLVED");
  assert.ok(result.requiredTools.includes("BM-T-012"));
  assert.ok(result.reasons.some(reason => reason.includes("BM-T-012") && reason.includes("absent")));
});

test("BM WA03.001 returns INELIGIBLE for a known disqualifier rather than an unresolved green status", () => {
  const result = evaluateBmWa03001Readiness(completeBmWa03001ReadinessInput({ reducesOrganicWasteRecycling: true }));
  assert.equal(result.status, "INELIGIBLE");
  assert.ok(result.reasons.some(reason => reason.includes("must not reduce organic-waste recycling")));
});

test("BM WA03.001 permits the electricity-generation methane calculation path only with its required evidence", () => {
  const result = evaluateBmWa03001Readiness(completeBmWa03001ReadinessInput({
    recoveredGasUse: "POWER_GENERATION",
    methaneQuantificationPath: "ELECTRICITY_GENERATION_EQUATION_6",
    electricityGenerationEvidence: true,
    equipmentEfficiencyEvidence: true,
    landfillGasOnlyPowerEvidence: true,
    startupFuelWithinLimit: true,
  }));
  assert.equal(result.status, "ELIGIBLE_FOR_FURTHER_ASSESSMENT");
  assert.deepEqual(result.requiredSectoralScopes, ["03: Waste handling and disposal", "01: Energy"]);
});

test("BM WA03.001 does not allow Equation 6 for a flaring-only project", () => {
  const result = evaluateBmWa03001Readiness(completeBmWa03001ReadinessInput({
    methaneQuantificationPath: "ELECTRICITY_GENERATION_EQUATION_6",
    electricityGenerationEvidence: true,
    equipmentEfficiencyEvidence: true,
  }));
  assert.equal(result.status, "UNRESOLVED");
  assert.ok(result.reasons.some(reason => reason.includes("only for recovered-methane power-generation")));
});

test("BM WA03.001 requires gas temperature and pressure when the flow meter does not normalize flow", () => {
  const result = evaluateBmWa03001Readiness(completeBmWa03001ReadinessInput({ gasFlowIsNormalized: false }));
  assert.equal(result.status, "UNRESOLVED");
  assert.ok(result.reasons.some(reason => reason.includes("temperature and pressure")));
});
