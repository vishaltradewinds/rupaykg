import { createHash, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";

export type AuthContext = {
  identityId: string;
  memberships: Array<{ organization_id: string; role_id: string; status: string }>;
  activeOrganizationId?: string;
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
  const rows = await pool.query<{ identity_id: string }>(
    `select s.identity_id
       from identity_sessions s
       join identities i on i.id = s.identity_id
      where s.token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()
        and i.status = 'VERIFIED'`,
    [hashToken(token)],
  );
  if (!rows.rows[0]) return null;
  const memberships = await pool.query<{ organization_id: string; role_id: string; status: string }>(
    `select organization_id, role_id, status
       from organization_memberships
      where identity_id = $1 and status = 'VERIFIED'`,
    [rows.rows[0].identity_id],
  );
  const requested = request.headers["x-rupaykg-organization-id"];
  const activeOrganizationId = typeof requested === "string" && requested.trim() ? requested.trim() : undefined;
  if (activeOrganizationId && !UUID_RE.test(activeOrganizationId)) return null;
  if (activeOrganizationId && !memberships.rows.some((m) => m.organization_id === activeOrganizationId)) return null;
  return activeOrganizationId
    ? { identityId: rows.rows[0].identity_id, memberships: memberships.rows, activeOrganizationId }
    : { identityId: rows.rows[0].identity_id, memberships: memberships.rows };
}

export function canActForOrganization(auth: AuthContext, organizationId: string): boolean {
  return auth.memberships.some((m) => m.organization_id === organizationId)
    && (!auth.activeOrganizationId || auth.activeOrganizationId === organizationId);
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
