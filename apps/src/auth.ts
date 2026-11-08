import { createHash, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";

export type AuthContext = {
  identityId: string;
  memberships: Array<{ organization_id: string; role_id: string; status: string }>;
  activeOrganizationId?: string;
  bilateralOrganizationScope?: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function authenticate(request: FastifyRequest, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) return null;
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  // Authentication runs before tenant context exists. Do not query
  // organization_memberships directly from the ordinary runtime role: that
  // pre-context read would be incompatible with RLS. The SECURITY DEFINER
  // bootstrap function is the explicit, narrowly scoped authentication
  // boundary and returns only verified memberships attached to this bearer
  // session.
  const bootstrap = await pool.query<{
    identity_id: string;
    organization_id: string;
    role_id: string;
    status: string;
  }>(
    `select identity_id, organization_id, role_id, status
       from app.authenticate_bearer_session($1)`,
    [hashToken(token)],
  );
  if (!bootstrap.rows[0]) return null;
  const memberships = bootstrap;
  const requested = request.headers["x-rupaykg-organization-id"];
  const requestedOrganizationId = typeof requested === "string" && requested.trim() ? requested.trim() : undefined;
  if (requestedOrganizationId && !UUID_RE.test(requestedOrganizationId)) return null;
  if (requestedOrganizationId && !memberships.rows.some((m) => m.organization_id === requestedOrganizationId)) return null;

  // All operational records are organization-scoped. A multi-organization identity
  // must explicitly select the organization before any endpoint can project data or
  // authorize an action. A single-organization identity is safely scoped implicitly.
  if (memberships.rows.length > 1 && !requestedOrganizationId) return null;
  const activeOrganizationId = requestedOrganizationId ?? memberships.rows[0]?.organization_id;
  const requestPath = ((request.url ?? "").split("?", 1)[0]) ?? "";
  const bilateralOrganizationScope = requestPath === "/api/v1/settlements"
    || requestPath.startsWith("/api/v1/settlements/");
  return {
    identityId: rows.rows[0].identity_id,
    memberships: memberships.rows,
    ...(activeOrganizationId ? { activeOrganizationId } : {}),
    ...(bilateralOrganizationScope ? { bilateralOrganizationScope: true } : {}),
  };
}

export function canActForOrganization(auth: AuthContext, organizationId: string): boolean {
  return auth.memberships.some((m) => m.organization_id === organizationId)
    && (auth.bilateralOrganizationScope || !auth.activeOrganizationId || auth.activeOrganizationId === organizationId);
}

export const HIGH_RISK_PERMISSIONS = {
  VERIFY_EVIDENCE: ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"],
  ISSUE_CREDENTIAL: ["ISSUE_CREDENTIAL", "registry:issue", "registry.issue"],
  TRANSFER_CREDENTIAL: ["TRANSFER_CREDENTIAL", "registry:transfer", "registry.transfer"],
  RETIRE_CREDENTIAL: ["RETIRE_CREDENTIAL", "registry:retire", "registry.retire"],
  AUTHORIZE_SETTLEMENT: ["AUTHORIZE_SETTLEMENT", "settlement:authorize", "settlement.authorize"],
  SETTLE_FUNDS: ["SETTLE_FUNDS", "settlement:settle", "settlement.settle"],
} as const;

export type HighRiskAction = keyof typeof HIGH_RISK_PERMISSIONS;

export async function hasOrganizationPermission(client: Pool | PoolClient, auth: AuthContext, organizationId: string, permissions: readonly string[]): Promise<boolean> {
  if (auth.memberships.length > 0 && !canActForOrganization(auth, organizationId)) return false;
  const result = await client.query<{ ok: boolean }>(
    `select exists (
       select 1 from organization_memberships om join roles r on r.id = om.role_id
        where om.identity_id = $1 and om.organization_id = $2 and om.status = 'VERIFIED'
          and exists (select 1 from jsonb_array_elements_text(r.permissions) permission where permission = any($3::text[]))
     ) as ok`,
    [auth.identityId, organizationId, permissions],
  );
  return result.rows[0]?.ok === true;
}

export async function canPerformHighRiskActionInDatabase(client: Pool | PoolClient, auth: AuthContext, organizationId: string, action: HighRiskAction): Promise<boolean> {
  return hasOrganizationPermission(client, auth, organizationId, HIGH_RISK_PERMISSIONS[action]);
}

export async function canVerifyEvidence(client: PoolClient, identityId: string, evidenceId: string): Promise<boolean> {
  const result = await client.query<{ ok: boolean }>(
    `select exists (
       select 1 from evidence e join activities a on a.id = e.activity_id
       join organization_memberships om on om.identity_id = $2 and om.status = 'VERIFIED'
        and a.geography_id is not null and organization_has_geography_scope(om.organization_id, a.geography_id)
       join roles r on r.id = om.role_id where e.id = $1
        and exists (select 1 from jsonb_array_elements_text(r.permissions) permission where permission = any($3::text[]))
     ) as ok`,
    [evidenceId, identityId, HIGH_RISK_PERMISSIONS.VERIFY_EVIDENCE],
  );
  return result.rows[0]?.ok === true;
}

export function bearerChallenge(): { error: string; code: "AUTH_REQUIRED" } {
  return { error: "Authenticated session required", code: "AUTH_REQUIRED" };
}
