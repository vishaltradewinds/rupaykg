import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { withDatabaseTenantContext } from "./db-context.js";

function orgIds(auth: AuthContext): string[] {
  return auth.activeOrganizationId ? [auth.activeOrganizationId] : [...new Set(auth.memberships.map((m) => m.organization_id))];
}

function requestedGeography(request: { query: unknown }): string | null {
  const q = request.query && typeof request.query === "object" ? request.query as Record<string, unknown> : {};
  return typeof q.geographyId === "string" && q.geographyId.trim() ? q.geographyId.trim() : null;
}

export async function registerIntelligenceRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/workspaces/intelligence", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    if (!auth.activeOrganizationId) return reply.code(403).send({ error: "Explicit active organization context is required", code: "ORG_CONTEXT_REQUIRED" });
    const organizationId = auth.activeOrganizationId;
    const geographyId = requestedGeography(request);
    try {
      const findings = await withDatabaseTenantContext(pool, {
        identityId: auth.identityId,
        organizationId,
        bilateralOrganizationScope: false,
        serviceMode: false,
      }, async client => {
        if (!await hasOrganizationPermission(client, auth, organizationId, ["audit:read", "projects:manage"])) {
          throw Object.assign(new Error("Intelligence workspace read permission required"), { code: "WORKSPACE_READ_FORBIDDEN" });
        }
        if (geographyId) {
          const scope = await client.query<{ ok: boolean }>(
            `select exists (
               select 1 from organization_memberships om
                where om.identity_id=$1 and om.status='VERIFIED'
                  and om.organization_id=$3::uuid
                  and organization_has_geography_scope(om.organization_id,$2)
             ) as ok`,
            [auth.identityId, geographyId, organizationId],
          );
          if (!scope.rows[0]?.ok) throw Object.assign(new Error("Geography outside organization authorization scope"), { code: "GEOGRAPHY_FORBIDDEN" });
        }
        const params: unknown[] = [organizationId];
        const geographyClause = geographyId ? " and a.geography_id = $2" : "";
        if (geographyId) params.push(geographyId);
        const rows = await client.query(`
          select a.id as source_record_id, 'ACTIVITY' as source_type,
                 a.activity_type, a.status, a.geography_id, g.name as geography_name,
                 a.occurred_at, a.created_at
          from activities a
          left join geography g on g.id = a.geography_id
          where a.organization_id = $1
            and organization_has_geography_scope(a.organization_id, a.geography_id)
            ${geographyClause}
          order by a.created_at desc limit 100`, params);
        return rows.rows.map((row) => ({
          kind: "OPERATIONAL_REVIEW",
          sourceRecordIds: [row.source_record_id],
          sourceType: row.source_type,
          title: `Review ${row.activity_type}`,
          status: row.status,
          geographyId: row.geography_id,
          geographyName: row.geography_name,
          occurredAt: row.occurred_at,
          action: "REVIEW",
          authoritativeMutation: false,
        }));
      });
      return { source: "postgresql", syntheticData: false, advisory: true, findings };
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "WORKSPACE_READ_FORBIDDEN") return reply.code(403).send({ error: (error as Error).message, code, workspace: "intelligence" });
      if (code === "GEOGRAPHY_FORBIDDEN") return reply.code(403).send({ error: (error as Error).message, code });
      request.log.error(error);
      return reply.code(503).send({ error: "Intelligence workspace unavailable", syntheticData: false });
    }
  });
}
