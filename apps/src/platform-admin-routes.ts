import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate } from "./auth.js";

export async function registerPlatformAdminRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/admin/overview", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth;
    try {
      auth = await authenticate(request, pool);
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false });
    }
    if (!auth) return reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED", syntheticData: false });
    try {
      const authority = await pool.query<{ ok: boolean }>(
        `select exists (
           select 1 from organization_memberships om
           join roles r on r.id = om.role_id
           where om.identity_id = $1 and om.status = 'VERIFIED' and r.name = 'super_admin'
         ) as ok`,
        [auth.identityId],
      );
      if (authority.rows[0]?.ok !== true) {
        return reply.code(403).send({ error: "Super Admin authority required", code: "PLATFORM_ADMIN_FORBIDDEN", syntheticData: false });
      }
      const result = await pool.query<{
        verifiedIdentities: string;
        organizations: string;
        verifiedMemberships: string;
        pendingApplications: string;
        pendingLegalReviews: string;
        anchoredMrvRecords: string;
      }>(
        `select
          (select count(*)::text from identities where status = 'VERIFIED') as "verifiedIdentities",
          (select count(*)::text from organizations) as organizations,
          (select count(*)::text from organization_memberships where status = 'VERIFIED') as "verifiedMemberships",
          (select count(*)::text from stakeholder_applications where status = 'PENDING') as "pendingApplications",
          (select count(*)::text from organizations where verification_status in ('UNDER_REVIEW','PENDING')) as "pendingLegalReviews",
          (select count(*)::text from mrv_provenance_events where guardian_status = 'VERIFIED' and hcs_status = 'CONSENSUS_CONFIRMED') as "anchoredMrvRecords"`,
      );
      const row = result.rows[0];
      if (!row) throw new Error("Platform overview query returned no result");
      return {
        source: "postgresql",
        syntheticData: false,
        scope: "PLATFORM",
        counts: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])),
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "Platform administration overview unavailable", code: "PLATFORM_OVERVIEW_UNAVAILABLE", syntheticData: false });
    }
  });
}
