export type ComplianceEvidence = {
  evidenceId: string;
  verificationId?: string;
  approved: boolean;
  quantity: number;
};

export type ComplianceAssessment = {
  requiredQuantity: number;
  verifiedQuantity: number;
  remainingQuantity: number;
  status: "OPEN" | "EVIDENCE_PENDING" | "COMPLIANT" | "NON_COMPLIANT";
};

export function assessEprObligation(requiredQuantity: number, evidence: ComplianceEvidence[]): ComplianceAssessment {
  if (!Number.isFinite(requiredQuantity) || requiredQuantity < 0) throw new Error("requiredQuantity must be non-negative");
  // This helper is advisory only: it cannot validate persisted verifier decisions,
  // category/unit/period compatibility, tenant scope, or certificate revocation.
  // Fail closed on duplicate evidence IDs so replayed rows cannot inflate quantities.
  const counts = new Map<string, number>();
  for (const item of evidence) {
    const id = item.evidenceId?.trim();
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const verifiedQuantity = evidence
    .filter((item) =>
      !!item.evidenceId.trim() &&
      counts.get(item.evidenceId.trim()) === 1 &&
      item.approved &&
      !!item.verificationId?.trim() &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0
    )
    .reduce((sum, item) => sum + item.quantity, 0);
  const remainingQuantity = Math.max(0, requiredQuantity - verifiedQuantity);
  return {
    requiredQuantity,
    verifiedQuantity,
    remainingQuantity,
    status: verifiedQuantity >= requiredQuantity ? "COMPLIANT" : verifiedQuantity > 0 ? "EVIDENCE_PENDING" : "OPEN",
  };
}
