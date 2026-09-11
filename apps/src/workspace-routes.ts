import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, canVerifyEvidence, hasOrganizationPermission, type AuthContext } from "./auth.js";

async function requireAuth(app: FastifyInstance, pool: Pool | null, request: Parameters<typeof authenticate>[0], reply: { code: (status: number) => { send: (body: unknown) => unknown } }): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try { const auth = await authenticate(request, pool); if (!auth) { reply.code(401).send(bearerChallenge()); return null; } return auth; }
  catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); return null; }
}
function orgIds(auth: AuthContext): string[] { return auth.activeOrganizationId ? [auth.activeOrganizationId] : [...new Set(auth.memberships.map((m) => m.organization_id))]; }
function result<T>(data: T) { return { source: "postgresql", syntheticData: false, data }; }
function requestedGeography(request: { query: unknown }): string | null { const q = request.query && typeof request.query === "object" ? request.query as Record<string, unknown> : {}; return typeof q.geographyId === "string" && q.geographyId.trim() ? q.geographyId.trim() : null; }
async function authorizeGeography(pool: Pool, auth: AuthContext, geographyId: string): Promise<boolean> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(geographyId)) return false;
  const check = await pool.query<{ ok: boolean }>(`select exists (select 1 from organization_memberships om where om.identity_id=$1 and om.status='VERIFIED' and ($3::uuid is null or om.organization_id=$3::uuid) and organization_has_geography_scope(om.organization_id,$2)) as ok`, [auth.identityId, geographyId, auth.activeOrganizationId ?? null]);
  return check.rows[0]?.ok === true;
}
function geoClause(geographyId: string | null, column: string): string { return geographyId ? ` and ${column} = $2` : ""; }

type WorkspaceName = "resourceFlows" | "mrv" | "compliance" | "carbon" | "registry" | "settlement" | "esg";
const WORKSPACE_READ_PERMISSIONS: Record<WorkspaceName, readonly string[]> = {
  resourceFlows: ["waste:read"],
  mrv: ["evidence:upload", "evidence:review", "guardian:read"],
  compliance: ["reports:read", "swm:read", "epr:read", "audit:read"],
  carbon: ["reports:read", "credits:read", "projects:read"],
  registry: ["registry:read", "credits:read"],
  settlement: ["credits:read", "settlement:authorize", "settlement:settle", "AUTHORIZE_SETTLEMENT", "SETTLE_FUNDS"],
  esg: ["reports:read", "epr:read", "csr:read", "audit:read"],
};

async function authorizeWorkspaceRead(pool: Pool, auth: AuthContext, workspace: WorkspaceName): Promise<boolean> {
  const organizations = orgIds(auth);
  if (!organizations.length) return false;
  const permissions = WORKSPACE_READ_PERMISSIONS[workspace];
  for (const organizationId of organizations) {
    if (!await hasOrganizationPermission(pool, auth, organizationId, permissions)) return false;
  }
  return true;
}

export async function registerWorkspaceRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
