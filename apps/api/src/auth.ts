import { createHash, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Pool } from "pg";

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
    `select organization_id, role_id, status from organization_memberships
     where identity_id = $1 and status = 'VERIFIED'`,
    [rows.rows[0].identity_id],
  );
  return { identityId: rows.rows[0].identity_id, memberships: memberships.rows };
}

export function canActForOrganization(auth: AuthContext, organizationId: string): boolean {
  return auth.memberships.some((m) => m.organization_id === organizationId);
}

export function bearerChallenge(): { error: string; code: "AUTH_REQUIRED" } {
  return { error: "Authenticated session required", code: "AUTH_REQUIRED" };
}
