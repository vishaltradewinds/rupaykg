import test from "node:test";
import assert from "node:assert/strict";
import {
  instrumentApprovalFailure,
  instrumentParameterFailure,
  type MrvInstrumentApprovalEvidence,
  type MrvInstrumentParameterSpec,
} from "./mrv-instrument-approval.js";

/**
 * Offline-only hardware/IoT simulation contract tests.
 * These fixtures are synthetic and MUST NOT be submitted to a live API,
 * persisted as site evidence, or treated as measurements from a real instrument.
 */
const simulatedNow = new Date("2026-10-26T07:00:00.000Z");
const simulatedInstrumentCode = "SIM-EDGE-TEST-001";
const simulatedObservation = {
  instrument_id: simulatedInstrumentCode,
  parameter_code: "mass_kg",
};
const simulatedParameterSpec: MrvInstrumentParameterSpec = {
  instrument_code: simulatedInstrumentCode,
  parameter_code: "mass_kg",
  unit: "kg",
  minimum_value: 0,
  maximum_value: 1000,
  resolution: 0.1,
  accuracy_absolute: 0.5,
  accuracy_relative_percent: null,
};

function syntheticApproval(overrides: Partial<MrvInstrumentApprovalEvidence> = {}): MrvInstrumentApprovalEvidence {
  return {
    instrument_code: simulatedInstrumentCode,
    measurement_instrument: true,
    manufacturer_serial_number: null,
    asset_tag: null,
    calibration_serial_number: null,
    supported_parameter_codes: ["mass_kg"],
    approval_status: "PENDING",
    meity_certificate_id: null,
    meity_issuer: null,
    meity_certificate_scope: null,
    meity_verification_url: null,
    meity_evidence_reference: null,
    meity_evidence_sha256: null,
    meity_verified_at: null,
    meity_validity_basis: null,
    meity_valid_until: null,
    calibration_required: true,
    calibration_status: "PENDING",
    calibration_certificate_id: null,
    calibration_evidence_reference: null,
    calibration_evidence_sha256: null,
    calibration_lab: null,
    calibration_traceability: null,
    calibration_uncertainty: null,
    calibration_valid_until: null,
    calibration_not_required_reason: null,
    firmware_version: "SIMULATED-ONLY",
    firmware_support_until: null,
    security_review_status: "PENDING",
    security_evidence_reference: null,
    security_evidence_sha256: null,
    security_reviewed_at: null,
    security_not_applicable_reason: null,
    ...overrides,
  };
}

test("offline simulated observation is blocked when its instrument is not registered", () => {
  const failure = instrumentApprovalFailure(
    "TEST_ONLY",
    [simulatedObservation],
    [],
    simulatedNow,
  );
  assert.match(failure ?? "", /not registered for this organization/i);
});

test("offline simulated observation cannot use a pending instrument approval", () => {
  const failure = instrumentApprovalFailure(
    "TEST_ONLY",
    [simulatedObservation],
    [syntheticApproval()],
    simulatedNow,
  );
  assert.match(failure ?? "", /not VERIFIED/i);
});

test("a numerically plausible synthetic value is not enough without approved instrument evidence", () => {
  const value = 123.4;
  assert.equal(instrumentParameterFailure(
    simulatedInstrumentCode,
    "mass_kg",
    "kg",
    value,
    [simulatedParameterSpec],
  ), null);

  const approvalFailure = instrumentApprovalFailure(
    "TEST_ONLY",
    [simulatedObservation],
    [syntheticApproval()],
    simulatedNow,
  );
  assert.match(approvalFailure ?? "", /not VERIFIED/i);
});

test("offline simulator catches out-of-range and wrong-unit values before any ingestion", () => {
  assert.match(instrumentParameterFailure(
    simulatedInstrumentCode,
    "mass_kg",
    "kg",
    1001,
    [simulatedParameterSpec],
  ) ?? "", /outside the approved range/i);

  assert.match(instrumentParameterFailure(
    simulatedInstrumentCode,
    "mass_kg",
    "g",
    100,
    [simulatedParameterSpec],
  ) ?? "", /no exact parameter\/unit specification/i);
});
