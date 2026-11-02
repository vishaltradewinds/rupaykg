export type StakeholderPermission =
  | "dashboard:read"
  | "profile:read"
  | "profile:update"
  | "waste:read"
  | "waste:record"
  | "evidence:upload"
  | "evidence:review"
  | "reports:read"
  | "reports:export"
  | "swm:read"
  | "swm:manage"
  | "projects:read"
  | "projects:create"
  | "projects:manage"
  | "projects:review"
  | "projects:verify"
  | "acva:manage"
  | "registry:read"
  | "registry:write"
  | "credits:read"
  | "credits:issue"
  | "credits:buy"
  | "credits:retire"
  | "credits:transfer"
  | "epr:read"
  | "epr:manage"
  | "csr:read"
  | "csr:manage"
  | "guardian:read"
  | "guardian:operate"
  | "audit:read"
  | "audit:execute"
  | "admin:users"
  | "admin:roles"
  | "admin:security"
  | "admin:system"
  | "MANAGE_STAKEHOLDERS"
  | "VERIFY_EVIDENCE"
  | "verification:approve"
  | "verification.approve"
  | "ISSUE_CREDENTIAL"
  | "registry:issue"
  | "registry.issue"
  | "TRANSFER_CREDENTIAL"
  | "registry:transfer"
  | "registry.transfer"
  | "RETIRE_CREDENTIAL"
  | "registry:retire"
  | "registry.retire"
  | "AUTHORIZE_SETTLEMENT"
  | "settlement:authorize"
  | "settlement.authorize"
  | "SETTLE_FUNDS"
  | "settlement:settle"
  | "settlement.settle";

const ALL_READ: StakeholderPermission[] = ["dashboard:read", "profile:read", "reports:read"];
const OPERATIONAL: StakeholderPermission[] = [
  ...ALL_READ,
  "profile:update",
  "waste:read",
  "waste:record",
  "evidence:upload",
];

// This policy is derived from the reference repository's explicit RBAC contract.
// Current RupayKG remains PostgreSQL-authoritative: these permissions are persisted
// into the tenant-local role at onboarding approval and are enforced by the current API.
export const ROLE_PERMISSIONS: Record<string, readonly StakeholderPermission[]> = {
  citizen: [...OPERATIONAL],
  farmer: [...OPERATIONAL],
  safai_mitra: [...OPERATIONAL],
  fpo: [...OPERATIONAL, "swm:read", "reports:export"],
  municipal_admin: [
    ...ALL_READ,
    "profile:update",
    "waste:read",
    "evidence:upload",
    "evidence:review",
    "reports:export",
    "swm:read",
    "swm:manage",
    "projects:read",
    "registry:read",
    "credits:read",
    "epr:read",
    "audit:read",
  ],
  municipal_generator: [...OPERATIONAL, "swm:read", "reports:export"],
  aggregator: [...OPERATIONAL, "reports:export"],
  processor: [...OPERATIONAL, "reports:export"],
  industry_generator: [...OPERATIONAL, "reports:export", "epr:read"],
  commercial_generator: [...OPERATIONAL, "reports:export", "epr:read"],
  institution_generator: [...OPERATIONAL, "reports:export", "epr:read"],
  PROJECT_OWNER: [
    ...ALL_READ,
    "profile:update",
    "waste:read",
    "evidence:upload",
    "reports:export",
    "projects:read",
    "projects:create",
    "projects:manage",
    "registry:read",
    "credits:read",
  ],
  ACVA_USER: [
    ...ALL_READ,
    "profile:update",
    "evidence:review",
    "reports:export",
    "projects:read",
    "projects:review",
    "projects:verify",
    "registry:read",
    "credits:read",
    "audit:read",
    "audit:execute",
    "VERIFY_EVIDENCE",
    "verification:approve",
    "verification.approve",
  ],
  ccc_buyer: [
    ...ALL_READ,
    "profile:update",
    "reports:export",
    "projects:read",
    "registry:read",
    "credits:read",
    "credits:buy",
    "credits:retire",
  ],
  regulator: [
    ...ALL_READ,
    "profile:update",
    "waste:read",
    "evidence:review",
    "reports:export",
    "swm:read",
    "swm:manage",
    "projects:read",
    "projects:review",
    "projects:verify",
    "acva:manage",
    "registry:read",
    "credits:read",
    "epr:read",
    "epr:manage",
    "csr:read",
    "csr:manage",
    "guardian:read",
    "guardian:operate",
    "audit:read",
    "audit:execute",
    "VERIFY_EVIDENCE",
    "verification:approve",
    "verification.approve",
  ],
  epr_partner: [
    ...ALL_READ,
    "profile:update",
    "waste:read",
    "reports:export",
    "epr:read",
    "epr:manage",
    "registry:read",
    "credits:read",
  ],
  csr_partner: [
    ...ALL_READ,
    "profile:update",
    "reports:export",
    "csr:read",
    "csr:manage",
    "registry:read",
    "credits:read",
  ],
  // Reserved platform roles are not selectable through self-service onboarding.
  platform_admin: [
    ...ALL_READ,
    "profile:update",
    "waste:read",
    "waste:record",
    "evidence:upload",
    "evidence:review",
    "reports:export",
    "swm:read",
    "swm:manage",
    "projects:read",
    "projects:create",
    "projects:manage",
    "projects:review",
    "projects:verify",
    "acva:manage",
    "registry:read",
    "credits:read",
    "epr:read",
    "epr:manage",
    "csr:read",
    "csr:manage",
    "audit:read",
    "audit:execute",
    "admin:users",
    "MANAGE_STAKEHOLDERS",
    "VERIFY_EVIDENCE",
    "verification:approve",
    "verification.approve",
  ],
  super_admin: [
    ...ALL_READ,
    "profile:update",
    "waste:read",
    "waste:record",
    "evidence:upload",
    "evidence:review",
    "reports:export",
    "swm:read",
    "swm:manage",
    "projects:read",
    "projects:create",
    "projects:manage",
    "projects:review",
    "projects:verify",
    "acva:manage",
    "registry:read",
    "registry:write",
    "credits:read",
    "credits:issue",
    "credits:buy",
    "credits:retire",
    "credits:transfer",
    "epr:read",
    "epr:manage",
    "csr:read",
    "csr:manage",
    "guardian:read",
    "guardian:operate",
    "audit:read",
    "audit:execute",
    "admin:users",
    "admin:roles",
    "admin:security",
    "admin:system",
    "MANAGE_STAKEHOLDERS",
    "VERIFY_EVIDENCE",
    "verification:approve",
    "verification.approve",
    "ISSUE_CREDENTIAL",
    "registry:issue",
    "registry.issue",
    "TRANSFER_CREDENTIAL",
    "registry:transfer",
    "registry.transfer",
    "RETIRE_CREDENTIAL",
    "registry:retire",
    "registry.retire",
    "AUTHORIZE_SETTLEMENT",
    "settlement:authorize",
    "settlement.authorize",
    "SETTLE_FUNDS",
    "settlement:settle",
    "settlement.settle",
  ],
};

export function getPermissionsForRole(role: string): StakeholderPermission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}
