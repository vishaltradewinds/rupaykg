import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, type AuthContext } from "./auth.js";

function orgIds(auth: AuthContext): string[] { return [...new Set(auth.memberships.map((m) => m.organization_id))]; }

export async function registerIntelligenceRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/workspaces/intelligence", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const ids = orgIds(auth);
    if (!ids.length) return { source: "postgresql", syntheticData: false, findings: [] };
    try {
      const rows = await pool.query(`
        select a.id as source_record_id, 'ACTIVITY' as source_type,
               a.activity_type, a.status, a.geography_id, g.name as geography_name,
               a.occurred_at, a.created_at
        from activities a
        left join geography g on g.id = a.geography_id
        where a.organization_id = any($1::uuid[])
        order by a.created_at desc limit 100`, [ids]);
      const findings = rows.rows.map((row) => ({
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
      return { source: "postgresql", syntheticData: false, advisory: true, findings };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Intelligence workspace unavailable", syntheticData: false }); }
  });
}
