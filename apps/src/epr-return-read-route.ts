import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission } from "./auth.js";
import { withRlsRequestTransaction, type RlsRequestContextConfig } from "./rls-request-transaction.js";

const EPR_READ_PERMISSIONS = ["epr:read", "epr:manage", "reports:read"];

const EPR_RETURN_LIST_SQL = `select r.id,r.scheme_id,s.code as scheme_code,s.name as scheme_name,
       r.organization_id,r.obligation_id,r.period_start,r.period_end,r.return_type,
       r.reported_quantity,r.obligation_quantity,r.fulfilled_quantity,r.status,
       r.external_reference,r.evidence_id,r.verification_id,r.submitted_at,r.created_at
  from public.epr_returns r
  join public.epr_schemes s on s.id=r.scheme_id
 where r.organization_id=$1
 order by r.period_end desc,r.created_at desc
 limit 100`;

class EprReadPermissionDenied extends Error {
  constructor() {
    super("EPR_RETURN_READ_FORBIDDEN");
    this.name = "EprReadPermissionDenied";
  }
}

/**
 * Registers a single read-only EPR route using the existing explicit
 * withRlsRequestTransaction checked-out-client boundary. Authentication is
 * resolved before the transaction; permission and protected data reads then
 * execute on the same signed tenant client.
 *
 * The server must call this only after the disabled-by-default feature flag
 * and the exact database startup contract both pass. No EPR write route is
 * registered here.
 */
export async function registerEprReturnReadRoute(
  app: FastifyInstance,
  pool: Pool | null,
  contextConfig: RlsRequestContextConfig,
): Promise<void> {
  app.get("/api/v1/epr/returns", async (request, reply) => {
    if (!pool) {
      return reply.code(503).send({
        error: "Authoritative EPR workspace unavailable",
        code: "DATABASE_UNAVAILABLE",
        syntheticData: false,
      });
    }

    let auth;
    try {
      auth = await authenticate(request, pool, "security_definer");
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({
        error: "Authentication service unavailable",
        code: "AUTH_UNAVAILABLE",
        syntheticData: false,
      });
    }
    if (!auth) return reply.code(401).send(bearerChallenge());

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
      const rows = await withRlsRequestTransaction(pool, auth, contextConfig, async (client) => {
        const permitted = await hasOrganizationPermission(
          client,
          auth,
          organizationId,
          EPR_READ_PERMISSIONS,
        );
        if (!permitted) throw new EprReadPermissionDenied();
        return client.query(EPR_RETURN_LIST_SQL, [organizationId]);
      });
      return {
        source: "postgresql",
        syntheticData: false,
        returns: rows.rows,
      };
    } catch (error) {
      if (error instanceof EprReadPermissionDenied) {
        return reply.code(403).send({
          error: "EPR return read permission required",
          code: "EPR_RETURN_READ_FORBIDDEN",
          syntheticData: false,
        });
      }
      request.log.error(error);
      return reply.code(503).send({
        error: "EPR return workspace unavailable",
        syntheticData: false,
      });
    }
  });
}
