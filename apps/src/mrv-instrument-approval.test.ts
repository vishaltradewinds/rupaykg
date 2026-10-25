import test from "node:test";
import assert from "node:assert/strict";
import { instrumentApprovalFailure, type MrvInstrumentApprovalEvidence } from "./mrv-instrument-approval.js";

const now = new Date("2026-10-25T12:00:00.000Z");
const future = "2027-10-25T12:00:00.000Z";

function approvedInstrument(overrides: Partial<MrvInstrumentApprovalEvidence> = {}): MrvInstrumentApprovalEvidence {
  return {
    instrument_code: "GAS-FLOW-01",
    approval_status: "VERIFIED",
    meity_certificate_id: "MEITY-CERT-001",
    meity_issuer: "Official authority",
    meity_certificate_scope: "Exact manufacturer/model/SKU revision",
    meity_verification_url: "https://official.example.gov/certificate/001",
    meity_evidence_reference: "evidence://meity-cert-001",
    meity_evidence_sha256: "a".repeat(64),
    meity_verified_at: "2026-10-25T10:00:00.000Z",
    meity_validity_basis: "VALID_UNTIL",
    meity_valid_until: future,
    calibration_required: true,
    calibration_status: "VERIFIED",
    calibration_certificate_id: "CAL-001",
    calibration_evidence_reference: "evidence://cal-001",
    calibration_evidence_sha256: "b".repeat(64),
    calibration_lab: "Traceable calibration lab",
    calibration_traceability: "National standard traceability reference",
    calibration_uncertainty: "0.2",
    calibration_valid_until: future,
    calibration_not_required_reason: null,
    firmware_version: "1.0.0",
    firmware_support_until: future,
    security_review_status: "VERIFIED",
    security_evidence_reference: "evidence://firmware-review-001",
    security_evidence_sha256: "c".repeat(64),
    security_reviewed_at: "2026-10-25T10:00:00.000Z",
    security_not_applicable_reason: null,
    ...overrides,
  };
}

test("all MRV submissions fail closed when observations lack instrument identity", () => {
  assert.match(instrumentApprovalFailure("NON-HARDWARE-METHOD", [{ instrument_id: null }], [], now) ?? "", /must identify its source instrument/i);
  assert.match(instrumentApprovalFailure("NON-HARDWARE-METHOD", [], [], now) ?? "", /requires instrument-linked observations/i);
});

test("WA03.001 fails closed when observations are absent or lack an instrument ID", () => {
  assert.match(instrumentApprovalFailure("BM WA03.001", [], [], now) ?? "", /requires instrument-linked observations/i);
  assert.match(instrumentApprovalFailure("WA03.001", [{ instrument_id: null }], [], now) ?? "", /must identify its source instrument/i);
});

test("instrument-linked MRV fails closed when the exact instrument is not registered", () => {
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [], now) ?? "", /not registered/i);
});

test("exact-model MeitY evidence and current calibration permit instrument-linked MRV", () => {
  assert.equal(instrumentApprovalFailure("BM WA03.001", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument()], now), null);
  assert.equal(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ meity_validity_basis: "NO_EXPIRY_CONFIRMED", meity_valid_until: null })], now), null);
});

test("HOLD or rejected instrument cannot enter MRV", () => {
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ approval_status: "HOLD" })], now) ?? "", /not VERIFIED/i);
});

test("expired MeitY approval and future-dated verification block MRV", () => {
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ meity_valid_until: "2026-10-24T00:00:00.000Z" })], now) ?? "", /expired or unknown MeitY approval/i);
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ meity_verified_at: "2026-10-26T00:00:00.000Z" })], now) ?? "", /lacks complete exact-model MeitY approval/i);
});

test("missing certificate scope, evidence hash or non-HTTPS source blocks MRV", () => {
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ meity_certificate_scope: "" })], now) ?? "", /lacks complete exact-model MeitY approval/i);
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ meity_evidence_sha256: "" })], now) ?? "", /lacks complete exact-model MeitY approval/i);
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ meity_evidence_reference: "" })], now) ?? "", /lacks complete exact-model MeitY approval/i);
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ meity_verification_url: "http://vendor.example" })], now) ?? "", /lacks complete exact-model MeitY approval/i);
});

test("expired or incomplete calibration blocks MRV", () => {
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ calibration_valid_until: "2026-10-24T00:00:00.000Z" })], now) ?? "", /expired required calibration/i);
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ calibration_uncertainty: null })], now) ?? "", /expired required calibration/i);
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ calibration_evidence_sha256: "" })], now) ?? "", /expired required calibration/i);
});

test("non-measuring instrument still requires MeitY evidence and written calibration rationale", () => {
  assert.equal(instrumentApprovalFailure("OTHER", [{ instrument_id: "EDGE-GW-01" }], [approvedInstrument({
    instrument_code: "EDGE-GW-01",
    calibration_required: false,
    calibration_status: "NOT_APPLICABLE_WITH_JUSTIFICATION",
    calibration_not_required_reason: "This gateway does not perform a physical measurement.",
    calibration_certificate_id: null,
    calibration_lab: null,
    calibration_traceability: null,
    calibration_uncertainty: null,
    calibration_valid_until: null,
  })], now), null);
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "EDGE-GW-01" }], [approvedInstrument({
    instrument_code: "EDGE-GW-01",
    calibration_required: false,
    calibration_status: "NOT_APPLICABLE_WITH_JUSTIFICATION",
    calibration_not_required_reason: null,
  })], now) ?? "", /written justification/i);
});

test("expired or missing firmware support and security evidence block MRV", () => {
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ firmware_support_until: "2026-10-24T00:00:00.000Z" })], now) ?? "", /firmware support or security lifecycle evidence/i);
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ security_evidence_sha256: "" })], now) ?? "", /firmware support or security lifecycle evidence/i);
  assert.match(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ firmware_version: null, firmware_support_until: null, security_review_status: "PENDING", security_not_applicable_reason: null })], now) ?? "", /lacks a written security-lifecycle rationale/i);
  assert.equal(instrumentApprovalFailure("OTHER", [{ instrument_id: "GAS-FLOW-01" }], [approvedInstrument({ firmware_version: null, firmware_support_until: null, security_review_status: "NOT_APPLICABLE_WITH_JUSTIFICATION", security_not_applicable_reason: "No firmware exists", security_evidence_reference: null, security_evidence_sha256: null, security_reviewed_at: null })], now), null);
});
