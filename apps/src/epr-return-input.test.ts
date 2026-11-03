import assert from "node:assert/strict";
import test from "node:test";
import { eprReturnSubmissionState, isIsoCalendarDate, isValidExternalReference } from "./epr-return-routes.js";

test("EPR period validation accepts real ISO calendar dates", () => {
  assert.equal(isIsoCalendarDate("2024-02-29"), true);
  assert.equal(isIsoCalendarDate("2026-10-23"), true);
  assert.equal(isIsoCalendarDate("0001-01-01"), true);
});

test("EPR period validation rejects normalized, malformed, and impossible dates", () => {
  for (const value of [
    "2023-02-29",
    "2026-02-31",
    "2026-13-01",
    "2026-00-10",
    "2026-04-31",
    "2026-1-01",
    "2026-01-1",
    "2026-01-01T00:00:00Z",
    "0000-01-01",
    "",
  ]) {
    assert.equal(isIsoCalendarDate(value), false, value);
  }
});

test("EPR external references must be nonempty and bounded", () => {
  assert.equal(isValidExternalReference(" CPCB-REF-123 "), true);
  assert.equal(isValidExternalReference("x".repeat(2048)), true);
  assert.equal(isValidExternalReference(""), false);
  assert.equal(isValidExternalReference("   "), false);
  assert.equal(isValidExternalReference("x".repeat(2049)), false);
});

test("EPR return resubmission fails closed until rejected obligation accounting is reconciled", () => {
  assert.equal(eprReturnSubmissionState("DRAFT"), "SUBMITTABLE");
  assert.equal(eprReturnSubmissionState("REJECTED"), "RECONCILIATION_REQUIRED");
  for (const status of ["SUBMITTED", "ACCEPTED", "COMPLETED", "CANCELLED", "UNKNOWN"]) {
    assert.equal(eprReturnSubmissionState(status), "INVALID_STATE", status);
  }
});
