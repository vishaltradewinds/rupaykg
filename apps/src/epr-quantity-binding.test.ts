import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEprQuantityBinding, type EprQuantityBinding } from "./epr-quantity-binding.js";

const valid: EprQuantityBinding = {
  organizationId: "org-1",
  schemeId: "scheme-1",
  obligationId: "obligation-1",
  measurementId: "measurement-1",
  custodyAllocationId: "custody-1",
  categoryCode: "PLASTIC",
  unitCode: "kg",
  methodologyVersion: "methodology-v3",
  periodStart: "2026-04-01",
  periodEnd: "2027-03-31",
  measuredQuantity: 125.5,
  measurementVerified: true,
  verifierCurrentlyAuthorized: true,
  evidenceNotRevoked: true,
};

test("EPR quantity gate accepts a complete verified persisted binding and uses measured quantity", () => {
  assert.deepEqual(evaluateEprQuantityBinding(valid), { ready: true, quantity: 125.5 });
});

test("EPR quantity gate fails closed when binding is absent", () => {
  assert.deepEqual(evaluateEprQuantityBinding(undefined), {
    ready: false,
    code: "EPR_QUANTITY_BINDING_NOT_IMPLEMENTED",
  });
});

test("EPR quantity gate rejects each missing provenance identifier", () => {
  const keys: Array<keyof EprQuantityBinding> = [
    "organizationId", "schemeId", "obligationId", "measurementId",
    "custodyAllocationId", "categoryCode", "unitCode", "methodologyVersion",
    "periodStart", "periodEnd",
  ];
  for (const key of keys) {
    const incomplete = { ...valid, [key]: "   " } as EprQuantityBinding;
    assert.equal(evaluateEprQuantityBinding(incomplete).ready, false, key);
  }
});

test("EPR quantity gate rejects zero, negative, NaN and infinite measured quantities", () => {
  for (const measuredQuantity of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(evaluateEprQuantityBinding({ ...valid, measuredQuantity }).ready, false, String(measuredQuantity));
  }
});

test("EPR quantity gate rejects invalid period ordering", () => {
  assert.equal(evaluateEprQuantityBinding({ ...valid, periodStart: "2027-04-01", periodEnd: "2027-03-31" }).ready, false);
});

test("EPR quantity gate rejects unverified measurement, unauthorized verifier or revoked evidence", () => {
  assert.equal(evaluateEprQuantityBinding({ ...valid, measurementVerified: false }).ready, false);
  assert.equal(evaluateEprQuantityBinding({ ...valid, verifierCurrentlyAuthorized: false }).ready, false);
  assert.equal(evaluateEprQuantityBinding({ ...valid, evidenceNotRevoked: false }).ready, false);
});
