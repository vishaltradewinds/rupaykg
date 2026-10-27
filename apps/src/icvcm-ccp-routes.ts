import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { assessIcvcmCcpEvidence, ICVCM_CCP_PRINCIPLES, type CcpPrincipleAssessment } from "@rupaykg/carbon";
import { authenticate, bearerChallenge, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void } };
type Body = Record<string, unknown>;
const bodyOf = (request: Request): Body => request.body && typeof request.body === "object" && !Array.isArray(request.body) ? request.body as Body : {};
const str = (body: Body, key: string): string | null => typeof body[key] === "string" && (body[key] as string).trim() ? (body[key] as string).trim() : null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorize(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" }); return null; }
  try {
    const auth = await authenticate(request as never, pool);
    if (!auth) { reply.code(401).send(bearerChallenge()); return null; }
    return auth;
  } catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE" }); return null; }
}

export async function registerIcvcmCcpRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/activities/:activityId/icvcm-ccp-assessments", async (request, reply) => {
    const auth = await authorize(request as never, reply, pool); if (!auth || !pool) return;
    const activityId = (request.params as { activityId: string }).activityId;
    if (!UUID.test(activityId)) return reply.code(400).send({ error: "Valid activityId is required", code: "INVALID_ACTIVITY_ID" });
    const body = bodyOf(request as never);
    const organizationId = str(body, "organizationId");
    const rawAssessments = body.assessments;
    if (!organizationId || !UUID.test(organizationId) || !Array.isArray(rawAssessments)) {
      return reply.code(400).send({ error: "organizationId and assessments array are required", code: "INVALID_ASSESSMENT_REQUEST" });
    }
    if (!canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
    try {
      if (!await hasOrganizationPermission(pool, auth, organizationId, ["evidence:review"])) {
        return reply.code(403).send({ error: "evidence:review permission is required for internal assessment", code: "PERMISSION_FORBIDDEN" });
      }
      const activity = await pool.query<{ organization_id: string; geography_id: string | null }>(
        "select organization_id, geography_id from activities where id=$1", [activityId]);
      if (!activity.rows[0] || activity.rows[0].organization_id !== organizationId || !activity.rows[0].geography_id) {
        return reply.code(404).send({ error: "Activity not found in the requested organization scope", code: "ACTIVITY_NOT_FOUND" });
      }
      const geography = await pool.query<{ ok: boolean }>(
        "select organization_has_geography_scope($1::uuid,$2::uuid) as ok", [organizationId, activity.rows[0].geography_id]);
      if (geography.rows[0]?.ok !== true) return reply.code(403).send({ error: "Activity is outside organization geography scope", code: "GEOGRAPHY_FORBIDDEN" });

      let summary;
      try { summary = assessIcvcmCcpEvidence(rawAssessments as CcpPrincipleAssessment[]); }
      catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid assessment", code: "INVALID_ASSESSMENT" }); }

      // Bind every cited evidence ID to a VERIFIED evidence record for this exact activity.
      const evidenceIds = [...new Set(summary.controls.flatMap(control => control.evidenceReferences))];
      if (evidenceIds.some(id => !UUID.test(id))) return reply.code(400).send({ error: "Evidence references must be UUIDs from the RupayKg evidence vault", code: "INVALID_EVIDENCE_REFERENCE" });
      if (evidenceIds.length) {
        const evidence = await pool.query<{ id: string }>(
          "select e.id from evidence e where e.id = any($1::uuid[]) and e.activity_id=$2 and e.status='VERIFIED'",
          [evidenceIds, activityId]);
        if (evidence.rows.length !== evidenceIds.length) {
          return reply.code(409).send({ error: "Every evidence reference must resolve to VERIFIED evidence for this activity", code: "EVIDENCE_NOT_VERIFIED_OR_OUT_OF_SCOPE" });
        }
      }
      const assessments = rawAssessments as CcpPrincipleAssessment[];
      // Serialize revision allocation per organization/activity while retaining the
      // unique constraint as the final database-level integrity guard.
      // The lock and insert run in one statement/transaction, so concurrent requests
      // cannot both allocate the same revision number.
      const saved = await pool.query(
        `with revision_lock as materialized (
           select pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text, 0))
         ),
         next_revision as (
           select coalesce(max(a.revision_number), 0) + 1 as revision_number
             from icvcm_ccp_assessments a cross join revision_lock
            where a.organization_id=$1 and a.activity_id=$2
         )
         insert into icvcm_ccp_assessments
           (organization_id, activity_id, assessed_by_identity_id, revision_number, assessment, summary, status)
         select $1, $2, $3, next_revision.revision_number, $4::jsonb, $5::jsonb, 'INTERNAL_DRAFT'
           from next_revision
         returning id, organization_id, activity_id, assessed_by_identity_id, revision_number, assessment, summary, status, created_at`,
        [organizationId, activityId, auth.identityId, JSON.stringify(assessments), JSON.stringify(summary)]);
      return reply.code(200).send({
        source: "postgresql", syntheticData: false,
        record: saved.rows[0],
        limitations: [
          "INTERNAL_DRAFT is not ICVCM approval, CCP eligibility, certification, independent validation/verification, or a credit issuance decision.",
          "This endpoint checks evidence completeness and verified evidence linkage only; it does not establish substantive conformity with every principle.",
          "Applicable Indian statutory and regulatory requirements remain separate mandatory gates.",
          "No API route in this batch independently approves this assessment; independent review remains a separate human-controlled gate."
        ]
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "ICVCM assessment persistence unavailable", code: "ICVCM_ASSESSMENT_UNAVAILABLE", syntheticData: false });
    }
  });

  app.get("/api/v1/activities/:activityId/icvcm-ccp-assessments", async (request, reply) => {
    const auth = await authorize(request as never, reply, pool); if (!auth || !pool) return;
    const activityId = (request.params as { activityId: string }).activityId;
    if (!UUID.test(activityId)) return reply.code(400).send({ error: "Valid activityId is required", code: "INVALID_ACTIVITY_ID" });
    const organizationId = auth.activeOrganizationId;
    if (!organizationId || !canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Select an authorized organization", code: "ORG_FORBIDDEN" });
    try {
      if (!await hasOrganizationPermission(pool, auth, organizationId, ["evidence:review", "evidence:upload"])) {
        return reply.code(403).send({ error: "Evidence review/read permission is required", code: "PERMISSION_FORBIDDEN" });
      }
      const activity = await pool.query<{ geography_id: string | null }>(
        "select geography_id from activities where id=$1 and organization_id=$2",
        [activityId, organizationId]);
      if (!activity.rows[0] || !activity.rows[0].geography_id) {
        return reply.code(404).send({ error: "Activity not found in the requested organization scope", code: "ACTIVITY_NOT_FOUND" });
      }
      const geography = await pool.query<{ ok: boolean }>(
        "select organization_has_geography_scope($1::uuid,$2::uuid) as ok",
        [organizationId, activity.rows[0].geography_id]);
      if (geography.rows[0]?.ok !== true) {
        return reply.code(403).send({ error: "Activity is outside organization geography scope", code: "GEOGRAPHY_FORBIDDEN" });
      }
      const rows = await pool.query(
        "select id, organization_id, activity_id, assessed_by_identity_id, revision_number, assessment, summary, status, created_at from icvcm_ccp_assessments where organization_id=$1 and activity_id=$2 order by revision_number desc limit 1",
        [organizationId, activityId]);
      return { source: "postgresql", syntheticData: false, principles: ICVCM_CCP_PRINCIPLES, record: rows.rows[0] ?? null };
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "ICVCM assessment retrieval unavailable", code: "ICVCM_ASSESSMENT_UNAVAILABLE", syntheticData: false });
    }
  });
}
