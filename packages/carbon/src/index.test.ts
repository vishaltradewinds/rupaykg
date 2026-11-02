import test from "node:test";
import assert from "node:assert/strict";
import { BM_WA03001_PARAMETER_DICTIONARY, BM_WA03001_MONITORING_PARAMETER_DICTIONARY, BM_WA03001_SOURCE, BM_WA03001_GWP_CH4_TCO2E_PER_TCH4, BM_WA03002_SOURCE, calculateBmWa03001ProjectMethaneFromFlow, calculateBmWa03001, reconcileBmWa03001Equation4Inputs, calculateEmissionReduction, evaluateBmWa03001Applicability, evaluateBmWa03002Applicability, isGenericCalculationMethodAllowed, isIssuableCarbonValue, sha256Canonical, validateBmWa03001Input } from "./index.js";

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


test("BM WA03.002 screen rejects malformed runtime inputs without throwing", () => {
  const result = evaluateBmWa03002Applicability({
    sector: null as never,
    activity: null as never,
    capturePath: "NEW_CAPTURE_SYSTEM",
    noPriorCaptureSystemInstalledOrPlanned: true,
    increasedRecoveryRateOrChangedUse: null,
    preProjectUse: "UNKNOWN",
    capturedAmountCanBeSeparatedFromExistingSystem: null,
    existingSystemEfficiencyImpactedByProject: null,
    historicalCaptureDataAvailable: null,
    endUses: null as never,
    reducesOrganicWasteRecycling: false,
    combinedWithAnotherApprovedMethodology: false,
    managementDeliberatelyChangedToIncreaseMethane: false,
    baselineScenarioConfirmed: true,
  });
  assert.equal(result.screeningStatus, "FAIL");
  assert.ok(result.reasons.some(reason => reason.includes("sector")));
  assert.ok(result.reasons.some(reason => reason.includes("activity description")));
  assert.ok(result.reasons.some(reason => reason.includes("end use")));
});

test("BM WA03.001 Equation 5 aggregates measured methane mass with traceable calibration evidence", () => {
  const result = calculateBmWa03001ProjectMethaneFromFlow([
    { periodId: "2026-01", lfgVolumeM3: 1000, methaneVolumeFraction: 0.5, methaneDensityTPerM3: 0.000716, methaneDensityEvidence: "evidence://density/measurement-period", densityBasis: "NORMALIZED_REFERENCE_CONDITIONS" as const, densityReferenceConditions: "0 degC; 101325 Pa", volumeAndCompositionBasis: "DRY", flowMeterId: "FM-1", flowMeterCalibrationEvidence: "evidence://calibration/FM-1", flowMeasurementEvidence: "evidence://measurements/flow/FM-1", methaneAnalyserId: "MA-1", analyserCalibrationEvidence: "evidence://calibration/MA-1", methaneMeasurementEvidence: "evidence://measurements/methane/MA-1", measuredAt: "2026-01-01T00:00:00Z" },
    { periodId: "2026-02", lfgVolumeM3: 2000, methaneVolumeFraction: 0.55, methaneDensityTPerM3: 0.000716, methaneDensityEvidence: "evidence://density/measurement-period", densityBasis: "NORMALIZED_REFERENCE_CONDITIONS" as const, densityReferenceConditions: "0 degC; 101325 Pa", volumeAndCompositionBasis: "DRY", flowMeterId: "FM-1", flowMeterCalibrationEvidence: "evidence://calibration/FM-1", flowMeasurementEvidence: "evidence://measurements/flow/FM-1", methaneAnalyserId: "MA-1", analyserCalibrationEvidence: "evidence://calibration/MA-1", methaneMeasurementEvidence: "evidence://measurements/methane/MA-1", measuredAt: "2026-02-01T00:00:00Z" },
  ]);
  assert.ok(Math.abs(result.fch4ProjectTch4 - 1.1456) < 1e-12);
  assert.equal(result.status, "CALCULATED_PENDING_VERIFICATION");
  assert.equal(result.method, "BM.WA03.001.EQ5.FLOW_AND_COMPOSITION.V1");
  assert.equal(result.trace.length, 2);
  assert.equal(result.trace[0].evidenceRefs.length, 5);
  assert.match(result.inputSha256, /^[a-f0-9]{64}$/);
  assert.match(result.outputSha256, /^[a-f0-9]{64}$/);
  assert.match(result.trace[0].inputSha256, /^[a-f0-9]{64}$/);
  assert.match(result.trace[0].resultSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.outputSha256, calculateBmWa03001ProjectMethaneFromFlow([{ periodId: "2026-01", lfgVolumeM3: 1000, methaneVolumeFraction: 0.5, methaneDensityTPerM3: 0.000716, methaneDensityEvidence: "evidence://density/measurement-period", densityBasis: "NORMALIZED_REFERENCE_CONDITIONS", densityReferenceConditions: "0 degC; 101325 Pa", volumeAndCompositionBasis: "DRY", flowMeterId: "FM-1", flowMeterCalibrationEvidence: "evidence://calibration/FM-1", flowMeasurementEvidence: "evidence://measurements/flow/FM-1", methaneAnalyserId: "MA-1", analyserCalibrationEvidence: "evidence://calibration/MA-1", methaneMeasurementEvidence: "evidence://measurements/methane/MA-1", measuredAt: "2026-01-01T00:00:00Z" }, { periodId: "2026-02", lfgVolumeM3: 2000, methaneVolumeFraction: 0.55, methaneDensityTPerM3: 0.000716, methaneDensityEvidence: "evidence://density/measurement-period", densityBasis: "NORMALIZED_REFERENCE_CONDITIONS", densityReferenceConditions: "0 degC; 101325 Pa", volumeAndCompositionBasis: "DRY", flowMeterId: "FM-1", flowMeterCalibrationEvidence: "evidence://calibration/FM-1", flowMeasurementEvidence: "evidence://measurements/flow/FM-1", methaneAnalyserId: "MA-1", analyserCalibrationEvidence: "evidence://calibration/MA-1", methaneMeasurementEvidence: "evidence://measurements/methane/MA-1", measuredAt: "2026-02-01T00:00:00Z" }]).outputSha256);
});

test("BM WA03.001 Equation 5 fails closed without calibration evidence or consistent humidity basis", () => {
  const valid = { periodId: "2026-01", lfgVolumeM3: 1000, methaneVolumeFraction: 0.5, methaneDensityTPerM3: 0.000716, methaneDensityEvidence: "evidence://density/measurement-period", densityBasis: "NORMALIZED_REFERENCE_CONDITIONS" as const, densityReferenceConditions: "0 degC; 101325 Pa", volumeAndCompositionBasis: "DRY" as const, flowMeterId: "FM-1", flowMeterCalibrationEvidence: "evidence://calibration/FM-1", flowMeasurementEvidence: "evidence://measurements/flow/FM-1", methaneAnalyserId: "MA-1", analyserCalibrationEvidence: "evidence://calibration/MA-1", methaneMeasurementEvidence: "evidence://measurements/methane/MA-1", measuredAt: "2026-01-01T00:00:00Z" };
  assert.throws(() => calculateBmWa03001ProjectMethaneFromFlow([{ ...valid, analyserCalibrationEvidence: "" }]), /calibration evidence/);
  assert.throws(() => calculateBmWa03001ProjectMethaneFromFlow([{ ...valid, flowMeasurementEvidence: "" }]), /raw flow and methane measurement evidence/);
  assert.throws(() => calculateBmWa03001ProjectMethaneFromFlow([{ ...valid, methaneDensityEvidence: "" }]), /density evidence and reference conditions/);
  assert.throws(() => calculateBmWa03001ProjectMethaneFromFlow([{ ...valid, densityBasis: "MEASURED_T_P", gasTemperatureC: 15 }]), /positive gas pressure/);
  assert.throws(() => calculateBmWa03001ProjectMethaneFromFlow([{ ...valid, volumeAndCompositionBasis: "UNKNOWN" as "DRY" }]), /humidity basis/);
  assert.throws(() => calculateBmWa03001ProjectMethaneFromFlow([{ ...valid, methaneVolumeFraction: 1.2 }]), /fraction between 0 and 1/);
  assert.throws(() => calculateBmWa03001ProjectMethaneFromFlow([]), /At least one/);
});

test("BM WA03.001 v1.0 fixes methane GWP to the official value", () => {
  assert.equal(BM_WA03001_GWP_CH4_TCO2E_PER_TCH4, 29.8);
  assert.throws(() => calculateBmWa03001({ fch4ProjectTch4: 100, fch4BaselineTch4: 10, gwpCh4Tco2ePerTch4: 28, projectEmissionsTco2e: 1, leakageTco2e: 0, oxidationFactor: 0.1 }), /official BM WA03.001 v1.0 value/);
});
test("BM WA03.001 official monitoring dictionary and tool dependencies match BEE v1.0", () => {
  assert.deepEqual(BM_WA03001_SOURCE.requiredTools, ["BM-T-001", "BM-T-002", "BM-T-003", "BM-T-004", "BM-T-006", "BM-T-011", "BM-T-012"]);
  assert.deepEqual(BM_WA03001_MONITORING_PARAMETER_DICTIONARY.map(parameter => parameter.code), ["PEpower,y", "PEflare,y", "PEprocess,y", "LFGi,y", "wCH4,y", "T", "P", "EGy", "EEy", "GWPCH4"]);
  assert.equal(BM_WA03001_MONITORING_PARAMETER_DICTIONARY.find(parameter => parameter.code === "wCH4,y")?.monitoringRule.includes("not permitted"), true);
  assert.equal(BM_WA03001_MONITORING_PARAMETER_DICTIONARY.find(parameter => parameter.code === "GWPCH4")?.monitoringRule.includes("29.8"), true);
});

test("BM WA03.001 Equation 4 requires a hash-matched approved baseline linked to the same activity", () => {
  const approvedAt = "2026-10-19T12:00:00.000Z";
  const baselineCore = { activityId: "activity-verified-1", organizationId: "org-verified-1", methodologyCode: "BM WA03.001" as const, methodologyVersion: "1.0" as const, baselineFch4Tch4: 150, baselinePeriod: "approved baseline period 2025", evidenceIds: ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"], submittedByIdentityId: "identity:proponent-1" };
  const baseline = { ...baselineCore, baselineRecordId: "baseline-001", baselineStatus: "APPROVED" as const, baselineEvidenceRefs: baselineCore.evidenceIds, baselineRecordSha256: sha256Canonical(baselineCore), approvedBy: "identity:verifier-1", approvedAt };
  const projectMethane = calculateBmWa03001ProjectMethaneFromFlow([{
    periodId: "2026-01", lfgVolumeM3: 1000, methaneVolumeFraction: 0.5, methaneDensityTPerM3: 0.000716,
    methaneDensityEvidence: "evidence://density/measurement-period", densityBasis: "NORMALIZED_REFERENCE_CONDITIONS",
    densityReferenceConditions: "0 degC; 101325 Pa", volumeAndCompositionBasis: "DRY", flowMeterId: "FM-1",
    flowMeterCalibrationEvidence: "evidence://calibration/FM-1", flowMeasurementEvidence: "evidence://measurements/flow/FM-1",
    methaneAnalyserId: "MA-1", analyserCalibrationEvidence: "evidence://calibration/MA-1",
    methaneMeasurementEvidence: "evidence://measurements/methane/MA-1", measuredAt: "2026-01-01T00:00:00Z",
  }]);
  const monitoring = { activityId: "activity-verified-1", monitoringRecordId: "monitoring-001", monitoringPeriodId: "2026-01", projectMethane, projectEmissionsTco2e: 12, leakageTco2e: 1, oxidationFactor: 0.1, evidenceRefs: ["evidence://project/pe", "evidence://project/leakage"] };
  const result = reconcileBmWa03001Equation4Inputs(baseline, monitoring);
  assert.equal(result.input.fch4BaselineTch4, 150);
  assert.equal(result.input.fch4ProjectTch4, projectMethane.fch4ProjectTch4);
  assert.equal(result.input.gwpCh4Tco2ePerTch4, 29.8);
  assert.equal(result.status, "RECONCILED_PENDING_VERIFICATION");
  assert.match(result.provenanceSha256, /^[a-f0-9]{64}$/);
  assert.throws(() => reconcileBmWa03001Equation4Inputs({ ...baseline, baselineFch4Tch4: 151 }, monitoring), /hash mismatch/);
  assert.throws(() => reconcileBmWa03001Equation4Inputs({ ...baseline, baselineStatus: "SUBMITTED" }, monitoring), /approved baseline/);
  assert.throws(() => reconcileBmWa03001Equation4Inputs(baseline, { ...monitoring, activityId: "another-activity" }), /same non-empty activityId/);
  assert.throws(() => reconcileBmWa03001Equation4Inputs(baseline, { ...monitoring, evidenceRefs: [] }), /Monitoring evidence references/);
});
