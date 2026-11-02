import type { Pool, PoolClient } from "pg";
import { executeGuardianMrv } from "./guardian-mrv.js";
import {
  createHcsTransactionId,
  hederaStatus,
  integrityHash,
  reconcileHcsTransaction,
  submitHcsAnchor,
  type AnchorPayload,
} from "./hedera-anchor.js";
import {
  advanceMrvSubmissionJob,
  claimNextMrvSubmissionJob,
  isMrvSubmissionJobStillAuthorized,
  persistMrvGuardianIdempotencyKey,
  persistMrvHcsTransactionId,
  releaseMrvSubmissionJobLease,
  type MrvJobLease,
  type MrvSubmissionJob,
} from "./mrv-submission-jobs.js";

export interface MrvWorkerResult {
  outcome: "IDLE" | "STAGE_ADVANCED" | "RETRY_SCHEDULED" | "REJECTED" | "NEEDS_RECONCILIATION" | "STALE_LEASE";
  jobId?: string;
  stage?: string;
}

type Snapshot = {
  observations?: unknown[];
  evidence?: unknown[];
  quantity?: number;
  unit?: string;
  metadata?: Record<string, unknown>;
};

function snapshotOf(job: MrvSubmissionJob): Snapshot {
  return job.payload_snapshot as Snapshot;
}

function anchorPayload(job: MrvSubmissionJob): AnchorPayload {
  if (!job.guardian_execution_id) throw new Error("MRV_GUARDIAN_EXECUTION_ID_MISSING");
  const snapshot = snapshotOf(job);
  return {
    schema: "rupaykg:mrv:v1",
    activityId: job.activity_id,
    verificationId: job.verification_id,
    evidenceId: job.evidence_id,
    guardianPolicyId: job.guardian_policy_id,
    guardianExecutionId: job.guardian_execution_id,
    mrvStatus: "VERIFIED",
    ...(job.methodology_code ? { methodologyCode: job.methodology_code } : {}),
    ...(typeof snapshot.quantity === "number" ? { quantity: snapshot.quantity } : {}),
    ...(snapshot.unit ? { unit: snapshot.unit } : {}),
    metadata: { guardianStatus: "VERIFIED", ...snapshot.metadata },
  };
}

async function withClient<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { return await work(client); } finally { client.release(); }
}

async function authorize(pool: Pool, lease: MrvJobLease): Promise<boolean> {
  return withClient(pool, async client => {
    await client.query("begin");
    try {
      const allowed = await isMrvSubmissionJobStillAuthorized(client, lease.job.id);
      await client.query("commit");
      return allowed;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
}

async function advance(pool: Pool, lease: MrvJobLease, status: Parameters<typeof advanceMrvSubmissionJob>[3], patch: Parameters<typeof advanceMrvSubmissionJob>[4] = {}): Promise<boolean> {
  return withClient(pool, async client => {
    await client.query("begin");
    try {
      const result = await advanceMrvSubmissionJob(client, lease.job.id, lease.leaseToken, status, patch);
      await client.query(result ? "commit" : "rollback");
      return Boolean(result);
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
}

async function release(pool: Pool, lease: MrvJobLease, code: string, detail: string): Promise<boolean> {
  const delaySeconds = Math.min(3600, 15 * (2 ** Math.min(lease.job.attempt_count, 8)));
  return withClient(pool, async client => {
    await client.query("begin");
    try {
      const ok = await releaseMrvSubmissionJobLease(client, lease.job.id, lease.leaseToken, new Date(Date.now() + delaySeconds * 1000), code, detail);
      await client.query(ok ? "commit" : "rollback");
      return ok;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
}

async function persistGuardianKey(pool: Pool, lease: MrvJobLease, key: string): Promise<boolean> {
  return withClient(pool, async client => {
    await client.query("begin");
    try {
      const result = await persistMrvGuardianIdempotencyKey(client, lease.job.id, lease.leaseToken, key);
      await client.query(result ? "commit" : "rollback");
      return Boolean(result);
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
}

async function persistHcsId(pool: Pool, lease: MrvJobLease, network: "testnet" | "previewnet" | "mainnet", topicId: string, txId: string): Promise<boolean> {
  return withClient(pool, async client => {
    await client.query("begin");
    try {
      const result = await persistMrvHcsTransactionId(client, lease.job.id, lease.leaseToken, network, topicId, txId);
      await client.query(result ? "commit" : "rollback");
      return Boolean(result);
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
}

/**
 * Executes at most one durable stage. It never holds a DB transaction open
 * during Guardian, Hedera or Mirror Node calls. Invoke from a separately
 * deployed least-privilege worker only after migrations and RLS are approved.
 */
export async function runMrvSubmissionWorkerOnce(pool: Pool, workerId: string): Promise<MrvWorkerResult> {
  if (process.env.RUPAYKG_MRV_WORKER_ENABLED !== "true") throw new Error("MRV_WORKER_DISABLED");
  const lease = await withClient(pool, async client => {
    await client.query("begin");
    try {
      const claimed = await claimNextMrvSubmissionJob(client, workerId, 120);
      await client.query("commit");
      return claimed;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    }
  });
  if (!lease) return { outcome: "IDLE" };

  const { job } = lease;
  if (["CLAIMED", "GUARDIAN_SUBMITTED"].includes(job.status)) {
    if (!await authorize(pool, lease)) {
      const ok = await advance(pool, lease, "PERMANENT_FAILURE", { last_error_code: "MRV_AUTHORIZATION_REVOKED", last_error_detail: "Current identity, membership, role permission, evidence, verification or geography check failed before Guardian submission." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "GUARDIAN_AUTHORIZATION" };
    }
    const snapshot = snapshotOf(job);
    const key = job.guardian_idempotency_key ?? job.idempotency_key;
    if (!job.guardian_idempotency_key && !await persistGuardianKey(pool, lease, key)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "GUARDIAN_KEY_PERSIST" };
    const guardian = await executeGuardianMrv({
      activityId: job.activity_id, verificationId: job.verification_id, evidenceId: job.evidence_id,
      policyId: job.guardian_policy_id, methodologyCode: job.methodology_code ?? undefined,
      observations: snapshot.observations ?? [], evidence: snapshot.evidence ?? [], metadata: snapshot.metadata,
      idempotencyKey: key,
    });
    if (guardian.status === "UNAVAILABLE" || guardian.status === "NOT_CONFIGURED") {
      const ok = await release(pool, lease, "GUARDIAN_UNAVAILABLE", guardian.message);
      return { outcome: ok ? "RETRY_SCHEDULED" : "STALE_LEASE", jobId: job.id, stage: "GUARDIAN" };
    }
    if (guardian.status === "REJECTED") {
      const ok = await advance(pool, lease, "REJECTED", { guardian_status: "REJECTED", last_error_code: "GUARDIAN_REJECTED", last_error_detail: guardian.message });
      return { outcome: ok ? "REJECTED" : "STALE_LEASE", jobId: job.id, stage: "GUARDIAN" };
    }
    const ok = await advance(pool, lease, "GUARDIAN_VERIFIED", {
      guardian_status: "VERIFIED", guardian_execution_id: guardian.executionId,
      guardian_result: { status: guardian.status, executionId: guardian.executionId, policyId: guardian.policyId, correlationId: guardian.correlationId, message: guardian.message },
      last_error_code: null, last_error_detail: null,
    });
    return { outcome: ok ? "STAGE_ADVANCED" : "STALE_LEASE", jobId: job.id, stage: "GUARDIAN_VERIFIED" };
  }

  if (job.status === "GUARDIAN_VERIFIED") {
    if (!await authorize(pool, lease)) {
      const ok = await advance(pool, lease, "PERMANENT_FAILURE", { last_error_code: "MRV_AUTHORIZATION_REVOKED", last_error_detail: "Authorization failed before Hedera submission." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "HCS_AUTHORIZATION" };
    }
    const status = hederaStatus();
    if (!status.configured || status.topicId === "NOT_CONFIGURED") {
      const ok = await release(pool, lease, "HEDERA_NOT_CONFIGURED", "Hedera operator credentials or topic are not configured.");
      return { outcome: ok ? "RETRY_SCHEDULED" : "STALE_LEASE", jobId: job.id, stage: "HCS_CONFIGURATION" };
    }
    const txId = createHcsTransactionId();
    if (!await persistHcsId(pool, lease, status.network, status.topicId, txId)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "HCS_TRANSACTION_ID_PERSIST" };
    const anchor = await submitHcsAnchor(anchorPayload(job), txId);
    if (anchor.status === "CONSENSUS_CONFIRMED" && anchor.transactionId === txId && anchor.consensusTimestamp) {
      const ok = await advance(pool, lease, "HCS_CONSENSUS_CONFIRMED", {
        hedera_status: "CONSENSUS_CONFIRMED", hedera_consensus_timestamp: anchor.consensusTimestamp,
        last_error_code: null, last_error_detail: null,
      });
      return { outcome: ok ? "STAGE_ADVANCED" : "STALE_LEASE", jobId: job.id, stage: "HCS_CONSENSUS_CONFIRMED" };
    }
    if (anchor.status === "FAILED") {
      const ok = await advance(pool, lease, "NEEDS_RECONCILIATION", { hedera_status: "FAILED", last_error_code: "HCS_SUBMISSION_FAILED", last_error_detail: anchor.message });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "HCS_SUBMISSION" };
    }
    const ok = await release(pool, lease, "HCS_SUBMISSION_AMBIGUOUS", anchor.message);
    return { outcome: ok ? "RETRY_SCHEDULED" : "STALE_LEASE", jobId: job.id, stage: "HCS_SUBMISSION" };
  }

  if (job.status === "HCS_SUBMITTED" || job.status === "HCS_CONSENSUS_CONFIRMED") {
    if (!await authorize(pool, lease)) {
      const ok = await advance(pool, lease, "NEEDS_RECONCILIATION", { last_error_code: "MRV_AUTHORIZATION_REVOKED", last_error_detail: "Authorization failed before Mirror Node reconciliation." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "MIRROR_AUTHORIZATION" };
    }
    if (!job.hedera_transaction_id || !job.hedera_topic_id || !job.guardian_execution_id) {
      const ok = await advance(pool, lease, "NEEDS_RECONCILIATION", { last_error_code: "HCS_BINDING_MISSING", last_error_detail: "Persisted transaction, topic or Guardian execution binding is missing." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "MIRROR_BINDING" };
    }
    const payload = anchorPayload(job);
    const mirror = await reconcileHcsTransaction(job.hedera_transaction_id, job.hedera_topic_id, integrityHash(payload), job.activity_id, job.verification_id, job.evidence_id, job.guardian_execution_id);
    if (mirror.status === "CONFIRMED") {
      const ok = await advance(pool, lease, "MIRROR_VERIFIED", {
        hedera_consensus_timestamp: mirror.consensusTimestamp,
        mirror_verified_at: new Date(), mirror_verification_digest: integrityHash(payload),
        hedera_status: "CONSENSUS_CONFIRMED", last_error_code: null, last_error_detail: null,
      });
      return { outcome: ok ? "STAGE_ADVANCED" : "STALE_LEASE", jobId: job.id, stage: "MIRROR_VERIFIED" };
    }
    if (mirror.status === "MISMATCH" || mirror.status === "FAILED") {
      const ok = await advance(pool, lease, "NEEDS_RECONCILIATION", { last_error_code: "HCS_MIRROR_MISMATCH", last_error_detail: mirror.message });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "MIRROR_RECONCILIATION" };
    }
    const ok = await release(pool, lease, "HCS_MIRROR_PENDING", mirror.message);
    return { outcome: ok ? "RETRY_SCHEDULED" : "STALE_LEASE", jobId: job.id, stage: "MIRROR_RECONCILIATION" };
  }

  return { outcome: "IDLE", jobId: job.id, stage: job.status };
}
