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

type SessionResolverRow = {
  identity_id: string;
  organization_id: string | null;
  role_id: string | null;
  membership_status: string | null;
};

export type AuthResolverMode = "legacy" | "security_definer";

export function getAuthResolverMode(value = process.env.RUPAYKG_AUTH_RESOLVER_MODE): AuthResolverMode {
  if (value === undefined || value === "" || value === "legacy") return "legacy";
  if (value === "security_definer") return "security_definer";
  throw new Error("AUTH_RESOLVER_MODE_INVALID");
}

function buildAuthContext(
  request: FastifyRequest,
  identityId: string,
  memberships: AuthContext["memberships"],
): AuthContext | null {
  const requested = request.headers["x-rupaykg-organization-id"];
  const requestedOrganizationId = typeof requested === "string" && requested.trim() ? requested.trim() : undefined;
  if (requestedOrganizationId && !UUID_RE.test(requestedOrganizationId)) return null;
  if (requestedOrganizationId && !memberships.some((m) => m.organization_id === requestedOrganizationId)) return null;

  // A multi-organization identity must explicitly select one organization except
  // for the explicitly bilateral settlement routes.
  const requestPath = ((request.url ?? "").split("?", 1)[0]) ?? "";
  const bilateralOrganizationScope = requestPath === "/api/v1/settlements"
    || requestPath.startsWith("/api/v1/settlements/");
  if (memberships.length > 1 && !requestedOrganizationId) return null;
  const activeOrganizationId = requestedOrganizationId ?? memberships[0]?.organization_id;
  return {
    identityId,
    memberships,
    ...(activeOrganizationId ? { activeOrganizationId } : {}),
    ...(bilateralOrganizationScope ? { bilateralOrganizationScope: true } : {}),
  };
}

async function authenticateWithSecurityDefiner(
  request: FastifyRequest,
  pool: Pool,
  tokenHash: string,
): Promise<AuthContext | null> {
  // No fallback to direct table reads is permitted if this function is missing,
  // denied, or fails. Falling back would silently bypass the intended RLS boundary.
  const result = await pool.query<SessionResolverRow>(
    `select identity_id, organization_id, role_id, membership_status
       from auth_private.resolve_session($1)`,
    [tokenHash],
  );
  if (!result.rows.length) return null;
  const identityId = result.rows[0]!.identity_id;
  if (result.rows.some((row) => row.identity_id !== identityId)) {
    throw new Error("AUTH_SESSION_RESOLVER_RETURNED_MULTIPLE_IDENTITIES");
  }
  const memberships = result.rows.flatMap((row) => {
    if (!row.organization_id || !row.role_id || row.membership_status !== "VERIFIED") return [];
    return [{
      organization_id: row.organization_id,
      role_id: row.role_id,
      status: row.membership_status,
    }];
  });
  return buildAuthContext(request, identityId, memberships);
}

export async function authenticate(
  request: FastifyRequest,
  pool: Pool | null,
  resolverMode: AuthResolverMode = getAuthResolverMode(),
): Promise<AuthContext | null> {
  if (!pool) return null;
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const tokenHash = hashToken(token);
  if (resolverMode === "security_definer") {
    return authenticateWithSecurityDefiner(request, pool, tokenHash);
  }
  const rows = await pool.query<{ identity_id: string }>(
    `select s.identity_id
       from identity_sessions s
       join identities i on i.id = s.identity_id
      where s.token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()
        and i.status = 'VERIFIED'
        and i.suspended_at is null`,
    [tokenHash],
  );
  if (!rows.rows[0]) return null;
  const memberships = await pool.query<{ organization_id: string; role_id: string; status: string }>(
    `select organization_id, role_id, status
       from organization_memberships
      where identity_id = $1 and status = 'VERIFIED'`,
    [rows.rows[0].identity_id],
  );
  return buildAuthContext(request, rows.rows[0].identity_id, memberships.rows);
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
  if (getAuthResolverMode() === "security_definer") {
    const result = await client.query<{ ok: boolean }>(
      `select auth_private.has_organization_permission($1,$2,$3::text[]) as ok`,
      [auth.identityId, organizationId, permissions],
    );
    return result.rows[0]?.ok === true;
  }
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
