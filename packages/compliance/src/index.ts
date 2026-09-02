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
  const verifiedQuantity = evidence
    .filter((item) => item.approved && !!item.verificationId && Number.isFinite(item.quantity) && item.quantity > 0)
    .reduce((sum, item) => sum + item.quantity, 0);
  const remainingQuantity = Math.max(0, requiredQuantity - verifiedQuantity);
  return {
    requiredQuantity,
    verifiedQuantity,
    remainingQuantity,
    status: verifiedQuantity >= requiredQuantity ? "COMPLIANT" : verifiedQuantity > 0 ? "EVIDENCE_PENDING" : "OPEN",
  };
}
