import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission } from "./auth.js";

const EPR_READ_PERMISSIONS = ["epr:read", "epr:manage", "reports:read"] as const;

const EPR_RETURN_LIST_SQL = `select r.id,r.scheme_id,s.code as scheme_code,s.name as scheme_name,
       r.organization_id,r.obligation_id,r.period_start,r.period_end,r.return_type,
       r.reported_quantity,r.obligation_quantity,r.fulfilled_quantity,r.status,
       r.external_reference,r.evidence_id,r.verification_id,r.submitted_at,r.created_at
  from epr_returns r
  join epr_schemes s on s.id=r.scheme_id
 where r.organization_id=$1
 order by r.period_end desc,r.created_at desc
 limit 100`;

/**
 * Registers only the EPR read route. The server must register this route only
 * when signed request-context enforcement is enabled. In that mode the
 * request-tenant preHandler has already authenticated the bearer session and
 * opened the transaction-local signed tenant context. The supplied pool must
 * therefore be the context-aware pool, never the raw PostgreSQL pool.
 *
 * EPR write routes remain deliberately unregistered until their transaction,
 * idempotency, obligation-balance and external-reference workflows are migrated.
 */
export async function registerEprReturnReadRoute(
  app: FastifyInstance,
  contextAwarePool: Pool | null,
): Promise<void> {
  app.get("/api/v1/epr/returns", async (request, reply) => {
    if (!contextAwarePool) {
      return reply.code(503).send({
        error: "Authoritative EPR workspace unavailable",
        code: "DATABASE_UNAVAILABLE",
        syntheticData: false,
      });
    }

    let auth;
    try {
      auth = await authenticate(request, contextAwarePool, "security_definer");
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({
        error: "Authentication service unavailable",
        code: "AUTH_UNAVAILABLE",
        syntheticData: false,
      });
    }
    if (!auth) return reply.code(401).send(bearerChallenge());

    // Organization scope comes only from the authenticated, VERIFIED
    // membership selection. Never accept an organization from query/body input.
    const organizationId = auth.activeOrganizationId;
    if (
      !organizationId ||
      auth.bilateralOrganizationScope ||
      !auth.memberships.some(
        (membership) =>
          membership.organization_id.toLowerCase() === organizationId.toLowerCase() &&
          membership.status === "VERIFIED",
      )
    ) {
      return reply.code(403).send({
        error: "A single verified active organization is required",
        code: "ORG_FORBIDDEN",
        syntheticData: false,
      });
    }

    try {
      const permitted = await hasOrganizationPermission(
        contextAwarePool,
        auth,
        organizationId,
        EPR_READ_PERMISSIONS,
      );
      if (!permitted) {
        return reply.code(403).send({
          error: "EPR return read permission required",
          code: "EPR_RETURN_READ_FORBIDDEN",
          syntheticData: false,
        });
      }

      const rows = await contextAwarePool.query(EPR_RETURN_LIST_SQL, [organizationId]);
      return {
        source: "postgresql",
        syntheticData: false,
        returns: rows.rows,
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({
        error: "EPR return workspace unavailable",
        syntheticData: false,
      });
    }
  });
}
