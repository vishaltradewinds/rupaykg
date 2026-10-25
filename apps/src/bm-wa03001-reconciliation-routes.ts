import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import {
  BM_WA03001_GWP_CH4_TCO2E_PER_TCH4,
  calculateBmWa03001,
  calculateBmWa03001ProjectMethaneFromFlow,
  sha256Canonical,
  type BmWa03001FlowPeriod,
} from "@rupaykg/carbon";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bodyOf = (r: Request): Record<string, unknown> => r.body && typeof r.body === "object" ? r.body as Record<string, unknown> : {};
const str = (b: Record<string, unknown>, k: string, max = 200): string | null => typeof b[k] === "string" && b[k].trim() && b[k].trim().length <= max ? b[k].trim() : null;

async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try {
    const auth = await authenticate(request as never, pool);
    if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; }
    return auth;
  } catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication unavailable", code: "AUTH_UNAVAILABLE" }); return null; }
}

export async function registerBmWa03001ReconciliationRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/mrv/activities/:activityId/bm-wa03001/reconcile", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const activityId = (request.params as { activityId: string }).activityId;
    if (!UUID.test(activityId)) return reply.code(400).send({ error: "Valid activityId required", code: "ACTIVITY_ID_INVALID" });
    const body = bodyOf(request as never);
    const baselineId = str(body, "baselineId");
    const monitoringPeriodId = str(body, "monitoringPeriodId", 120);
    const periods = body.periods;
    const projectEmissionsTco2e = body.projectEmissionsTco2e;
    const leakageTco2e = body.leakageTco2e;
    const oxidationFactor = body.oxidationFactor;
    const evidenceIds = body.evidenceIds;
    if (!baselineId || !UUID.test(baselineId) || !monitoringPeriodId || !Array.isArray(periods) || periods.length < 1 || periods.length > 500 || periods.some(period => !period || typeof period !== "object" || Array.isArray(period)) ||
      typeof projectEmissionsTco2e !== "number" || !Number.isFinite(projectEmissionsTco2e) || projectEmissionsTco2e < 0 ||
      typeof leakageTco2e !== "number" || !Number.isFinite(leakageTco2e) || leakageTco2e < 0 ||
      typeof oxidationFactor !== "number" || !Number.isFinite(oxidationFactor) || oxidationFactor < 0 || oxidationFactor > 1 ||
      !Array.isArray(evidenceIds) || evidenceIds.length < 1 || evidenceIds.length > 200 ||
      evidenceIds.some(id => typeof id !== "string" || !UUID.test(id)) || new Set(evidenceIds).size !== evidenceIds.length) {
      return reply.code(400).send({ error: "baselineId, monitoringPeriodId, measured periods, non-negative emissions/leakage, oxidationFactor in [0,1], and unique evidence UUIDs are required", code: "RECONCILIATION_INPUTS_INVALID" });
    }
    try {
      const activity = await pool.query<{ organization_id: string; geography_id: string | null }>(
        "select organization_id, geography_id from activities where id=$1", [activityId]);
      const activityRow = activity.rows[0];
      if (!activityRow || !activityRow.geography_id || !canActForOrganization(auth, activityRow.organization_id)) {
        return reply.code(403).send({ error: "Activity is outside authorized organization/geography scope", code: "ACTIVITY_FORBIDDEN" });
      }
      const scoped = await pool.query<{ ok: boolean }>(
        "select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3)) as ok",
        [auth.identityId, activityRow.organization_id, activityRow.geography_id]);
      if (scoped.rows[0]?.ok !== true) return reply.code(403).send({ error: "Activity geography is outside verified membership scope", code: "GEOGRAPHY_FORBIDDEN" });
      if (!await hasOrganizationPermission(pool, auth, activityRow.organization_id, ["projects:manage", "waste:record"])) {
        return reply.code(403).send({ error: "Project management or waste recording permission required", code: "RECONCILIATION_FORBIDDEN" });
      }
      const client = await pool.connect();
      try {
        await client.query("begin");
        const baselineResult = await client.query<{
          id:string; organization_id:string; activity_id:string; methodology_code:string; methodology_version:string;
          baseline_fch4_tch4:string; baseline_period:string; evidence_ids:string[]; record_sha256:string;
          status:string; submitted_by_identity_id:string; approved_by_identity_id:string|null; approved_at:Date|string|null;
        }>("select * from bm_wa03001_baseline_records where id=$1 and activity_id=$2 and organization_id=$3 for share",
          [baselineId, activityId, activityRow.organization_id]);
        const baseline = baselineResult.rows[0];
        if (!baseline) { await client.query("rollback"); return reply.code(404).send({ error: "Baseline not found in activity scope", code: "BASELINE_NOT_FOUND" }); }
        if (baseline.status !== "APPROVED" || !baseline.approved_by_identity_id || !baseline.approved_at) {
          await client.query("rollback"); return reply.code(409).send({ error: "Only an independently approved baseline can be reconciled", code: "BASELINE_NOT_APPROVED" });
        }
        const baselineCore = {
          activityId: baseline.activity_id, organizationId: baseline.organization_id, methodologyCode: baseline.methodology_code,
          methodologyVersion: baseline.methodology_version, baselineFch4Tch4: Number(baseline.baseline_fch4_tch4),
          baselinePeriod: baseline.baseline_period, evidenceIds: [...baseline.evidence_ids].sort(),
          submittedByIdentityId: baseline.submitted_by_identity_id,
        };
        if (sha256Canonical(baselineCore) !== baseline.record_sha256) {
          await client.query("rollback"); return reply.code(409).send({ error: "Persisted baseline integrity hash mismatch", code: "BASELINE_HASH_MISMATCH" });
        }
        const baselineEvidenceCheck = await client.query<{ count: string }>(
          "select count(*)::text count from evidence where activity_id=$1 and id=any($2::uuid[]) and status='VERIFIED' and content_hash ~ '^[0-9a-f]{64}$'",
          [activityId, baseline.evidence_ids]);
        if (Number(baselineEvidenceCheck.rows[0]?.count ?? 0) !== baseline.evidence_ids.length) {
          await client.query("rollback"); return reply.code(409).send({ error: "Approved baseline evidence is no longer fully verified with a valid SHA-256 content hash", code: "BASELINE_EVIDENCE_NOT_VERIFIED" });
        }
        if (baseline.methodology_code !== "BM WA03.001" || baseline.methodology_version !== "1.0") {
          await client.query("rollback"); return reply.code(409).send({ error: "Unsupported methodology version", code: "METHODOLOGY_VERSION_UNSUPPORTED" });
        }
        const allEvidenceIds = new Set<string>(evidenceIds as string[]);
        for (const period of periods as BmWa03001FlowPeriod[]) {
          for (const ref of [period.flowMeasurementEvidence, period.methaneMeasurementEvidence, period.methaneDensityEvidence, period.flowMeterCalibrationEvidence, period.analyserCalibrationEvidence]) {
            if (typeof ref !== "string" || !UUID.test(ref) || !allEvidenceIds.has(ref)) {
              await client.query("rollback"); return reply.code(400).send({ error: "Every flow, composition, density and calibration evidence reference must be a UUID included in evidenceIds", code: "MONITORING_EVIDENCE_REFERENCE_INVALID" });
            }
          }
        }
        const evidenceCheck = await client.query<{ count: string }>(
          "select count(*)::text count from evidence where activity_id=$1 and id=any($2::uuid[]) and status='VERIFIED' and content_hash ~ '^[0-9a-f]{64}$'",
          [activityId, [...allEvidenceIds]]);
        if (Number(evidenceCheck.rows[0]?.count ?? 0) !== allEvidenceIds.size) {
          await client.query("rollback"); return reply.code(409).send({ error: "Every monitoring evidence item must be VERIFIED with a valid SHA-256 content hash and belong to this activity", code: "MONITORING_EVIDENCE_NOT_VERIFIED" });
        }
        const projectMethane = calculateBmWa03001ProjectMethaneFromFlow(periods as BmWa03001FlowPeriod[]);
        const reconciled = calculateBmWa03001({
          fch4ProjectTch4: projectMethane.fch4ProjectTch4,
          fch4BaselineTch4: Number(baseline.baseline_fch4_tch4),
          gwpCh4Tco2ePerTch4: BM_WA03001_GWP_CH4_TCO2E_PER_TCH4,
          projectEmissionsTco2e, leakageTco2e, oxidationFactor,
        });
        const provenance = {
          activityId, organizationId: activityRow.organization_id, baselineRecordId: baseline.id,
          baselineRecordSha256: baseline.record_sha256, baselineApprovedBy: baseline.approved_by_identity_id,
          baselineApprovedAt: new Date(baseline.approved_at).toISOString(), monitoringPeriodId,
          evidenceIds: [...new Set([...allEvidenceIds, ...baseline.evidence_ids])].sort(), baselineEvidenceIds: [...baseline.evidence_ids].sort(), projectMethane, equation4Input: {
            fch4ProjectTch4: projectMethane.fch4ProjectTch4, fch4BaselineTch4: Number(baseline.baseline_fch4_tch4),
            gwpCh4Tco2ePerTch4: BM_WA03001_GWP_CH4_TCO2E_PER_TCH4, projectEmissionsTco2e, leakageTco2e, oxidationFactor,
          }, equation4Result: reconciled,
        };
        const provenanceSha256 = sha256Canonical(provenance);
        const inserted = await client.query(
          `insert into bm_wa03001_reconciliations
           (organization_id,activity_id,baseline_record_id,monitoring_period_id,equation5_result,equation4_input,equation4_result_tco2e,evidence_ids,provenance_sha256,created_by_identity_id)
           values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::uuid[],$9,$10)
           returning id,organization_id,activity_id,baseline_record_id,monitoring_period_id,equation5_result,equation4_input,equation4_result_tco2e,evidence_ids,provenance_sha256,status,created_by_identity_id,created_at`,
          [activityRow.organization_id, activityId, baselineId, monitoringPeriodId, JSON.stringify(projectMethane),
            JSON.stringify(provenance.equation4Input), reconciled.resultTco2e, [...new Set([...allEvidenceIds, ...baseline.evidence_ids])], provenanceSha256, auth.identityId]);
        await client.query("commit");
        return reply.code(201).send({ source: "postgresql", syntheticData: false, reconciliation: inserted.rows[0],
          note: "Method-specific calculation persisted for independent verification only. It is not a verified reduction, registry approval, or issued Carbon Credit Certificate." });
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        if ((error as { code?: string }).code === "23505") return reply.code(409).send({ error: "A reconciliation already exists for this activity and monitoring period", code: "RECONCILIATION_PERIOD_EXISTS" });
        throw error;
      } finally { client.release(); }
    } catch (error) {
      if (error instanceof Error && /period|methane|oxidationFactor|must be|basis|evidence|finite|density/i.test(error.message)) {
        return reply.code(400).send({ error: error.message, code: "RECONCILIATION_CALCULATION_INVALID" });
      }
      request.log.error(error); return reply.code(503).send({ error: "BM WA03.001 reconciliation unavailable", code: "RECONCILIATION_UNAVAILABLE", syntheticData: false });
    }
  });
}
