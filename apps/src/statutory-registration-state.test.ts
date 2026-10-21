import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExternalRegistrationReport, nonNegativeEprInput, parseBwgRuleThresholds, bwgStatus } from "./statutory-routes.js";

test("a user-entered external registration reference never becomes authority-verified status", () => {
  assert.deepEqual(
    normalizeExternalRegistrationReport("CPCB-REF-123", "REGISTERED_EXTERNALLY"),
    {
      reference: "CPCB-REF-123",
      persistedStatus: "NOT_ASSERTED",
      trustState: "USER_REPORTED_UNVERIFIED",
    },
  );
});

test("missing reference or unsupported status is rejected", () => {
  assert.equal(normalizeExternalRegistrationReport(null, "REGISTERED_EXTERNALLY"), null);
  assert.equal(normalizeExternalRegistrationReport("", "REGISTERED_EXTERNALLY"), null);
  assert.equal(normalizeExternalRegistrationReport("CPCB-REF-123", "APPROVED"), null);
  assert.equal(normalizeExternalRegistrationReport("CPCB-REF-123", null), null);
});

test("optional statutory measurements reject numeric strings and non-finite values", () => {
  for (const value of ["12", "1e2", true, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.equal(nonNegativeEprInput({ quantity: value }, "quantity"), null);
  }
  assert.equal(nonNegativeEprInput({ quantity: 0 }, "quantity"), 0);
  assert.equal(nonNegativeEprInput({ quantity: 1.25 }, "quantity"), 1.25);
  assert.equal(nonNegativeEprInput({}, "quantity"), undefined);
});

test("BWG applicability remains under review without an approved versioned rule", () => {
  assert.equal(bwgStatus(25000, 50000, 150, null), "UNDER_REVIEW");
  assert.equal(bwgStatus(100, 100, 10, null), "UNDER_REVIEW");
});

test("BWG applicability uses the thresholds from a validated rule-version payload", () => {
  const thresholds = parseBwgRuleThresholds({ thresholds: { floorAreaSqM: 20000, waterConsumptionLpd: 40000, solidWasteKgpd: 100 } });
  assert.deepEqual(thresholds, { floorAreaSqM: 20000, waterConsumptionLpd: 40000, solidWasteKgpd: 100 });
  assert.equal(bwgStatus(20000, 1000, 1, thresholds), "APPLICABLE");
  assert.equal(bwgStatus(100, 100, 1, thresholds), "NOT_APPLICABLE");
  assert.equal(parseBwgRuleThresholds({ thresholds: { floorAreaSqM: "20000", waterConsumptionLpd: 40000, solidWasteKgpd: 100 } }), null);
  assert.equal(parseBwgRuleThresholds({ thresholds: { floorAreaSqM: 0, waterConsumptionLpd: 40000, solidWasteKgpd: 100 } }), null);
  assert.equal(parseBwgRuleThresholds({}), null);
});
