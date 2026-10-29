import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEprQuantityBinding, type EprQuantityBinding } from "../src/epr-quantity-binding.js";

const completeBinding: EprQuantityBinding = {
  organizationId: "org-1",
  schemeId: "scheme-1",
  obligationId: "obligation-1",
  measurementId: "measurement-1",
  custodyAllocationId: "custody-allocation-1",
  categoryCode: "PLASTIC_PACKAGING",
  unitCode: "kg",
  methodologyVersion: "EPR-METHOD-2026.1",
  periodStart: "2026-04-01",
  periodEnd: "2027-03-31",
  measuredQuantity: 125.5,
  measurementVerified: true,
  verifierCurrentlyAuthorized: true,
  evidenceNotRevoked: true,
};

test("EPR submission fails closed when no authoritative measurement binding is available", () => {
  assert.deepEqual(evaluateEprQuantityBinding(undefined), {
    ready: false,
    code: "EPR_QUANTITY_BINDING_NOT_IMPLEMENTED",
  });
});

test("EPR binding only opens for verified measured quantity and complete binding dimensions", () => {
  assert.deepEqual(evaluateEprQuantityBinding(completeBinding), { ready: true, quantity: 125.5 });
});

test("EPR binding rejects missing dimensions, invalid quantity, and failed authority checks", () => {
  const keys = ["organizationId", "schemeId", "obligationId", "measurementId", "custodyAllocationId", "categoryCode", "unitCode", "methodologyVersion", "periodStart", "periodEnd"] as const;
  for (const key of keys) {
    assert.equal(evaluateEprQuantityBinding({ ...completeBinding, [key]: "" }).ready, false, key);
  }
  assert.equal(evaluateEprQuantityBinding({ ...completeBinding, measuredQuantity: 0 }).ready, false);
  assert.equal(evaluateEprQuantityBinding({ ...completeBinding, measurementVerified: false }).ready, false);
  assert.equal(evaluateEprQuantityBinding({ ...completeBinding, verifierCurrentlyAuthorized: false }).ready, false);
  assert.equal(evaluateEprQuantityBinding({ ...completeBinding, evidenceNotRevoked: false }).ready, false);
});
