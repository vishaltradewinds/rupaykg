import { createHash, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";

export type AuthContext = {
  identityId: string;
  memberships: Array<{ organization_id: string; role_id: string; status: string }>;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function authenticate(request: FastifyRequest, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) return null;
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const rows = await pool.query<{ identity_id: string }>(
    `select identity_id from identity_sessions
     where token_hash = $1 and revoked_at is null and expires_at > now()`,
    [hashToken(token)],
  );
  if (!rows.rows[0]) return null;
  const memberships = await pool.query<{ organization_id: string; role_id: string; status: string }>(
    `select organization_id, role_id, status
       from organization_memberships
      where identity_id = $1 and status = 'VERIFIED'`,
    [rows.rows[0].identity_id],
  );
  return { identityId: rows.rows[0].identity_id, memberships: memberships.rows };
}

export function canActForOrganization(auth: AuthContext, organizationId: string): boolean {
  return auth.memberships.some((m) => m.organization_id === organizationId);
}

/**
 * High-risk value-moving actions require an explicit role permission.
 * Membership alone is intentionally insufficient. The aliases below keep
 * compatibility with the permission vocabulary already accepted by the
 * verification path while the canonical production permissions remain the
 * values documented in PRODUCTION_PROVISIONING.md.
 */
export const HIGH_RISK_PERMISSIONS = {
  VERIFY_EVIDENCE: ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"],
  ISSUE_CREDENTIAL: ["ISSUE_CREDENTIAL", "registry:issue", "registry.issue"],
  TRANSFER_CREDENTIAL: ["TRANSFER_CREDENTIAL", "registry:transfer", "registry.transfer"],
  RETIRE_CREDENTIAL: ["RETIRE_CREDENTIAL", "registry:retire", "registry.retire"],
  AUTHORIZE_SETTLEMENT: ["AUTHORIZE_SETTLEMENT", "settlement:authorize", "settlement.authorize"],
  SETTLE_FUNDS: ["SETTLE_FUNDS", "settlement:settle", "settlement.settle"],
} as const;

export type HighRiskAction = keyof typeof HIGH_RISK_PERMISSIONS;

export function canPerformHighRiskAction(
  auth: AuthContext,
  organizationId: string,
  action: HighRiskAction,
): boolean {
  const permissionAliases = HIGH_RISK_PERMISSIONS[action];
  return auth.memberships.some((membership) => {
    if (membership.organization_id !== organizationId || membership.status !== "VERIFIED") return false;
    return false;
  }) && auth.memberships.some((membership) => {
    if (membership.organization_id !== organizationId || membership.status !== "VERIFIED") return false;
    return permissionAliases.length > 0;
  });
}

/**
 * Resolve role permissions from PostgreSQL for an authenticated identity.
 * This is the authoritative check because AuthContext intentionally carries
 * only membership metadata, not mutable role permission state.
 */
export async function canPerformHighRiskActionInDatabase(
  client: Pool | PoolClient,
  auth: AuthContext,
  organizationId: string,
  action: HighRiskAction,
): Promise<boolean> {
  if (!canActForOrganization(auth, organizationId)) return false;
  const aliases = HIGH_RISK_PERMISSIONS[action];
  const result = await client.query<{ ok: boolean }>(
    `select exists (
       select 1
         from organization_memberships om
         join roles r on r.id = om.role_id
        where om.identity_id = $1
          and om.organization_id = $2
          and om.status = 'VERIFIED'
          and exists (
            select 1
              from jsonb_array_elements_text(r.permissions) permission
             where permission = any($3::text[])
          )
     ) as ok`,
    [auth.identityId, organizationId, aliases],
  );
  return result.rows[0]?.ok === true;
}

export async function canVerifyEvidence(client: PoolClient, identityId: string, evidenceId: string): Promise<boolean> {
  const result = await client.query<{ ok: boolean }>(
    `select exists (
       select 1
       from evidence e
       join activities a on a.id = e.activity_id
       join organization_memberships om
         on om.organization_id = a.organization_id
        and om.identity_id = $2
        and om.status = 'VERIFIED'
       join roles r on r.id = om.role_id
       where e.id = $1
         and (
           lower(r.name) in ('verifier','auditor','validator','verification_officer')
           or r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
           or r.permissions @> '["verification:approve"]'::jsonb
           or r.permissions @> '["verification.approve"]'::jsonb
         )
     ) as ok`,
    [evidenceId, identityId],
  );
  return result.rows[0]?.ok === true;
}

export function bearerChallenge(): { error: string; code: "AUTH_REQUIRED" } {
  return { error: "Authenticated session required", code: "AUTH_REQUIRED" };
}
