import type { Pool } from "pg";
import { hasOrganizationPermission, type AuthContext } from "./auth.js";
import type { AgenticGoal } from "./agentic-workflow.js";

export type AgenticToolId =
  | "activities.list"
  | "measurements.count"
  | "evidence.count"
  | "verifications.count"
  | "stakeholder_applications.list"
  | "organization_verification.count";

export type AgenticToolDefinition = {
  id: AgenticToolId;
  domain: "operations" | "mrv" | "evidence" | "verification" | "onboarding";
  description: string;
  mode: "READ_ONLY";
  requiredAnyPermission: readonly string[];
  organizationScoped: true;
  geographyScoped: true;
};

const TOOL_REGISTRY: Record<AgenticToolId, AgenticToolDefinition> = {
  "activities.list": {
    id: "activities.list",
    domain: "operations",
    description: "Read bounded activity identifiers in the active organization and authorised geography.",
    mode: "READ_ONLY",
    requiredAnyPermission: ["waste:read", "projects:read", "audit:read"],
    organizationScoped: true,
    geographyScoped: true,
  },
  "measurements.count": {
    id: "measurements.count",
    domain: "mrv",
    description: "Count measurements attached to the authorised activity scope; never alter measurement values.",
    mode: "READ_ONLY",
    requiredAnyPermission: ["waste:read", "audit:read", "projects:read"],
    organizationScoped: true,
    geographyScoped: true,
  },
  "evidence.count": {
    id: "evidence.count",
    domain: "evidence",
    description: "Count evidence metadata associated with authorised activities; do not return artifact bytes.",
    mode: "READ_ONLY",
    requiredAnyPermission: ["evidence:review", "waste:read", "audit:read", "projects:read"],
    organizationScoped: true,
    geographyScoped: true,
  },
  "verifications.count": {
    id: "verifications.count",
    domain: "verification",
    description: "Count approved verification records for authorised activities; does not make a verification decision.",
    mode: "READ_ONLY",
    requiredAnyPermission: ["evidence:review", "audit:read", "projects:read"],
    organizationScoped: true,
    geographyScoped: true,
  },
  "stakeholder_applications.list": {
    id: "stakeholder_applications.list",
    domain: "onboarding",
    description: "Read bounded stakeholder application identifiers in the authorised organization/geography.",
    mode: "READ_ONLY",
    requiredAnyPermission: ["MANAGE_STAKEHOLDERS", "audit:read"],
    organizationScoped: true,
    geographyScoped: true,
  },
  "organization_verification.count": {
    id: "organization_verification.count",
    domain: "onboarding",
    description: "Count organization legal-verification evidence; does not approve the organization.",
    mode: "READ_ONLY",
    requiredAnyPermission: ["MANAGE_STAKEHOLDERS", "audit:read"],
    organizationScoped: true,
    geographyScoped: true,
  },
};

const GOAL_TOOLS: Record<AgenticGoal, readonly AgenticToolId[]> = {
  review_measurements: ["activities.list", "measurements.count"],
  prepare_compliance: ["activities.list", "evidence.count", "verifications.count"],
  trace_resource_flow: ["activities.list", "evidence.count"],
  onboard_stakeholder: ["stakeholder_applications.list", "organization_verification.count"],
};

export function listAgenticToolDefinitions(): AgenticToolDefinition[] {
  return Object.values(TOOL_REGISTRY).map(tool => ({ ...tool, requiredAnyPermission: [...tool.requiredAnyPermission] }));
}

export function getAgenticToolsForGoal(goal: AgenticGoal): AgenticToolDefinition[] {
  return GOAL_TOOLS[goal].map(id => {
    const tool = TOOL_REGISTRY[id];
    return { ...tool, requiredAnyPermission: [...tool.requiredAnyPermission] };
  });
}

export async function authorizeAgenticTools(
  pool: Pool,
  auth: AuthContext,
  organizationId: string,
  goal: AgenticGoal,
): Promise<{ allowed: true; toolIds: AgenticToolId[] } | { allowed: false; deniedToolId: AgenticToolId }> {
  for (const tool of getAgenticToolsForGoal(goal)) {
    if (!await hasOrganizationPermission(pool, auth, organizationId, tool.requiredAnyPermission)) {
      return { allowed: false, deniedToolId: tool.id };
    }
  }
  return { allowed: true, toolIds: getAgenticToolsForGoal(goal).map(tool => tool.id) };
}
