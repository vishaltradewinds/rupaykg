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
  renewMrvSubmissionJobLease,
  type MrvJobLease,
  type MrvSubmissionJob,
} from "./mrv-submission-jobs.js";

export interface MrvWorkerResult {
  outcome: "IDLE" | "STAGE_ADVANCED" | "RETRY_SCHEDULED" | "REJECTED" | "PERMANENT_FAILURE" | "NEEDS_RECONCILIATION" | "STALE_LEASE";
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

async function renewLease(pool: Pool, lease: MrvJobLease): Promise<boolean> {
  return withClient(pool, async client => {
    await client.query("begin");
    try {
      const expiry = await renewMrvSubmissionJobLease(client, lease.job.id, lease.leaseToken, 120);
      await client.query(expiry ? "commit" : "rollback");
      return Boolean(expiry);
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
      return { outcome: ok ? "PERMANENT_FAILURE" : "STALE_LEASE", jobId: job.id, stage: "GUARDIAN_AUTHORIZATION" };
    }
    const snapshot = snapshotOf(job);
    const key = job.guardian_idempotency_key ?? job.idempotency_key;
    if (!job.guardian_idempotency_key && !await persistGuardianKey(pool, lease, key)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "GUARDIAN_KEY_PERSIST" };
    if (!await renewLease(pool, lease)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "GUARDIAN_LEASE_RENEWAL" };
    const guardian = await executeGuardianMrv({
      activityId: job.activity_id, verificationId: job.verification_id, evidenceId: job.evidence_id,
      policyId: job.guardian_policy_id,
      ...(job.methodology_code ? { methodologyCode: job.methodology_code } : {}),
      observations: snapshot.observations ?? [], evidence: snapshot.evidence ?? [],
      ...(snapshot.metadata ? { metadata: snapshot.metadata } : {}),
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
      return { outcome: ok ? "PERMANENT_FAILURE" : "STALE_LEASE", jobId: job.id, stage: "HCS_AUTHORIZATION" };
    }
    const status = hederaStatus();
    if (!status.configured || status.topicId === "NOT_CONFIGURED") {
      const ok = await release(pool, lease, "HEDERA_NOT_CONFIGURED", "Hedera operator credentials or topic are not configured.");
      return { outcome: ok ? "RETRY_SCHEDULED" : "STALE_LEASE", jobId: job.id, stage: "HCS_CONFIGURATION" };
    }
    const txId = createHcsTransactionId();
    if (!await persistHcsId(pool, lease, status.network, status.topicId, txId)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "HCS_TRANSACTION_ID_PERSIST" };
    if (!await renewLease(pool, lease)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "HCS_LEASE_RENEWAL" };
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
    if (!await renewLease(pool, lease)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "MIRROR_LEASE_RENEWAL" };
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

  if (job.status === "MIRROR_VERIFIED") {
    if (!await authorize(pool, lease)) {
      const ok = await advance(pool, lease, "NEEDS_RECONCILIATION", { last_error_code: "MRV_AUTHORIZATION_REVOKED", last_error_detail: "Authorization failed before final provenance persistence." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "PROVENANCE_AUTHORIZATION" };
    }
    if (!job.guardian_execution_id || !job.hedera_topic_id || !job.hedera_transaction_id || !job.hedera_consensus_timestamp || !job.mirror_verification_digest || !job.mirror_verified_at) {
      const ok = await advance(pool, lease, "NEEDS_RECONCILIATION", { last_error_code: "MRV_FINALIZATION_BINDING_MISSING", last_error_detail: "Guardian, HCS and Mirror verification bindings must all be persisted before provenance finalization." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "PROVENANCE_BINDING" };
    }
    const payload = anchorPayload(job);
    const digest = integrityHash(payload);
    if (digest !== job.mirror_verification_digest) {
      const ok = await advance(pool, lease, "NEEDS_RECONCILIATION", { last_error_code: "MRV_FINALIZATION_DIGEST_MISMATCH", last_error_detail: "Persisted Mirror verification digest no longer matches the immutable job payload." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "PROVENANCE_DIGEST" };
    }
    const finalized = await withClient(pool, async client => {
      await client.query("begin");
      try {
        const current = await client.query<{ id: string }>(
          "select id from mrv_submission_jobs where id=$1 and lease_token=$2::uuid and lease_expires_at>now() and status='MIRROR_VERIFIED' for update",
          [job.id, lease.leaseToken],
        );
        if (!current.rows[0] || !await isMrvSubmissionJobStillAuthorized(client, job.id)) {
          await client.query("rollback");
          return false;
        }
        const inserted = await client.query<{ id: string }>(
          "insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,methodology_code,metadata,mirror_node_verified_at) " +
          "values($1,$2,$3,$4,$5,'VERIFIED','CONSENSUS_CONFIRMED',$6,$7,$8,$9,$10,$11::jsonb,$12) " +
          "on conflict(activity_id,verification_id,integrity_hash) do nothing returning id",
          [job.activity_id,job.verification_id,job.evidence_id,job.guardian_policy_id,job.guardian_execution_id,
           job.hedera_topic_id,job.hedera_transaction_id,job.hedera_consensus_timestamp,digest,
           job.methodology_code,JSON.stringify({ durableJobId: job.id, mirrorVerifiedAt: job.mirror_verified_at, mirrorVerificationDigest: digest, guardian: job.guardian_result }),job.mirror_verified_at],
        );
        if (!inserted.rows[0]) {
          const existing = await client.query<{ id: string; evidence_id: string; guardian_execution_id: string | null; hcs_transaction_id: string | null; mirror_node_verified_at: Date | null }>(
            "select id,evidence_id,guardian_execution_id,hcs_transaction_id,mirror_node_verified_at from mrv_provenance_events where activity_id=$1 and verification_id=$2 and integrity_hash=$3 for update",
            [job.activity_id,job.verification_id,digest],
          );
          const row = existing.rows[0];
          if (!row || row.evidence_id !== job.evidence_id || row.guardian_execution_id !== job.guardian_execution_id
              || row.hcs_transaction_id !== job.hedera_transaction_id || !row.mirror_node_verified_at) {
            throw new Error("MRV_PROVENANCE_IDEMPOTENCY_CONFLICT");
          }
        }
        const persisted = await client.query(
          "update mrv_submission_jobs set status='PROVENANCE_PERSISTED' where id=$1 and lease_token=$2::uuid and lease_expires_at>now() and status='MIRROR_VERIFIED'",
          [job.id,lease.leaseToken],
        );
        if (persisted.rowCount !== 1) throw new Error("MRV_JOB_LEASE_LOST_DURING_FINALIZATION");
        const completed = await client.query(
          "update mrv_submission_jobs set status='COMPLETED',completed_at=now(),lease_owner=null,lease_token=null,lease_expires_at=null,last_error_code=null,last_error_detail=null where id=$1 and lease_token=$2::uuid and lease_expires_at>now() and status='PROVENANCE_PERSISTED'",
          [job.id,lease.leaseToken],
        );
        if (completed.rowCount !== 1) throw new Error("MRV_JOB_COMPLETION_FENCE_FAILED");
        await client.query("commit");
        return true;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      }
    });
    return { outcome: finalized ? "STAGE_ADVANCED" : "STALE_LEASE", jobId: job.id, stage: finalized ? "COMPLETED" : "PROVENANCE_FINALIZATION" };
  }

  return { outcome: "IDLE", jobId: job.id, stage: job.status };
}
