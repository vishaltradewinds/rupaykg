export type EprQuantityBinding = {
  organizationId: string;
  schemeId: string;
  obligationId: string;
  measurementId: string;
  custodyAllocationId: string;
  categoryCode: string;
  unitCode: string;
  methodologyVersion: string;
  periodStart: string;
  periodEnd: string;
  measuredQuantity: number;
  measurementVerified: boolean;
  verifierCurrentlyAuthorized: boolean;
  evidenceNotRevoked: boolean;
};

export type EprQuantityBindingDecision =
  | { ready: true; quantity: number }
  | { ready: false; code: "EPR_QUANTITY_BINDING_NOT_IMPLEMENTED" };

/**
 * A reported quantity is not fulfillment. This gate only opens when the caller
 * supplies a complete, trusted binding assembled from persisted records.
 * HTTP request fields must never be mapped directly into this type.
 */
export function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function evaluateEprQuantityBinding(
  binding: EprQuantityBinding | undefined,
): EprQuantityBindingDecision {
  if (!binding) return { ready: false, code: "EPR_QUANTITY_BINDING_NOT_IMPLEMENTED" };
  const required = [
    binding.organizationId, binding.schemeId, binding.obligationId,
    binding.measurementId, binding.custodyAllocationId, binding.categoryCode,
    binding.unitCode, binding.methodologyVersion, binding.periodStart, binding.periodEnd,
  ];
  if (required.some((value) => typeof value !== "string" || value.trim() === "")
    || !Number.isFinite(binding.measuredQuantity)
    || binding.measuredQuantity <= 0
    || !isIsoCalendarDate(binding.periodStart)
    || !isIsoCalendarDate(binding.periodEnd)
    || binding.periodStart > binding.periodEnd
    || binding.measurementVerified !== true
    || binding.verifierCurrentlyAuthorized !== true
    || binding.evidenceNotRevoked !== true) {
    return { ready: false, code: "EPR_QUANTITY_BINDING_NOT_IMPLEMENTED" };
  }
  return { ready: true, quantity: binding.measuredQuantity };
}
