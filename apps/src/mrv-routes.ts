import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { executeGuardianMrv, guardianStatus } from "./guardian-mrv.js";
import { hederaStatus, submitHcsAnchor, verifyHcsMessage } from "./hedera-anchor.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void } };
const bodyOf = (r: Request): Record<string, unknown> => r.body && typeof r.body === "object" ? r.body as Record<string, unknown> : {};
const str = (b: Record<string, unknown>, k: string): string | null => typeof b[k] === "string" && b[k].trim() ? b[k].trim() : null;

async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" }); return null; }
  try { const auth = await authenticate(request as never, pool); if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; } return auth; }
  catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); return null; }
}

async function requirePermission(pool: Pool, auth: AuthContext, organizationId: string, permissions: readonly string[]): Promise<boolean> {
  return hasOrganizationPermission(pool, auth, organizationId, permissions);
}

async function activityInAuthorizedGeography(pool: Pool, auth: AuthContext, activityId: string, organizationId: string): Promise<boolean> {
  const result = await pool.query<{ ok: boolean }>(
    `select exists(
       select 1 from activities a
       where a.id=$1 and a.organization_id=$2 and a.geography_id is not null
         and organization_has_geography_scope(a.organization_id,a.geography_id)
     ) as ok`,
    [activityId, organizationId],
  );
  if (result.rows[0]?.ok !== true) return false;
  const membership = await pool.query<{ ok: boolean }>(
    `select exists(
       select 1 from organization_memberships om
       join activities a on a.organization_id=om.organization_id
       where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED'
         and a.id=$3 and a.geography_id is not null
         and organization_has_geography_scope(om.organization_id,a.geography_id)
     ) as ok`,
    [auth.identityId, organizationId, activityId],
  );
  return membership.rows[0]?.ok === true;
}

export async function registerMrvRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/mrv/status", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const organizationId = auth.activeOrganizationId || auth.memberships[0]?.organization_id;
    if (!organizationId || !await requirePermission(pool, auth, organizationId, ["guardian:read"])) return reply.code(403).send({ error: "Guardian read permission required", code: "MRV_PERMISSION_REQUIRED" });
    const guardian = guardianStatus();
    const hedera = hederaStatus();
    return {
      source: "runtime",
      syntheticData: false,
      guardian,
      hedera,
      registryEligibility: "REQUIRES_GUARDIAN_VERIFIED_AND_HCS_CONSENSUS_CONFIRMED_PROVENANCE",
    };
  });

  app.post("/api/v1/mrv/activities/:activityId/submit", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const activityId = (request.params as { activityId: string }).activityId;
    const body = bodyOf(request as never);
    const verificationId = str(body, "verificationId");
    const evidenceId = str(body, "evidenceId");
    const policyId = str(body, "guardianPolicyId") || process.env.GUARDIAN_MRV_POLICY_ID || null;
    const methodologyCode = str(body, "methodologyCode") || undefined;
    if (!verificationId || !evidenceId || !policyId) return reply.code(400).send({ error: "verificationId, evidenceId and guardianPolicyId (or GUARDIAN_MRV_POLICY_ID) are required" });
    try {
      const context = await pool.query<{ organization_id: string; activity_status: string; decision: string; evidence_status: string; evidence_activity_id: string | null; evidence_count: string; observation_count: string }>(
        `select a.organization_id, a.status activity_status, v.decision, e.status evidence_status, e.activity_id evidence_activity_id,
                (select count(*)::text from evidence e2 where e2.activity_id=a.id) evidence_count,
                (select count(*)::text from mrv_observations mo where mo.activity_id=a.id) observation_count
           from activities a join verifications v on v.id=$2 and v.activity_id=a.id join evidence e on e.id=$3 and e.activity_id=a.id where a.id=$1`,
        [activityId, verificationId, evidenceId]);
      const row = context.rows[0];
      if (!row) return reply.code(409).send({ error: "Activity, verification and evidence must be bound to the same activity", code: "MRV_BINDING_INVALID" });
      if (!canActForOrganization(auth, row.organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await requirePermission(pool, auth, row.organization_id, ["guardian:operate"])) return reply.code(403).send({ error: "Guardian MRV operation permission required", code: "MRV_PERMISSION_REQUIRED" });
      if (!await activityInAuthorizedGeography(pool, auth, activityId, row.organization_id)) return reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
      if (row.activity_status !== "COMPLETED" || row.decision !== "APPROVED" || row.evidence_status !== "VERIFIED" || row.evidence_activity_id !== activityId) return reply.code(409).send({ error: "Completed activity, approved verification and VERIFIED evidence are required before Guardian MRV", code: "MRV_PRECONDITION_FAILED" });

      const observations = await pool.query("select id, parameter_code, observed_value, unit, method, instrument_id, observed_at, uncertainty, quality_status, metadata from mrv_observations where activity_id=$1 order by observed_at", [activityId]);
      const evidence = await pool.query("select id, evidence_type, content_uri, content_hash, captured_at, status, metadata from evidence where activity_id=$1 order by captured_at", [activityId]);
      const guardian = await executeGuardianMrv({ activityId, verificationId, evidenceId, policyId, methodologyCode, observations: observations.rows, evidence: evidence.rows, metadata: { evidenceCount: Number(row.evidence_count), observationCount: Number(row.observation_count) } });
      if (guardian.status !== "VERIFIED" || !guardian.executionId) return reply.code(503).send({ source: "guardian", syntheticData: false, guardian, eligibleForRegistry: false });

      const quantityRow = await pool.query<{ value: string | null; unit: string | null }>("select value::text value, unit from measurements where activity_id=$1 order by measured_at desc limit 1", [activityId]);
      const quantity = quantityRow.rows[0]?.value ? Number(quantityRow.rows[0].value) : undefined;
      const unit = quantityRow.rows[0]?.unit || undefined;
      const anchor = await submitHcsAnchor({ schema: "rupaykg:mrv:v1", activityId, verificationId, evidenceId, guardianPolicyId: policyId, guardianExecutionId: guardian.executionId, mrvStatus: "VERIFIED", methodologyCode, quantity, unit, metadata: { guardianStatus: guardian.status } });
      const persisted = await pool.query(`insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,methodology_code,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict(activity_id,verification_id,integrity_hash) do update set guardian_execution_id=excluded.guardian_execution_id,guardian_status=excluded.guardian_status,hcs_status=excluded.hcs_status,hcs_transaction_id=excluded.hcs_transaction_id,hcs_consensus_timestamp=excluded.hcs_consensus_timestamp,metadata=excluded.metadata returning *`, [activityId, verificationId, evidenceId, policyId, guardian.executionId, guardian.status, anchor.status, anchor.topicId || null, anchor.transactionId, anchor.consensusTimestamp, anchor.integrityHash, methodologyCode || null, JSON.stringify({ guardian: guardian.raw ?? null })]);
      return reply.code(anchor.status === "CONSENSUS_CONFIRMED" ? 201 : 503).send({ source: "postgresql+guardian+hedera", syntheticData: false, guardian, hedera: anchor, provenance: persisted.rows[0], eligibleForRegistry: anchor.status === "CONSENSUS_CONFIRMED" });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authoritative MRV submission unavailable", code: "MRV_UNAVAILABLE", syntheticData: false }); }
  });

  app.get("/api/v1/mrv/provenance/:activityId", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const activityId = (request.params as { activityId: string }).activityId;
    try {
      const owner = await pool.query<{ organization_id: string }>("select organization_id from activities where id=$1", [activityId]);
      if (!owner.rows[0] || !canActForOrganization(auth, owner.rows[0].organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await requirePermission(pool, auth, owner.rows[0].organization_id, ["guardian:read"])) return reply.code(403).send({ error: "Guardian read permission required", code: "MRV_PERMISSION_REQUIRED" });
      if (!await activityInAuthorizedGeography(pool, auth, activityId, owner.rows[0].organization_id)) return reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
      const rows = await pool.query("select * from mrv_provenance_events where activity_id=$1 order by created_at desc", [activityId]);
      return { source: "postgresql", syntheticData: false, eligibleForRegistry: rows.rows.some(r => r.guardian_status === "VERIFIED" && r.hcs_status === "CONSENSUS_CONFIRMED"), provenance: rows.rows };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "MRV provenance unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/mrv/hedera/verify/:consensusTimestamp", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const timestamp = (request.params as { consensusTimestamp: string }).consensusTimestamp;
    try {
      const provenance = await pool.query<{ activity_id: string; verification_id: string; evidence_id: string; guardian_execution_id: string; integrity_hash: string; hcs_topic_id: string | null }>(
        "select activity_id, verification_id, evidence_id, guardian_execution_id, integrity_hash, hcs_topic_id from mrv_provenance_events where hcs_consensus_timestamp=$1 order by created_at desc limit 1",
        [timestamp],
      );
      const row = provenance.rows[0];
      if (!row) return reply.code(404).send({ error: "No persisted MRV provenance is bound to this Hedera consensus timestamp", code: "HCS_PROVENANCE_NOT_FOUND" });
      if (!row.hcs_topic_id || row.hcs_topic_id !== (process.env.HEDERA_TOPIC_ID || "")) return reply.code(409).send({ error: "Persisted MRV provenance topic does not match the configured Hedera topic", code: "HCS_TOPIC_MISMATCH" });
      const owner = await pool.query<{ organization_id: string }>("select organization_id from activities where id=$1", [row.activity_id]);
      if (!owner.rows[0] || !canActForOrganization(auth, owner.rows[0].organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await requirePermission(pool, auth, owner.rows[0].organization_id, ["guardian:read"])) return reply.code(403).send({ error: "Guardian read permission required", code: "MRV_PERMISSION_REQUIRED" });
      if (!await activityInAuthorizedGeography(pool, auth, row.activity_id, owner.rows[0].organization_id)) return reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
      return { source: "hedera-mirror-node", syntheticData: false, ...(await verifyHcsMessage(timestamp, row.hcs_topic_id, row.integrity_hash, row.activity_id, row.verification_id, row.evidence_id, row.guardian_execution_id)) };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Hedera mirror-node verification unavailable", code: "HCS_VERIFY_UNAVAILABLE", syntheticData: false }); }
  });
}