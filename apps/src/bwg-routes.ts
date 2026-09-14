import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { registerEprReturnRoutes } from "./epr-return-routes.js";

async function authFor(request: Parameters<typeof authenticate>[0], reply: { code: (status: number) => { send: (body: unknown) => unknown } }, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try { const auth = await authenticate(request, pool); if (!auth) { reply.code(401).send(bearerChallenge()); return null; } return auth; }
  catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); return null; }
}

/** Compatibility registration point retained for the server's existing BWG registration order. */
export async function registerBwgRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  await registerEprReturnRoutes(app, pool);
  app.get("/api/v1/epr/obligations", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const organizationId = typeof request.headers["x-rupaykg-organization-id"] === "string" ? request.headers["x-rupaykg-organization-id"] : auth.activeOrganizationId;
    if (!organizationId || !auth.memberships.some((membership) => membership.organization_id === organizationId && membership.status === "VERIFIED")) return reply.code(403).send({ error: "Verified organization membership required", code: "ORG_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["epr:read", "epr:manage", "reports:read"])) return reply.code(403).send({ error: "EPR obligation read permission required", code: "EPR_OBLIGATION_READ_FORBIDDEN" });
    try {
      const rows = await pool.query(`select eo.id as epr_obligation_id,eo.obligation_id,eo.scheme_id,s.code as scheme_code,s.name as scheme_name,eo.category_code,eo.target_quantity,eo.fulfilled_quantity,eo.status,o.period_start,o.period_end,o.jurisdiction_id,g.name as jurisdiction_name from epr_obligations eo join epr_schemes s on s.id=eo.scheme_id join obligations o on o.id=eo.obligation_id left join geography g on g.id=o.jurisdiction_id where eo.obligated_organization_id=$1 order by o.period_end desc,eo.id desc limit 100`, [organizationId]);
      return { source: "postgresql", syntheticData: false, obligations: rows.rows };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "EPR obligation workspace unavailable", syntheticData: false }); }
  });
}
