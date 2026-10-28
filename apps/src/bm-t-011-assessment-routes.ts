import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { calculateBmT011Annual, type BmT011AnnualInput } from "@rupaykg/carbon";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bodyOf = (r: Request): Record<string, unknown> => r.body && typeof r.body === "object" ? r.body as Record<string, unknown> : {};
const str = (b: Record<string, unknown>, k: string, max = 120): string | null => typeof b[k] === "string" && b[k].trim() && b[k].trim().length <= max ? b[k].trim() : null;

async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try {
    const auth = await authenticate(request as never, pool);
    if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; }
    return auth;
  } catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE" }); return null; }
}

async function authorizedActivity(pool: Pool, auth: AuthContext, activityId: string): Promise<string | null> {
  const result = await pool.query<{ organization_id: string; geography_id: string | null }>(
    "select organization_id,geography_id from activities where id=$1", [activityId]);
  const row = result.rows[0];
  if (!row || !row.geography_id || !canActForOrganization(auth, row.organization_id)) return null;
  const scope = await pool.query<{ ok:boolean }>(
    "select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3)) as ok",
    [auth.identityId, row.organization_id, row.geography_id]);
  return scope.rows[0]?.ok ? row.organization_id : null;
}

function evidenceIdsFrom(input: BmT011AnnualInput): string[] {
  return [...new Set([...input.parameterEvidenceRefs, ...input.wasteRecords.flatMap(record => record.evidenceRefs)])].sort();
}

async function evidenceIsVerified(pool: Pool | PoolClient, activityId: string, ids: string[]): Promise<boolean> {
  const result = await pool.query<{ count:string }>(
    "select count(*)::text count from evidence where activity_id=$1 and id=any($2::uuid[]) and status='VERIFIED' and (content_hash is not null or content_uri is not null)",
    [activityId, ids]);
  return Number(result.rows[0]?.count ?? 0) === ids.length;
}

export async function registerBmT011AssessmentRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/mrv/activities/:activityId/bm-t011/annual-assessments", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const activityId = (request.params as {activityId:string}).activityId;
    if (!UUID.test(activityId)) return reply.code(400).send({ error:"Valid activityId required", code:"ACTIVITY_ID_INVALID" });
    const organizationId = await authorizedActivity(pool, auth, activityId);
    if (!organizationId) return reply.code(403).send({ error:"Activity is outside verified organization/geography scope", code:"ACTIVITY_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["projects:manage", "waste:record"])) return reply.code(403).send({ error:"Project management or waste recording permission required", code:"BMT011_SUBMIT_FORBIDDEN" });
    const body = bodyOf(request as never);
    const calculationPeriodId = str(body, "calculationPeriodId");
    if (!calculationPeriodId || !Number.isSafeInteger(body.targetYearIndex) || !Array.isArray(body.wasteRecords) || !Array.isArray(body.parameterEvidenceRefs)) {
      return reply.code(400).send({ error:"calculationPeriodId, targetYearIndex, wasteRecords and parameterEvidenceRefs are required", code:"BMT011_INPUTS_INVALID" });
    }
    const input = { ...body, activityId, calculationPeriodId } as unknown as BmT011AnnualInput;
    let ids: string[];
    try {
      if (input.wasteRecords.length > 1000 || input.parameterEvidenceRefs.length > 100) throw new Error("BM-T-011 evidence/input bounds exceeded");
      ids = evidenceIdsFrom(input);
      if (ids.length === 0 || ids.length > 5000 || ids.some(value => !UUID.test(value))) throw new Error("All BM-T-011 evidence references must be valid UUIDs");
      if (new Set([...input.parameterEvidenceRefs, ...input.wasteRecords.flatMap(record => record.evidenceRefs)]).size !== ids.length) throw new Error("Duplicate BM-T-011 evidence references are not allowed");
      const result = calculateBmT011Annual(input);
      if (!await evidenceIsVerified(pool, activityId, ids)) return reply.code(409).send({ error:"Every BM-T-011 evidence item must be VERIFIED, content-addressed, and belong to this activity", code:"BMT011_EVIDENCE_NOT_VERIFIED" });
      const inserted = await pool.query(
        `insert into bm_t011_assessments(organization_id,activity_id,calculation_period_id,target_year_index,calculation_mode,calculation_input,calculation_result,emissions_tco2e,input_sha256,output_sha256,evidence_ids,created_by_identity_id)
         values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11::uuid[],$12)
         returning id,organization_id,activity_id,calculation_period_id,target_year_index,calculation_mode,emissions_tco2e,input_sha256,output_sha256,evidence_ids,status,created_by_identity_id,created_at`,
        [organizationId, activityId, calculationPeriodId, input.targetYearIndex, input.calculationMode, JSON.stringify(input),
          JSON.stringify(result), result.emissionsTco2e, result.inputSha256, result.outputSha256, ids, auth.identityId]);
      return reply.code(201).send({ source:"postgresql", syntheticData:false, assessment:inserted.rows[0],
        note:"BM-T-011 v1.0 annual Application A result is pending independent review; it is methane emission potential in tCO2e, not FCH4,BL and not a carbon-credit decision." });
    } catch (error) {
      if (error instanceof Error && /BM-T-011|waste|evidence|finite|fraction|climate|SWDS|yearIndex|Duplicate|unsupported|must be|required|bounds|targetYearIndex|capturedFraction/.test(error.message)) return reply.code(400).send({ error:error.message, code:"BMT011_INPUTS_INVALID" });
      if ((error as {code?:string}).code === "23505") return reply.code(409).send({ error:"An assessment already exists for this activity, period, year and calculation mode", code:"BMT011_ASSESSMENT_EXISTS" });
      request.log.error(error); return reply.code(503).send({ error:"BM-T-011 assessment unavailable", code:"BMT011_ASSESSMENT_UNAVAILABLE", syntheticData:false });
    }
  });

  app.post("/api/v1/mrv/bm-t011/assessments/:assessmentId/decision", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const assessmentId = (request.params as {assessmentId:string}).assessmentId;
    if (!UUID.test(assessmentId)) return reply.code(400).send({ error:"Valid assessmentId required", code:"BMT011_ASSESSMENT_ID_INVALID" });
    const body = bodyOf(request as never);
    const decision = body.decision;
    const note = str(body, "note", 2000);
    if (decision !== "APPROVED" && decision !== "REJECTED") return reply.code(400).send({ error:"decision must be APPROVED or REJECTED", code:"BMT011_DECISION_INVALID" });
    if (decision === "REJECTED" && !note) return reply.code(400).send({ error:"A reason is required when rejecting an assessment", code:"BMT011_REJECTION_REASON_REQUIRED" });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query<{
        id:string; organization_id:string; activity_id:string; calculation_input:BmT011AnnualInput; calculation_result:{outputSha256:string;inputSha256:string};
        evidence_ids:string[]; status:string; created_by_identity_id:string;
      }>("select * from bm_t011_assessments where id=$1 for update", [assessmentId]);
      const row = result.rows[0];
      if (!row || !canActForOrganization(auth, row.organization_id)) { await client.query("rollback"); return reply.code(404).send({ error:"Assessment not found in authorized organization", code:"BMT011_ASSESSMENT_NOT_FOUND" }); }
      if (!await hasOrganizationPermission(client, auth, row.organization_id, ["projects:verify", "VERIFY_EVIDENCE"])) { await client.query("rollback"); return reply.code(403).send({ error:"Independent verification permission required", code:"BMT011_REVIEW_FORBIDDEN" }); }
      if (row.status !== "CALCULATED_PENDING_VERIFICATION") { await client.query("rollback"); return reply.code(409).send({ error:"Only a pending assessment can receive a decision", code:"BMT011_ALREADY_DECIDED" }); }
      if (row.created_by_identity_id === auth.identityId) { await client.query("rollback"); return reply.code(403).send({ error:"Assessment creator cannot review their own calculation", code:"BMT011_SEPARATION_OF_DUTIES" }); }
      if (!await evidenceIsVerified(client as unknown as Pool, row.activity_id, row.evidence_ids)) { await client.query("rollback"); return reply.code(409).send({ error:"Assessment evidence is no longer verified/content-addressed", code:"BMT011_EVIDENCE_NOT_VERIFIED" }); }
      const recomputed = calculateBmT011Annual(row.calculation_input);
      if (recomputed.inputSha256 !== row.calculation_result.inputSha256 || recomputed.outputSha256 !== row.calculation_result.outputSha256) {
        await client.query("rollback"); return reply.code(409).send({ error:"Persisted BM-T-011 calculation hash mismatch", code:"BMT011_HASH_MISMATCH" });
      }
      const updated = await client.query(
        "update bm_t011_assessments set status=$2,reviewed_by_identity_id=$3,reviewed_at=now(),review_note=$4 where id=$1 returning id,status,reviewed_by_identity_id,reviewed_at,review_note,input_sha256,output_sha256",
        [assessmentId, decision, auth.identityId, note]);
      await client.query("commit");
      return { source:"postgresql", syntheticData:false, decision:updated.rows[0],
        note:"Independent internal review only. This does not establish BEE/ACVA approval, WA03.001 eligibility, FCH4,BL, or carbon-credit issuance." };
    } catch (error) { await client.query("rollback").catch(() => undefined); request.log.error(error); return reply.code(503).send({ error:"BM-T-011 review unavailable", code:"BMT011_REVIEW_UNAVAILABLE", syntheticData:false }); }
    finally { client.release(); }
  });
}
