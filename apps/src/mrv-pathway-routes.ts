import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };

type Request = { params: Record<string, string>; log: { error: (error: unknown) => void } };

async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try {
    const auth = await authenticate(request as never, pool);
    if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; }
    return auth;
  } catch (error) {
    request.log.error(error);
    reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false });
    return null;
  }
}

export async function registerMrvPathwayRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/mrv/pathway/:activityId", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const activityId = (request.params as { activityId: string }).activityId;
    try {
      const activity = await pool.query(`select a.id,a.organization_id,a.activity_type,a.status,a.occurred_at,a.geography_id,g.name as geography_name from activities a left join geography g on g.id=a.geography_id where a.id=$1`, [activityId]);
      const row = activity.rows[0];
      if (!row || !canActForOrganization(auth, row.organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN", syntheticData: false });
      if (!row.geography_id || !await hasOrganizationPermission(pool, auth, row.organization_id, ["guardian:read"])) return reply.code(403).send({ error: "MRV read permission required", code: "MRV_PERMISSION_REQUIRED", syntheticData: false });
      const geo = await pool.query<{ ok: boolean }>(`select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3)) as ok`, [auth.identityId, row.organization_id, row.geography_id]);
      if (geo.rows[0]?.ok !== true) return reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN", syntheticData: false });

      const [measurements, evidence, verifications, provenance, calculations] = await Promise.all([
        pool.query(`select id,value,unit,method,source,measured_at,quality_status from measurements where activity_id=$1 order by measured_at desc`, [activityId]),
        pool.query(`select id,measurement_id,evidence_type,status,captured_at,content_uri,content_hash from evidence where activity_id=$1 order by captured_at desc`, [activityId]),
        pool.query(`select id,evidence_id,verifier_identity_id,decision,scope,rationale,decided_at from verifications where activity_id=$1 order by decided_at desc`, [activityId]),
        pool.query(`select id,verification_id,evidence_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,methodology_code,created_at from mrv_provenance_events where activity_id=$1 order by created_at desc`, [activityId]),
        pool.query(`select cc.id,cc.activity_id,mv.methodology_code,mv.version as methodology_version,mv.governance_status,cc.result,cc.unit,cc.status,cc.calculated_at,cc.dataset_hash,cc.formula_hash,cc.calculation_hash,cc.provenance_version from carbon_calculations cc join methodology_versions mv on mv.id=cc.methodology_version_id where cc.activity_id=$1 order by cc.calculated_at desc nulls last,cc.id desc`, [activityId]),
      ]);

      const latestEvidence = evidence.rows[0] ?? null;
      const latestVerification = verifications.rows[0] ?? null;
      const latestProvenance = provenance.rows[0] ?? null;
      const latestCalculation = calculations.rows[0] ?? null;
      return {
        source: "postgresql",
        syntheticData: false,
        activity: row,
        measurement: measurements.rows[0] ?? null,
        evidence: latestEvidence,
        verification: latestVerification,
        provenance: latestProvenance,
        calculation: latestCalculation,
        pathway: {
          activity: row.status === "COMPLETED" ? "VERIFIED" : "PENDING",
          measurement: measurements.rows.length ? "VERIFIED" : "UNAVAILABLE",
          evidence: latestEvidence?.status === "VERIFIED" ? "VERIFIED" : latestEvidence ? "PENDING" : "UNAVAILABLE",
          verification: latestVerification?.decision === "APPROVED" ? "VERIFIED" : latestVerification ? "PENDING" : "UNAVAILABLE",
          guardian: latestProvenance?.guardian_status === "VERIFIED" ? "VERIFIED" : latestProvenance ? "PENDING" : "UNAVAILABLE",
          hedera: latestProvenance?.hcs_status === "CONSENSUS_CONFIRMED" ? "VERIFIED" : latestProvenance ? "PENDING" : "UNAVAILABLE",
          carbon: latestCalculation?.status ? String(latestCalculation.status).toUpperCase() : "UNAVAILABLE",
          registryEligibility: latestProvenance?.guardian_status === "VERIFIED" && latestProvenance?.hcs_status === "CONSENSUS_CONFIRMED" ? "ELIGIBLE" : "NOT_CONFIRMED",
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "Authoritative MRV pathway unavailable", code: "MRV_PATHWAY_UNAVAILABLE", syntheticData: false });
    }
  });
}
