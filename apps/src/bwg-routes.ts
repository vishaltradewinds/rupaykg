import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { registerEprReturnRoutes } from "./epr-return-routes.js";
import { withRlsRequestTransaction, type RlsRequestContextConfig } from "./rls-request-transaction.js";

async function authFor(request: Parameters<typeof authenticate>[0], reply: { code: (status: number) => { send: (body: unknown) => unknown } }, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try { const auth = await authenticate(request, pool); if (!auth) { reply.code(401).send(bearerChallenge()); return null; } return auth; }
  catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); return null; }
}

function requestContextConfig(): RlsRequestContextConfig | null {
  const hmacSecret = process.env.RUPAYKG_REQUEST_CONTEXT_SECRET;
  const keyId = process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID;
  if (!hmacSecret || Buffer.byteLength(hmacSecret, "utf8") < 32 || !keyId || !/^[a-z0-9_-]{1,32}$/.test(keyId)) return null;
  return { hmacSecret, keyId };
}

/** Compatibility registration point retained for the server's existing BWG registration order. */
export async function registerBwgRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  await registerEprReturnRoutes(app, pool);
  app.get("/api/v1/epr/obligations", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    // The active organization is derived by the server-side session resolver.
    // Never let a route re-select a tenant from an untrusted request header.
    const organizationId = auth.activeOrganizationId;
    if (!organizationId || auth.bilateralOrganizationScope ||
        !auth.memberships.some((membership) => membership.organization_id === organizationId && membership.status === "VERIFIED")) {
      return reply.code(403).send({ error: "A single verified active organization is required", code: "ORG_FORBIDDEN", syntheticData: false });
    }
    const context = requestContextConfig();
    if (!context) return reply.code(503).send({ error: "Signed tenant context is not configured", code: "TENANT_CONTEXT_UNAVAILABLE", syntheticData: false });
    try {
      const rows = await withRlsRequestTransaction(pool, auth, context, async (client) => {
        const permitted = await hasOrganizationPermission(client, auth, organizationId, ["epr:read", "epr:manage", "reports:read"]);
        if (!permitted) return null;
        return client.query(
          `select eo.id as epr_obligation_id,eo.obligation_id,eo.scheme_id,s.code as scheme_code,s.name as scheme_name,eo.category_code,eo.target_quantity,eo.fulfilled_quantity,eo.status,o.period_start,o.period_end,o.jurisdiction_id,g.name as jurisdiction_name
             from epr_obligations eo
             join epr_schemes s on s.id=eo.scheme_id
             join obligations o on o.id=eo.obligation_id
             left join geography g on g.id=o.jurisdiction_id
            where eo.obligated_organization_id=$1
            order by o.period_end desc,eo.id desc
            limit 100`,
          [organizationId],
        );
      });
      if (!rows) return reply.code(403).send({ error: "EPR obligation read permission required", code: "EPR_OBLIGATION_READ_FORBIDDEN", syntheticData: false });
      return { source: "postgresql", syntheticData: false, obligations: rows.rows };
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "EPR obligation workspace unavailable", code: "EPR_OBLIGATION_READ_UNAVAILABLE", syntheticData: false });
    }
  });
}
