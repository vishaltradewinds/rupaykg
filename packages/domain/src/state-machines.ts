export type Lifecycle =
  | "activity"
  | "evidence"
  | "verification"
  | "credential"
  | "obligation"
  | "settlement";

const transitions: Record<Lifecycle, Record<string, readonly string[]>> = {
  activity: {
    DRAFT: ["SUBMITTED"],
    SUBMITTED: ["ACCEPTED", "REJECTED"],
    ACCEPTED: ["COMPLETED"],
    COMPLETED: [],
    REJECTED: [],
  },
  evidence: {
    CAPTURED: ["SUBMITTED"],
    SUBMITTED: ["UNDER_REVIEW"],
    UNDER_REVIEW: ["VERIFIED", "REJECTED"],
    VERIFIED: [],
    REJECTED: [],
  },
  verification: {
    REQUESTED: ["IN_REVIEW"],
    IN_REVIEW: ["APPROVED", "REJECTED"],
    APPROVED: [],
    REJECTED: [],
  },
  credential: {
    ELIGIBLE: ["ISSUED"],
    ISSUED: ["ACTIVE"],
    ACTIVE: ["TRANSFERRED", "RETIRED"],
    TRANSFERRED: ["RETIRED"],
    RETIRED: [],
  },
  obligation: {
    OPEN: ["EVIDENCE_PENDING"],
    EVIDENCE_PENDING: ["UNDER_REVIEW"],
    UNDER_REVIEW: ["COMPLIANT", "NON_COMPLIANT"],
    COMPLIANT: [],
    NON_COMPLIANT: [],
  },
  settlement: {
    ELIGIBLE: ["CREATED"],
    CREATED: ["AUTHORIZED", "REJECTED"],
    AUTHORIZED: ["EXECUTING", "CANCELLED"],
    EXECUTING: ["RECONCILING", "FAILED"],
    RECONCILING: ["SETTLED", "FAILED"],
    SETTLED: [],
    REJECTED: [],
    FAILED: [],
    CANCELLED: [],
  },
};

export function canTransition(
  lifecycle: Lifecycle,
  from: string,
  to: string,
): boolean {
  return transitions[lifecycle]?.[from]?.includes(to) ?? false;
}

export function assertTransition(
  lifecycle: Lifecycle,
  from: string,
  to: string,
): void {
  if (!canTransition(lifecycle, from, to)) {
    throw new Error(`Invalid ${lifecycle} transition: ${from} -> ${to}`);
  }
}
