import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; headers: Record<string, unknown>; log: { error: (error: unknown) => void } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bodyOf = (r: Request): Record<string, unknown> => r.body && typeof r.body === "object" ? r.body as Record<string, unknown> : {};
const str = (b: Record<string, unknown>, k: string, max = 500): string | null => typeof b[k] === "string" && b[k].trim() && b[k].trim().length <= max ? b[k].trim() : null;
const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
};
const hash = (value: unknown): string => createHash("sha256").update(canonicalize(value)).digest("hex");

async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try { const auth = await authenticate(request as never, pool); if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; } return auth; }
  catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE" }); return null; }
}
async function authorizedActivity(pool: Pool, auth: AuthContext, activityId: string): Promise<string | null> {
  const result = await pool.query<{ organization_id: string; ok: boolean }>(
    `select a.organization_id,
       (a.geography_id is not null and organization_has_geography_scope(a.organization_id,a.geography_id)
        and exists(select 1 from organization_memberships om where om.identity_id=$2 and om.organization_id=a.organization_id and om.status='VERIFIED')) as ok
     from activities a where a.id=$1`, [activityId, auth.identityId]);
  const row = result.rows[0];
  return row?.ok && canActForOrganization(auth, row.organization_id) ? row.organization_id : null;
}
async function evidenceIsVerifiedForActivity(pool: Pool | PoolClient, activityId: string, evidenceIds: string[]): Promise<boolean> {
  const result = await pool.query<{ count: string }>(
    "select count(*)::text count from evidence where activity_id=$1 and id=any($2::uuid[]) and status='VERIFIED' and content_hash ~ '^[0-9a-f]{64}", [activityId, evidenceIds]);
  return Number(result.rows[0]?.count ?? 0) === evidenceIds.length;
}
export async function registerBmWa03001BaselineRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/mrv/activities/:activityId/bm-wa03001/baselines", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const { activityId } = request.params as { activityId: string };
    if (!UUID.test(activityId)) return reply.code(400).send({ error: "Valid activityId required", code: "ACTIVITY_ID_INVALID" });
    const organizationId = await authorizedActivity(pool, auth, activityId);
    if (!organizationId) return reply.code(403).send({ error: "Activity is outside verified organization/geography scope", code: "ACTIVITY_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["projects:manage", "waste:record"])) return reply.code(403).send({ error: "Project management or waste recording permission required", code: "BASELINE_SUBMIT_FORBIDDEN" });
    const body = bodyOf(request as never);
    const baselinePeriod = str(body, "baselinePeriod", 120);
    const value = body.baselineFch4Tch4;
    const evidenceIds = body.evidenceIds;
    if (!baselinePeriod || typeof value !== "number" || !Number.isFinite(value) || value < 0 || !Array.isArray(evidenceIds) || evidenceIds.length < 1 || evidenceIds.length > 50 || evidenceIds.some(id => typeof id !== "string" || !UUID.test(id)) || new Set(evidenceIds).size !== evidenceIds.length) {
      return reply.code(400).send({ error: "baselinePeriod, non-negative baselineFch4Tch4 and 1-50 unique evidence UUIDs are required", code: "BASELINE_INPUTS_INVALID" });
    }
    try {
      if (!await evidenceIsVerifiedForActivity(pool, activityId, evidenceIds as string[])) return reply.code(409).send({ error: "Every baseline evidence item must be VERIFIED with a valid SHA-256 content hash and belong to this activity", code: "BASELINE_EVIDENCE_NOT_VERIFIED" });
      const core = { activityId, organizationId, methodologyCode: "BM WA03.001", methodologyVersion: "1.0", baselineFch4Tch4: value, baselinePeriod, evidenceIds: [...(evidenceIds as string[])].sort(), submittedByIdentityId: auth.identityId };
      const recordSha256 = hash(core);
      const result = await pool.query(
        `insert into bm_wa03001_baseline_records(organization_id,activity_id,baseline_fch4_tch4,baseline_period,evidence_ids,record_sha256,submitted_by_identity_id)
         values($1,$2,$3,$4,$5::uuid[],$6,$7)
         returning id,organization_id,activity_id,methodology_code,methodology_version,baseline_fch4_tch4,baseline_period,evidence_ids,record_sha256,status,submitted_by_identity_id,submitted_at`,
        [organizationId, activityId, value, baselinePeriod, evidenceIds, recordSha256, auth.identityId]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, baseline: result.rows[0], note: "Submitted for independent review; this record is not approved and does not establish methodology eligibility." });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Baseline submission unavailable", code: "BASELINE_SUBMISSION_UNAVAILABLE", syntheticData: false }); }
  });

  app.get("/api/v1/mrv/activities/:activityId/bm-wa03001/baselines", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const { activityId } = request.params as { activityId: string };
    if (!UUID.test(activityId)) return reply.code(400).send({ error: "Valid activityId required", code: "ACTIVITY_ID_INVALID" });
    const organizationId = await authorizedActivity(pool, auth, activityId);
    if (!organizationId) return reply.code(403).send({ error: "Activity is outside verified organization/geography scope", code: "ACTIVITY_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["projects:read", "projects:review", "evidence:read", "guardian:read"])) return reply.code(403).send({ error: "Baseline read permission required", code: "BASELINE_READ_FORBIDDEN" });
    try {
      const result = await pool.query(
        `select id,organization_id,activity_id,methodology_code,methodology_version,baseline_fch4_tch4,baseline_period,evidence_ids,record_sha256,status,submitted_by_identity_id,submitted_at,approved_by_identity_id,approved_at,approval_note
         from bm_wa03001_baseline_records where activity_id=$1 and organization_id=$2 order by submitted_at desc`, [activityId, organizationId]);
      return { source: "postgresql", syntheticData: false, baselines: result.rows };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Baseline records unavailable", code: "BASELINE_READ_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/mrv/bm-wa03001/baselines/:baselineId/decision", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const { baselineId } = request.params as { baselineId: string };
    if (!UUID.test(baselineId)) return reply.code(400).send({ error: "Valid baselineId required", code: "BASELINE_ID_INVALID" });
    const body = bodyOf(request as never);
    const decision = body.decision;
    const note = str(body, "note", 2000);
    if (decision !== "APPROVED" && decision !== "REJECTED") return reply.code(400).send({ error: "decision must be APPROVED or REJECTED", code: "BASELINE_DECISION_INVALID" });
    if (decision === "REJECTED" && !note) return reply.code(400).send({ error: "A reason is required when rejecting a baseline", code: "BASELINE_REJECTION_REASON_REQUIRED" });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query<{ id: string; activity_id: string; organization_id: string; status: string; submitted_by_identity_id: string; evidence_ids: string[]; baseline_fch4_tch4: string; baseline_period: string; methodology_code: string; methodology_version: string; record_sha256: string }>(
        "select * from bm_wa03001_baseline_records where id=$1 for update", [baselineId]);
      const row = result.rows[0];
      if (!row || !canActForOrganization(auth, row.organization_id)) { await client.query("rollback"); return reply.code(404).send({ error: "Baseline record not found in authorized organization", code: "BASELINE_NOT_FOUND" }); }
      if (!await hasOrganizationPermission(client, auth, row.organization_id, ["projects:verify", "VERIFY_EVIDENCE"])) { await client.query("rollback"); return reply.code(403).send({ error: "Independent verification permission required", code: "BASELINE_APPROVAL_FORBIDDEN" }); }
      if (row.status !== "SUBMITTED") { await client.query("rollback"); return reply.code(409).send({ error: "Only a SUBMITTED baseline can receive a decision", code: "BASELINE_ALREADY_DECIDED" }); }
      if (row.submitted_by_identity_id === auth.identityId) { await client.query("rollback"); return reply.code(403).send({ error: "Baseline submitter cannot approve or reject their own record", code: "BASELINE_SEPARATION_OF_DUTIES" }); }
      if (!await evidenceIsVerifiedForActivity(client, row.activity_id, row.evidence_ids)) { await client.query("rollback"); return reply.code(409).send({ error: "Baseline evidence is no longer fully verified with a valid SHA-256 content hash for this activity", code: "BASELINE_EVIDENCE_NOT_VERIFIED" }); }
      const core = { activityId: row.activity_id, organizationId: row.organization_id, methodologyCode: row.methodology_code, methodologyVersion: row.methodology_version, baselineFch4Tch4: Number(row.baseline_fch4_tch4), baselinePeriod: row.baseline_period, evidenceIds: [...row.evidence_ids].sort(), submittedByIdentityId: row.submitted_by_identity_id };
      if (hash(core) !== row.record_sha256) { await client.query("rollback"); return reply.code(409).send({ error: "Baseline record integrity hash mismatch", code: "BASELINE_HASH_MISMATCH" }); }
      const updated = await client.query(
        "update bm_wa03001_baseline_records set status=$2,approved_by_identity_id=$3,approved_at=now(),approval_note=$4 where id=$1 returning id,status,approved_by_identity_id,approved_at,approval_note,record_sha256",
        [baselineId, decision, auth.identityId, note]);
      await client.query("commit");
      return { source: "postgresql", syntheticData: false, baselineDecision: updated.rows[0], note: "Decision is an internal evidence workflow outcome, not a BEE/BEE registry approval or carbon-credit issuance." };
    } catch (error) { await client.query("rollback").catch(() => undefined); request.log.error(error); return reply.code(503).send({ error: "Baseline decision unavailable", code: "BASELINE_DECISION_UNAVAILABLE", syntheticData: false }); }
    finally { client.release(); }
  });
}
", [activityId, evidenceIds]);
  return Number(result.rows[0]?.count ?? 0) === evidenceIds.length;
}
export async function registerBmWa03001BaselineRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/mrv/activities/:activityId/bm-wa03001/baselines", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const { activityId } = request.params as { activityId: string };
    if (!UUID.test(activityId)) return reply.code(400).send({ error: "Valid activityId required", code: "ACTIVITY_ID_INVALID" });
    const organizationId = await authorizedActivity(pool, auth, activityId);
    if (!organizationId) return reply.code(403).send({ error: "Activity is outside verified organization/geography scope", code: "ACTIVITY_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["projects:manage", "waste:record"])) return reply.code(403).send({ error: "Project management or waste recording permission required", code: "BASELINE_SUBMIT_FORBIDDEN" });
    const body = bodyOf(request as never);
    const baselinePeriod = str(body, "baselinePeriod", 120);
    const value = body.baselineFch4Tch4;
    const evidenceIds = body.evidenceIds;
    if (!baselinePeriod || typeof value !== "number" || !Number.isFinite(value) || value < 0 || !Array.isArray(evidenceIds) || evidenceIds.length < 1 || evidenceIds.length > 50 || evidenceIds.some(id => typeof id !== "string" || !UUID.test(id)) || new Set(evidenceIds).size !== evidenceIds.length) {
      return reply.code(400).send({ error: "baselinePeriod, non-negative baselineFch4Tch4 and 1-50 unique evidence UUIDs are required", code: "BASELINE_INPUTS_INVALID" });
    }
    try {
      if (!await evidenceIsVerifiedForActivity(pool, activityId, evidenceIds as string[])) return reply.code(409).send({ error: "Every baseline evidence item must be VERIFIED with a valid SHA-256 content hash and belong to this activity", code: "BASELINE_EVIDENCE_NOT_VERIFIED" });
      const core = { activityId, organizationId, methodologyCode: "BM WA03.001", methodologyVersion: "1.0", baselineFch4Tch4: value, baselinePeriod, evidenceIds: [...(evidenceIds as string[])].sort(), submittedByIdentityId: auth.identityId };
      const recordSha256 = hash(core);
      const result = await pool.query(
        `insert into bm_wa03001_baseline_records(organization_id,activity_id,baseline_fch4_tch4,baseline_period,evidence_ids,record_sha256,submitted_by_identity_id)
         values($1,$2,$3,$4,$5::uuid[],$6,$7)
         returning id,organization_id,activity_id,methodology_code,methodology_version,baseline_fch4_tch4,baseline_period,evidence_ids,record_sha256,status,submitted_by_identity_id,submitted_at`,
        [organizationId, activityId, value, baselinePeriod, evidenceIds, recordSha256, auth.identityId]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, baseline: result.rows[0], note: "Submitted for independent review; this record is not approved and does not establish methodology eligibility." });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Baseline submission unavailable", code: "BASELINE_SUBMISSION_UNAVAILABLE", syntheticData: false }); }
  });

  app.get("/api/v1/mrv/activities/:activityId/bm-wa03001/baselines", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const { activityId } = request.params as { activityId: string };
    if (!UUID.test(activityId)) return reply.code(400).send({ error: "Valid activityId required", code: "ACTIVITY_ID_INVALID" });
    const organizationId = await authorizedActivity(pool, auth, activityId);
    if (!organizationId) return reply.code(403).send({ error: "Activity is outside verified organization/geography scope", code: "ACTIVITY_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["projects:read", "projects:review", "evidence:read", "guardian:read"])) return reply.code(403).send({ error: "Baseline read permission required", code: "BASELINE_READ_FORBIDDEN" });
    try {
      const result = await pool.query(
        `select id,organization_id,activity_id,methodology_code,methodology_version,baseline_fch4_tch4,baseline_period,evidence_ids,record_sha256,status,submitted_by_identity_id,submitted_at,approved_by_identity_id,approved_at,approval_note
         from bm_wa03001_baseline_records where activity_id=$1 and organization_id=$2 order by submitted_at desc`, [activityId, organizationId]);
      return { source: "postgresql", syntheticData: false, baselines: result.rows };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Baseline records unavailable", code: "BASELINE_READ_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/mrv/bm-wa03001/baselines/:baselineId/decision", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const { baselineId } = request.params as { baselineId: string };
    if (!UUID.test(baselineId)) return reply.code(400).send({ error: "Valid baselineId required", code: "BASELINE_ID_INVALID" });
    const body = bodyOf(request as never);
    const decision = body.decision;
    const note = str(body, "note", 2000);
    if (decision !== "APPROVED" && decision !== "REJECTED") return reply.code(400).send({ error: "decision must be APPROVED or REJECTED", code: "BASELINE_DECISION_INVALID" });
    if (decision === "REJECTED" && !note) return reply.code(400).send({ error: "A reason is required when rejecting a baseline", code: "BASELINE_REJECTION_REASON_REQUIRED" });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query<{ id: string; activity_id: string; organization_id: string; status: string; submitted_by_identity_id: string; evidence_ids: string[]; baseline_fch4_tch4: string; baseline_period: string; methodology_code: string; methodology_version: string; record_sha256: string }>(
        "select * from bm_wa03001_baseline_records where id=$1 for update", [baselineId]);
      const row = result.rows[0];
      if (!row || !canActForOrganization(auth, row.organization_id)) { await client.query("rollback"); return reply.code(404).send({ error: "Baseline record not found in authorized organization", code: "BASELINE_NOT_FOUND" }); }
      if (!await hasOrganizationPermission(client, auth, row.organization_id, ["projects:verify", "VERIFY_EVIDENCE"])) { await client.query("rollback"); return reply.code(403).send({ error: "Independent verification permission required", code: "BASELINE_APPROVAL_FORBIDDEN" }); }
      if (row.status !== "SUBMITTED") { await client.query("rollback"); return reply.code(409).send({ error: "Only a SUBMITTED baseline can receive a decision", code: "BASELINE_ALREADY_DECIDED" }); }
      if (row.submitted_by_identity_id === auth.identityId) { await client.query("rollback"); return reply.code(403).send({ error: "Baseline submitter cannot approve or reject their own record", code: "BASELINE_SEPARATION_OF_DUTIES" }); }
      if (!await evidenceIsVerifiedForActivity(client, row.activity_id, row.evidence_ids)) { await client.query("rollback"); return reply.code(409).send({ error: "Baseline evidence is no longer fully verified with a valid SHA-256 content hash for this activity", code: "BASELINE_EVIDENCE_NOT_VERIFIED" }); }
      const core = { activityId: row.activity_id, organizationId: row.organization_id, methodologyCode: row.methodology_code, methodologyVersion: row.methodology_version, baselineFch4Tch4: Number(row.baseline_fch4_tch4), baselinePeriod: row.baseline_period, evidenceIds: [...row.evidence_ids].sort(), submittedByIdentityId: row.submitted_by_identity_id };
      if (hash(core) !== row.record_sha256) { await client.query("rollback"); return reply.code(409).send({ error: "Baseline record integrity hash mismatch", code: "BASELINE_HASH_MISMATCH" }); }
      const updated = await client.query(
        "update bm_wa03001_baseline_records set status=$2,approved_by_identity_id=$3,approved_at=now(),approval_note=$4 where id=$1 returning id,status,approved_by_identity_id,approved_at,approval_note,record_sha256",
        [baselineId, decision, auth.identityId, note]);
      await client.query("commit");
      return { source: "postgresql", syntheticData: false, baselineDecision: updated.rows[0], note: "Decision is an internal evidence workflow outcome, not a BEE/BEE registry approval or carbon-credit issuance." };
    } catch (error) { await client.query("rollback").catch(() => undefined); request.log.error(error); return reply.code(503).send({ error: "Baseline decision unavailable", code: "BASELINE_DECISION_UNAVAILABLE", syntheticData: false }); }
    finally { client.release(); }
  });
}
