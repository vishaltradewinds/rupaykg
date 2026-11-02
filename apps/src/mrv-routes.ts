import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { executeGuardianMrv, guardianStatus } from "./guardian-mrv.js";
import { enqueueMrvSubmissionJob } from "./mrv-submission-jobs.js";
import { hederaStatus, integrityHash, submitHcsAnchor, verifyHcsMessage } from "./hedera-anchor.js";
import { registerStatutoryRoutes } from "./statutory-routes.js";
import { withRlsRequestTransaction, type RlsRequestContextConfig } from "./rls-request-transaction.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void } };
type ExistingProvenanceRow = { activity_id: string; verification_id: string; evidence_id: string; guardian_policy_id: string; guardian_execution_id: string | null; guardian_status: string; hcs_status: string; hcs_topic_id: string | null; hcs_transaction_id: string | null; hcs_consensus_timestamp: string | null; mirror_node_verified_at: Date | string | null; integrity_hash: string; [key: string]: unknown };
const bodyOf = (r: Request): Record<string, unknown> => r.body && typeof r.body === "object" ? r.body as Record<string, unknown> : {};
const str = (b: Record<string, unknown>, k: string): string | null => typeof b[k] === "string" && b[k].trim() ? b[k].trim() : null;

async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" }); return null; }
  try { const auth = await authenticate(request as never, pool); if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; } return auth; }
  catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); return null; }
}


function requestContextConfig(): RlsRequestContextConfig | null {
  const hmacSecret = process.env.RUPAYKG_REQUEST_CONTEXT_SECRET;
  const keyId = process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID;
  if (!hmacSecret || Buffer.byteLength(hmacSecret, "utf8") < 32 || !keyId || !/^[a-z0-9_-]{1,32}$/.test(keyId)) return null;
  return { hmacSecret, keyId };
}

async function requirePermission(pool: Pool | PoolClient, auth: AuthContext, organizationId: string, permissions: readonly string[]): Promise<boolean> {
  return hasOrganizationPermission(pool, auth, organizationId, permissions);
}

async function activityInAuthorizedGeography(pool: Pool | PoolClient, auth: AuthContext, activityId: string, organizationId: string): Promise<boolean> {
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

/**
 * Acceptance fixtures may exercise the real external trust rail, but they are
 * never evidence of a real carbon project and must not be presented as registry eligible.
 */
async function isAcceptanceFixture(pool: Pool | PoolClient, activityId: string): Promise<boolean> {
  const result = await pool.query<{ is_fixture: boolean }>(
    `select
       exists(select 1 from activities a where a.id=$1 and a.metadata->>'acceptanceFixture'='true')
       or exists(select 1 from evidence e where e.activity_id=$1 and e.metadata->>'acceptanceFixture'='true')
       as is_fixture`,
    [activityId],
  );
  return result.rows[0]?.is_fixture === true;
}

export async function registerMrvRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/mrv/status", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const organizationId = auth.activeOrganizationId;
    const config = requestContextConfig();
    if (!organizationId || !config) return reply.code(503).send({ error: "Signed tenant context is not configured", code: "TENANT_CONTEXT_UNAVAILABLE", syntheticData: false });
    const authorized = await withRlsRequestTransaction(pool, auth, config, async (client) => requirePermission(client, auth, organizationId, ["guardian:read"]));
    if (!authorized) return reply.code(403).send({ error: "Guardian read permission required", code: "MRV_PERMISSION_REQUIRED" });
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

  // Durable enqueue is deliberately feature-gated until the worker role, RLS
  // policies and production migration receive independent approval.
  app.get("/api/v1/mrv/jobs/:jobId", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    if (process.env.RUPAYKG_MRV_DURABLE_JOBS_ENABLED !== "true") {
      return reply.code(503).send({ error: "Durable MRV queue is not enabled on this deployment", code: "MRV_DURABLE_QUEUE_DISABLED" });
    }
    const jobId = (request.params as { jobId: string }).jobId;
    const config = requestContextConfig();
    if (!config) return reply.code(503).send({ error: "Signed tenant context is not configured", code: "TENANT_CONTEXT_UNAVAILABLE", syntheticData: false });
    try {
      return await withRlsRequestTransaction(pool, auth, config, async (client) => {
        const result = await client.query<{
          id: string; organization_id: string; activity_id: string; geography_id: string;
          status: string; attempt_count: number; next_attempt_at: Date; guardian_status: string | null;
          guardian_execution_id: string | null; hedera_status: string | null; hedera_topic_id: string | null;
          hedera_transaction_id: string | null; hedera_consensus_timestamp: string | null;
          mirror_verified_at: Date | null; last_error_code: string | null;
          created_at: Date; updated_at: Date; completed_at: Date | null;
        }>(
          `select j.id,j.organization_id,j.activity_id,j.geography_id,j.status,j.attempt_count,
                  j.next_attempt_at,j.guardian_status,j.guardian_execution_id,j.hedera_status,
                  j.hedera_topic_id,j.hedera_transaction_id,j.hedera_consensus_timestamp,
                  j.mirror_verified_at,j.last_error_code,j.created_at,j.updated_at,j.completed_at
             from mrv_submission_jobs j where j.id=$1`, [jobId]);
        const job = result.rows[0];
        if (!job) return reply.code(404).send({ error: "MRV job not found", code: "MRV_JOB_NOT_FOUND" });
        if (job.organization_id !== auth.activeOrganizationId || !canActForOrganization(auth, job.organization_id)
            || !await requirePermission(client, auth, job.organization_id, ["guardian:read"])
            || !await activityInAuthorizedGeography(client, auth, job.activity_id, job.organization_id)) {
          return reply.code(403).send({ error: "MRV job access denied", code: "MRV_JOB_FORBIDDEN" });
        }
        const events = await client.query<{
          from_status: string | null; to_status: string; actor_kind: string; event_code: string; created_at: Date;
        }>("select from_status,to_status,actor_kind,event_code,created_at from mrv_submission_job_events where job_id=$1 order by created_at,id", [jobId]);
        return {
          source: "postgresql", syntheticData: false,
          job: {
            id: job.id, activityId: job.activity_id, status: job.status, attemptCount: job.attempt_count,
            nextAttemptAt: job.next_attempt_at, guardianStatus: job.guardian_status,
            guardianExecutionId: job.guardian_execution_id, hederaStatus: job.hedera_status,
            hederaTopicId: job.hedera_topic_id, hederaTransactionId: job.hedera_transaction_id,
            hederaConsensusTimestamp: job.hedera_consensus_timestamp, mirrorVerifiedAt: job.mirror_verified_at,
            lastErrorCode: job.last_error_code, createdAt: job.created_at, updatedAt: job.updated_at,
            completedAt: job.completed_at,
          },
          events: events.rows.map(event => ({ fromStatus: event.from_status, toStatus: event.to_status,
            actorKind: event.actor_kind, eventCode: event.event_code, createdAt: event.created_at })),
        };
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "MRV job status unavailable", code: "MRV_JOB_STATUS_UNAVAILABLE", syntheticData: false });
    }
  });

  app.post("/api/v1/mrv/activities/:activityId/jobs", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    if (process.env.RUPAYKG_MRV_DURABLE_JOBS_ENABLED !== "true") {
      return reply.code(503).send({ error: "Durable MRV queue is not enabled on this deployment", code: "MRV_DURABLE_QUEUE_DISABLED" });
    }
    const activityId = (request.params as { activityId: string }).activityId;
    const body = bodyOf(request as never);
    const verificationId = str(body, "verificationId");
    const evidenceId = str(body, "evidenceId");
    const policyId = str(body, "guardianPolicyId") || process.env.GUARDIAN_MRV_POLICY_ID || null;
    const methodologyCode = str(body, "methodologyCode");
    if (!verificationId || !evidenceId || !policyId) {
      return reply.code(400).send({ error: "verificationId, evidenceId and guardianPolicyId (or GUARDIAN_MRV_POLICY_ID) are required" });
    }

    const config = requestContextConfig();
    if (!config) return reply.code(503).send({ error: "Signed tenant context is not configured", code: "TENANT_CONTEXT_UNAVAILABLE", syntheticData: false });
    try {
      return await withRlsRequestTransaction(pool, auth, config, async (client) => {
        const binding = await client.query<{
          organization_id: string; geography_id: string | null; activity_status: string;
          actor_identity_id: string; verification_decision: string; verifier_identity_id: string;
          evidence_status: string; evidence_activity_id: string; organization_status: string;
        }>(
          `select a.organization_id, a.geography_id, a.status activity_status, a.actor_identity_id,
                  v.decision verification_decision, v.verifier_identity_id,
                  e.status evidence_status, e.activity_id evidence_activity_id, o.status organization_status
             from activities a
             join organizations o on o.id=a.organization_id
             join verifications v on v.id=$2 and v.activity_id=a.id
             join evidence e on e.id=$3 and e.activity_id=a.id and e.id=v.evidence_id
            where a.id=$1`,
          [activityId, verificationId, evidenceId],
        );
        const row = binding.rows[0];
        if (!row) return reply.code(409).send({ error: "Activity, evidence and verification must be bound to the same record", code: "MRV_BINDING_INVALID" });
        if (row.organization_id !== auth.activeOrganizationId || !canActForOrganization(auth, row.organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
        if (!await requirePermission(client, auth, row.organization_id, ["guardian:operate"])) return reply.code(403).send({ error: "Guardian MRV operation permission required", code: "MRV_PERMISSION_REQUIRED" });
        if (!await activityInAuthorizedGeography(client, auth, activityId, row.organization_id)) return reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
        if (!row.geography_id || row.organization_status !== "VERIFIED" || row.activity_status !== "COMPLETED"
            || row.verification_decision !== "APPROVED" || row.evidence_status !== "VERIFIED"
            || row.evidence_activity_id !== activityId || row.verifier_identity_id === row.actor_identity_id) {
          return reply.code(409).send({ error: "Verified organization, completed activity, VERIFIED evidence and independent APPROVED verification are required", code: "MRV_PRECONDITION_FAILED" });
        }

        const observations = await client.query(
          "select id, parameter_code, observed_value, unit, method, instrument_id, observed_at, uncertainty, quality_status, metadata from mrv_observations where activity_id=$1 order by observed_at, id",
          [activityId],
        );
        const evidence = await client.query(
          "select id, evidence_type, content_uri, content_hash, captured_at, status, metadata from evidence where activity_id=$1 order by captured_at, id",
          [activityId],
        );
        const quantityRow = await client.query<{ value: string | null; unit: string | null }>(
          "select value::text value, unit from measurements where activity_id=$1 order by measured_at desc limit 1",
          [activityId],
        );
        const quantity = quantityRow.rows[0]?.value ? Number(quantityRow.rows[0].value) : undefined;
        const unit = quantityRow.rows[0]?.unit || undefined;
        const job = await enqueueMrvSubmissionJob(client, {
          activityId, verificationId, evidenceId, organizationId: row.organization_id,
          geographyId: row.geography_id, requestedByIdentityId: auth.identityId,
          guardianPolicyId: policyId, methodologyCode,
          payloadSnapshot: {
            schema: "rupaykg:mrv:v1", activityId, verificationId, evidenceId,
            guardianPolicyId: policyId, methodologyCode: methodologyCode ?? null,
            observations: observations.rows, evidence: evidence.rows, quantity, unit,
            metadata: { evidenceCount: evidence.rows.length, observationCount: observations.rows.length },
          },
        });
        return reply.code(202).send({
          source: "postgresql", syntheticData: false, queued: true,
          job: { id: job.id, status: job.status, idempotencyKey: job.idempotency_key, createdAt: job.created_at },
          message: "MRV submission accepted into the durable queue; provider execution is performed by the separately gated worker.",
        });
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "Unable to enqueue authoritative MRV submission", code: "MRV_ENQUEUE_UNAVAILABLE", syntheticData: false });
    }
  });

  app.post("/api/v1/mrv/activities/:activityId/submit", async (request, reply) => {
    // The durable queue is the canonical provider execution path. Keep the
    // legacy synchronous provider path disabled unless explicitly selected
    // for a controlled non-worker environment; never run both paths together.
    if (process.env.RUPAYKG_MRV_DIRECT_SUBMIT_ENABLED !== "true"
        || process.env.RUPAYKG_MRV_WORKER_ENABLED === "true") {
      return reply.code(503).send({
        error: "Synchronous MRV submission is disabled; use the gated durable queue path.",
        code: "MRV_DIRECT_SUBMIT_DISABLED",
        syntheticData: false,
      });
    }
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const activityId = (request.params as { activityId: string }).activityId;
    const body = bodyOf(request as never);
    const verificationId = str(body, "verificationId");
    const evidenceId = str(body, "evidenceId");
    const policyId = str(body, "guardianPolicyId") || process.env.GUARDIAN_MRV_POLICY_ID || null;
    const methodologyCode = str(body, "methodologyCode") || undefined;
    if (!verificationId || !evidenceId || !policyId) return reply.code(400).send({ error: "verificationId, evidenceId and guardianPolicyId (or GUARDIAN_MRV_POLICY_ID) are required" });
    const config = requestContextConfig();
    if (!config) return reply.code(503).send({ error: "Signed tenant context is not configured", code: "TENANT_CONTEXT_UNAVAILABLE", syntheticData: false });
    let lockClient: PoolClient | null = null;
    let lockAcquired = false;
    const idempotencyLockKey = [activityId, verificationId, evidenceId, policyId, methodologyCode ?? ""].join("|");
    try {
      // Session advisory lock prevents duplicate provider submissions; no DB transaction
      // is held while Guardian or Hedera network calls execute.
      lockClient = await pool.connect();
      await lockClient.query("select pg_advisory_lock(hashtext($1))", [idempotencyLockKey]);
      lockAcquired = true;

      const prepared = await withRlsRequestTransaction(pool, auth, config, async (client) => {
        const context = await client.query<{ organization_id: string; activity_status: string; decision: string; evidence_status: string; evidence_activity_id: string | null; evidence_count: string; observation_count: string; actor_identity_id: string; verifier_identity_id: string }>(
          `select a.organization_id, a.status activity_status, a.actor_identity_id, v.decision, v.verifier_identity_id,
                  e.status evidence_status, e.activity_id evidence_activity_id,
                  (select count(*)::text from evidence e2 where e2.activity_id=a.id) evidence_count,
                  (select count(*)::text from mrv_observations mo where mo.activity_id=a.id) observation_count
             from activities a join verifications v on v.id=$2 and v.activity_id=a.id
             join evidence e on e.id=$3 and e.activity_id=a.id and e.id=v.evidence_id where a.id=$1`,
          [activityId, verificationId, evidenceId]);
        const row = context.rows[0];
        if (!row) return { response: reply.code(409).send({ error: "Activity, verification and evidence must be bound to the same activity", code: "MRV_BINDING_INVALID" }) };
        if (row.organization_id !== auth.activeOrganizationId || !canActForOrganization(auth, row.organization_id)) return { response: reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" }) };
        if (!await requirePermission(client, auth, row.organization_id, ["guardian:operate"])) return { response: reply.code(403).send({ error: "Guardian MRV operation permission required", code: "MRV_PERMISSION_REQUIRED" }) };
        if (!await activityInAuthorizedGeography(client, auth, activityId, row.organization_id)) return { response: reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" }) };
        if (row.activity_status !== "COMPLETED" || row.decision !== "APPROVED" || row.evidence_status !== "VERIFIED" || row.evidence_activity_id !== activityId || row.verifier_identity_id === row.actor_identity_id) return { response: reply.code(409).send({ error: "Completed activity, verified evidence and independent approved verification are required before Guardian MRV", code: "MRV_PRECONDITION_FAILED" }) };
        const observations = await client.query("select id, parameter_code, observed_value, unit, method, instrument_id, observed_at, uncertainty, quality_status, metadata from mrv_observations where activity_id=$1 order by observed_at, id", [activityId]);
        const evidence = await client.query("select id, evidence_type, content_uri, content_hash, captured_at, status, metadata from evidence where activity_id=$1 order by captured_at, id", [activityId]);
        const quantityRow = await client.query<{ value: string | null; unit: string | null }>("select value::text value, unit from measurements where activity_id=$1 order by measured_at desc limit 1", [activityId]);
        const quantity = quantityRow.rows[0]?.value ? Number(quantityRow.rows[0].value) : undefined;
        const unit = quantityRow.rows[0]?.unit || undefined;
        const sourceSnapshotHash = crypto.createHash("sha256").update(JSON.stringify({ activityId, verificationId, evidenceId, observations: observations.rows, evidence: evidence.rows, quantity, unit })).digest("hex");
        const prior = await client.query<ExistingProvenanceRow>(
          `select * from mrv_provenance_events where activity_id=$1 and verification_id=$2 and evidence_id=$3 and guardian_policy_id=$4
             and guardian_status='VERIFIED' and hcs_status='CONSENSUS_CONFIRMED'
             and guardian_execution_id is not null and btrim(guardian_execution_id)<>''
             and hcs_topic_id is not null and btrim(hcs_topic_id)<>''
             and hcs_transaction_id is not null and btrim(hcs_transaction_id)<>''
             and hcs_consensus_timestamp is not null and btrim(hcs_consensus_timestamp)<>'' order by created_at desc`,
          [activityId, verificationId, evidenceId, policyId]);
        const existing = prior.rows.find(record => record.guardian_execution_id && integrityHash({ schema: "rupaykg:mrv:v1", activityId, verificationId, evidenceId, guardianPolicyId: policyId, guardianExecutionId: record.guardian_execution_id, mrvStatus: "VERIFIED", methodologyCode, quantity, unit, metadata: { guardianStatus: "VERIFIED" } }) === record.integrity_hash);
        const acceptanceFixture = await isAcceptanceFixture(client, activityId);
        return { row, observations: observations.rows, evidence: evidence.rows, quantity, unit, sourceSnapshotHash, acceptanceFixture, existing };
      });
      if ("response" in prepared) return prepared.response;
      if (prepared.existing?.guardian_execution_id && prepared.existing.hcs_topic_id && prepared.existing.hcs_transaction_id && prepared.existing.hcs_consensus_timestamp) {
        const existing = prepared.existing;
        return reply.code(200).send({ source: "postgresql+guardian+hedera", syntheticData: false, replay: true,
          guardian: { status: "VERIFIED", executionId: existing.guardian_execution_id, policyId: existing.guardian_policy_id, message: "Reused persisted Guardian execution; no duplicate provider submission." },
          hedera: { status: "CONSENSUS_CONFIRMED", transactionId: existing.hcs_transaction_id, consensusTimestamp: existing.hcs_consensus_timestamp, topicId: existing.hcs_topic_id, network: hederaStatus().network, integrityHash: existing.integrity_hash, message: "Reused persisted HCS anchor; no duplicate consensus message submitted." },
          provenance: existing, eligibleForRegistry: !prepared.acceptanceFixture && Boolean(existing.mirror_node_verified_at),
          ...(prepared.acceptanceFixture ? { registryEligibilityReason: "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE" } : {}) });
      }

      const guardian = await executeGuardianMrv({ activityId, verificationId, evidenceId, policyId, methodologyCode, observations: prepared.observations, evidence: prepared.evidence, metadata: { evidenceCount: Number(prepared.row.evidence_count), observationCount: Number(prepared.row.observation_count) } });
      if (guardian.status !== "VERIFIED" || !guardian.executionId) return reply.code(503).send({ source: "guardian", syntheticData: false, guardian, eligibleForRegistry: false });
      const anchor = await submitHcsAnchor({ schema: "rupaykg:mrv:v1", activityId, verificationId, evidenceId, guardianPolicyId: policyId, guardianExecutionId: guardian.executionId, mrvStatus: "VERIFIED", methodologyCode, quantity: prepared.quantity, unit: prepared.unit, metadata: { guardianStatus: guardian.status } });

      const persisted = await withRlsRequestTransaction(pool, auth, config, async (client) => {
        const binding = await client.query<{ organization_id: string; activity_status: string; decision: string; evidence_status: string; evidence_activity_id: string | null; actor_identity_id: string; verifier_identity_id: string }>(
          "select a.organization_id,a.status activity_status,a.actor_identity_id,v.decision,v.verifier_identity_id,e.status evidence_status,e.activity_id evidence_activity_id from activities a join verifications v on v.id=$2 and v.activity_id=a.id join evidence e on e.id=$3 and e.activity_id=a.id and e.id=v.evidence_id where a.id=$1",
          [activityId, verificationId, evidenceId]);
        const row = binding.rows[0];
        if (!row || row.organization_id !== auth.activeOrganizationId || row.activity_status !== "COMPLETED" || row.decision !== "APPROVED" || row.evidence_status !== "VERIFIED" || row.evidence_activity_id !== activityId || row.verifier_identity_id === row.actor_identity_id) throw new Error("MRV_SOURCE_BINDING_CHANGED_DURING_PROVIDER_EXECUTION");
        if (!await requirePermission(client, auth, row.organization_id, ["guardian:operate"]) || !await activityInAuthorizedGeography(client, auth, activityId, row.organization_id)) throw new Error("MRV_AUTHORIZATION_CHANGED_DURING_PROVIDER_EXECUTION");
        const observationsNow = await client.query("select id, parameter_code, observed_value, unit, method, instrument_id, observed_at, uncertainty, quality_status, metadata from mrv_observations where activity_id=$1 order by observed_at, id", [activityId]);
        const evidenceNow = await client.query("select id, evidence_type, content_uri, content_hash, captured_at, status, metadata from evidence where activity_id=$1 order by captured_at, id", [activityId]);
        const quantityNow = await client.query<{ value: string | null; unit: string | null }>("select value::text value, unit from measurements where activity_id=$1 order by measured_at desc limit 1", [activityId]);
        const currentSnapshotHash = crypto.createHash("sha256").update(JSON.stringify({ activityId, verificationId, evidenceId, observations: observationsNow.rows, evidence: evidenceNow.rows, quantity: quantityNow.rows[0]?.value ? Number(quantityNow.rows[0].value) : undefined, unit: quantityNow.rows[0]?.unit || undefined })).digest("hex");
        if (currentSnapshotHash !== prepared.sourceSnapshotHash) throw new Error("MRV_SOURCE_EVIDENCE_CHANGED_DURING_PROVIDER_EXECUTION");
        return client.query(
          `insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,methodology_code,metadata)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           on conflict(activity_id,verification_id,integrity_hash) do update set guardian_execution_id=excluded.guardian_execution_id,guardian_status=excluded.guardian_status,hcs_status=excluded.hcs_status,hcs_topic_id=excluded.hcs_topic_id,hcs_transaction_id=excluded.hcs_transaction_id,hcs_consensus_timestamp=excluded.hcs_consensus_timestamp,metadata=excluded.metadata,mirror_node_verified_at=null returning *`,
          [activityId, verificationId, evidenceId, policyId, guardian.executionId, guardian.status, anchor.status, anchor.topicId || null, anchor.transactionId, anchor.consensusTimestamp, anchor.integrityHash, methodologyCode || null, JSON.stringify({ guardian: guardian.raw ?? null })]);
      });
      return reply.code(anchor.status === "CONSENSUS_CONFIRMED" ? 201 : 503).send({ source: "postgresql+guardian+hedera", syntheticData: false, guardian, hedera: anchor, provenance: persisted.rows[0], eligibleForRegistry: false });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authoritative MRV submission unavailable", code: "MRV_UNAVAILABLE", syntheticData: false }); }
    finally {
      if (lockClient) {
        if (lockAcquired) await lockClient.query("select pg_advisory_unlock(hashtext($1))", [idempotencyLockKey]).catch(() => undefined);
        lockClient.release();
      }
    }
  });

  app.get("/api/v1/mrv/provenance/:activityId", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const activityId = (request.params as { activityId: string }).activityId;
    const config = requestContextConfig();
    if (!config) return reply.code(503).send({ error: "Signed tenant context is not configured", code: "TENANT_CONTEXT_UNAVAILABLE", syntheticData: false });
    try {
      return await withRlsRequestTransaction(pool, auth, config, async (client) => {
        const owner = await client.query<{ organization_id: string }>("select organization_id from activities where id=$1", [activityId]);
        const organizationId = owner.rows[0]?.organization_id;
        if (!organizationId || organizationId !== auth.activeOrganizationId || !canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
        if (!await requirePermission(client, auth, organizationId, ["guardian:read"])) return reply.code(403).send({ error: "Guardian read permission required", code: "MRV_PERMISSION_REQUIRED" });
        if (!await activityInAuthorizedGeography(client, auth, activityId, organizationId)) return reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
        const rows = await client.query("select * from mrv_provenance_events where activity_id=$1 order by created_at desc", [activityId]);
        const acceptanceFixture = await isAcceptanceFixture(client, activityId);
        return {
          source: "postgresql", syntheticData: false,
          eligibleForRegistry: !acceptanceFixture && rows.rows.some(r => r.guardian_status === "VERIFIED" && r.hcs_status === "CONSENSUS_CONFIRMED" && r.mirror_node_verified_at != null),
          ...(acceptanceFixture ? { registryEligibilityReason: "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE" } : {}),
          provenance: rows.rows,
        };
      });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "MRV provenance unavailable", code: "MRV_PROVENANCE_UNAVAILABLE", syntheticData: false }); }
  });

  app.get("/api/v1/mrv/hedera/verify/:consensusTimestamp", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const timestamp = (request.params as { consensusTimestamp: string }).consensusTimestamp;
    const config = requestContextConfig();
    if (!config) return reply.code(503).send({ error: "Signed tenant context is not configured", code: "TENANT_CONTEXT_UNAVAILABLE", syntheticData: false });
    try {
      const target = await withRlsRequestTransaction(pool, auth, config, async (client) => {
        const provenance = await client.query<{ id: string; activity_id: string; verification_id: string; evidence_id: string; guardian_execution_id: string; integrity_hash: string; hcs_topic_id: string | null; mirror_node_verified_at: Date | null }>(
          "select id, activity_id, verification_id, evidence_id, guardian_execution_id, integrity_hash, hcs_topic_id, mirror_node_verified_at from mrv_provenance_events where hcs_consensus_timestamp=$1 order by created_at desc limit 1", [timestamp]);
        const row = provenance.rows[0];
        if (!row) return { response: reply.code(404).send({ error: "No persisted MRV provenance is bound to this Hedera consensus timestamp", code: "HCS_PROVENANCE_NOT_FOUND" }) };
        if (!row.hcs_topic_id || row.hcs_topic_id !== (process.env.HEDERA_TOPIC_ID || "")) return { response: reply.code(409).send({ error: "Persisted MRV provenance topic does not match the configured Hedera topic", code: "HCS_TOPIC_MISMATCH" }) };
        const owner = await client.query<{ organization_id: string }>("select organization_id from activities where id=$1", [row.activity_id]);
        const organizationId = owner.rows[0]?.organization_id;
        if (!organizationId || organizationId !== auth.activeOrganizationId || !canActForOrganization(auth, organizationId)) return { response: reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" }) };
        if (!await requirePermission(client, auth, organizationId, ["guardian:read"])) return { response: reply.code(403).send({ error: "Guardian read permission required", code: "MRV_PERMISSION_REQUIRED" }) };
        if (!await activityInAuthorizedGeography(client, auth, row.activity_id, organizationId)) return { response: reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" }) };
        return { row };
      });
      if ("response" in target) return target.response;
      const row = target.row;
      // External Mirror Node verification is deliberately outside the DB transaction.
      const verification = await verifyHcsMessage(timestamp, row.hcs_topic_id!, row.integrity_hash, row.activity_id, row.verification_id, row.evidence_id, row.guardian_execution_id);
      if (!verification.verified) return { source: "hedera-mirror-node", syntheticData: false, ...verification, eligibleForRegistry: false };
      return await withRlsRequestTransaction(pool, auth, config, async (client) => {
        const persisted = await client.query<{ mirror_node_verified_at: Date }>(
          "update mrv_provenance_events set mirror_node_verified_at=clock_timestamp() where id=$1 and hcs_consensus_timestamp=$2 and hcs_topic_id=$3 and integrity_hash=$4 and guardian_execution_id=$5 and guardian_status='VERIFIED' and hcs_status='CONSENSUS_CONFIRMED' returning mirror_node_verified_at",
          [row.id, timestamp, row.hcs_topic_id, row.integrity_hash, row.guardian_execution_id]);
        if (!persisted.rows[0]?.mirror_node_verified_at) return { source: "hedera-mirror-node", syntheticData: false, verified: false, eligibleForRegistry: false, error: "MRV provenance changed during Mirror Node verification; retry against the current record" };
        const acceptanceFixture = await isAcceptanceFixture(client, row.activity_id);
        return { source: "hedera-mirror-node", syntheticData: false, ...verification,
          eligibleForRegistry: !acceptanceFixture,
          ...(acceptanceFixture ? { registryEligibilityReason: "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE" } : {}),
          persistedVerificationAt: persisted.rows[0].mirror_node_verified_at };
      });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Hedera mirror-node verification unavailable", code: "HCS_VERIFY_UNAVAILABLE", syntheticData: false }); }
  });

  await registerStatutoryRoutes(app, pool);
}
