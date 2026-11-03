import { executeGuardianMrv } from "./guardian-mrv.js";
import {
  createHcsTransactionId,
  hederaStatus,
  integrityHash,
  reconcileHcsTransaction,
  submitHcsAnchor,
  type AnchorPayload,
} from "./hedera-anchor.js";
import type { MrvJobLease, MrvJobStagePatch, MrvJobStatus, MrvSubmissionJob } from "./mrv-submission-jobs.js";
import { MrvWorkerDatabaseApi } from "./mrv-worker-database-api.js";

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

async function authorize(database: MrvWorkerDatabaseApi, lease: MrvJobLease): Promise<boolean> {
  return database.authorize(lease.job.id);
}

async function advance(database: MrvWorkerDatabaseApi, lease: MrvJobLease, status: MrvJobStatus, patch: MrvJobStagePatch = {}): Promise<boolean> {
  return database.advance(lease.job.id, lease.leaseToken, status, patch);
}

async function release(database: MrvWorkerDatabaseApi, lease: MrvJobLease, code: string, detail: string): Promise<boolean> {
  const delaySeconds = Math.min(3600, 15 * (2 ** Math.min(lease.job.attempt_count, 8)));
  return database.release(lease.job.id, lease.leaseToken, new Date(Date.now() + delaySeconds * 1000), code, detail);
}

async function renewLease(database: MrvWorkerDatabaseApi, lease: MrvJobLease): Promise<boolean> {
  return database.renew(lease.job.id, lease.leaseToken, 120);
}

/**
 * Keep the lease alive while a provider call runs outside a DB transaction.
 * If renewal fails, the provider result is deliberately not persisted under
 * a lease we no longer own; the next owner must reconcile using the same
 * persisted provider idempotency/transaction binding.
 */
async function withLeaseHeartbeat<T>(
  database: MrvWorkerDatabaseApi,
  lease: MrvJobLease,
  operation: () => Promise<T>,
): Promise<{ value: T; leaseValid: boolean }> {
  let leaseValid = true;
  let renewing = false;
  let renewal: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (renewing || !leaseValid) return;
    renewing = true;
    renewal = renewLease(database, lease)
      .then(ok => { if (!ok) leaseValid = false; })
      .catch(() => { leaseValid = false; })
      .finally(() => { renewing = false; });
  }, 30_000);
  try {
    const value = await operation();
    clearInterval(timer);
    if (renewal) await renewal;
    return { value, leaseValid };
  } catch (error) {
    clearInterval(timer);
    if (renewal) await renewal;
    throw error;
  }
}

async function persistGuardianKey(database: MrvWorkerDatabaseApi, lease: MrvJobLease, key: string): Promise<boolean> {
  return database.persistGuardian(lease.job.id, lease.leaseToken, key);
}

async function persistHcsId(database: MrvWorkerDatabaseApi, lease: MrvJobLease, network: "testnet" | "previewnet" | "mainnet", topicId: string, txId: string): Promise<boolean> {
  return database.persistHedera(lease.job.id, lease.leaseToken, network, topicId, txId);
}

/**
 * Executes at most one durable stage. It never holds a DB transaction open
 * during Guardian, Hedera or Mirror Node calls. Invoke from a separately
 * deployed least-privilege worker only after migrations and RLS are approved.
 */
export async function runMrvSubmissionWorkerOnce(database: MrvWorkerDatabaseApi, workerId: string): Promise<MrvWorkerResult> {
  if (process.env.RUPAYKG_MRV_WORKER_ENABLED !== "true") throw new Error("MRV_WORKER_DISABLED");
  const lease = await database.claim(workerId, 120);
  if (!lease) return { outcome: "IDLE" };

  const { job } = lease;
  if (["CLAIMED", "GUARDIAN_SUBMITTED"].includes(job.status)) {
    if (!await authorize(database, lease)) {
      const ok = await advance(database, lease, "PERMANENT_FAILURE", { last_error_code: "MRV_AUTHORIZATION_REVOKED", last_error_detail: "Current identity, membership, role permission, evidence, verification or geography check failed before Guardian submission." });
      return { outcome: ok ? "PERMANENT_FAILURE" : "STALE_LEASE", jobId: job.id, stage: "GUARDIAN_AUTHORIZATION" };
    }
    const snapshot = snapshotOf(job);
    const key = job.guardian_idempotency_key ?? job.idempotency_key;
    if (!job.guardian_idempotency_key && !await persistGuardianKey(database, lease, key)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "GUARDIAN_KEY_PERSIST" };
    if (!await renewLease(database, lease)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "GUARDIAN_LEASE_RENEWAL" };
    const guardianRun = await withLeaseHeartbeat(database, lease, () => executeGuardianMrv({
      activityId: job.activity_id, verificationId: job.verification_id, evidenceId: job.evidence_id,
      policyId: job.guardian_policy_id,
      ...(job.methodology_code ? { methodologyCode: job.methodology_code } : {}),
      observations: snapshot.observations ?? [], evidence: snapshot.evidence ?? [],
      ...(snapshot.metadata ? { metadata: snapshot.metadata } : {}),
      idempotencyKey: key,
    }));
    if (!guardianRun.leaseValid) return { outcome: "STALE_LEASE", jobId: job.id, stage: "GUARDIAN_LEASE_HEARTBEAT" };
    const guardian = guardianRun.value;
    if (guardian.status === "UNAVAILABLE" || guardian.status === "NOT_CONFIGURED") {
      const ok = await release(database, lease, "GUARDIAN_UNAVAILABLE", guardian.message);
      return { outcome: ok ? "RETRY_SCHEDULED" : "STALE_LEASE", jobId: job.id, stage: "GUARDIAN" };
    }
    if (guardian.status === "REJECTED") {
      const ok = await advance(database, lease, "REJECTED", { guardian_status: "REJECTED", last_error_code: "GUARDIAN_REJECTED", last_error_detail: guardian.message });
      return { outcome: ok ? "REJECTED" : "STALE_LEASE", jobId: job.id, stage: "GUARDIAN" };
    }
    const ok = await advance(database, lease, "GUARDIAN_VERIFIED", {
      guardian_status: "VERIFIED", guardian_execution_id: guardian.executionId,
      guardian_result: { status: guardian.status, executionId: guardian.executionId, policyId: guardian.policyId, correlationId: guardian.correlationId, message: guardian.message },
      last_error_code: null, last_error_detail: null,
    });
    return { outcome: ok ? "STAGE_ADVANCED" : "STALE_LEASE", jobId: job.id, stage: "GUARDIAN_VERIFIED" };
  }

  if (job.status === "GUARDIAN_VERIFIED") {
    if (!await authorize(database, lease)) {
      const ok = await advance(database, lease, "PERMANENT_FAILURE", { last_error_code: "MRV_AUTHORIZATION_REVOKED", last_error_detail: "Authorization failed before Hedera submission." });
      return { outcome: ok ? "PERMANENT_FAILURE" : "STALE_LEASE", jobId: job.id, stage: "HCS_AUTHORIZATION" };
    }
    const status = hederaStatus();
    if (!status.configured || status.topicId === "NOT_CONFIGURED") {
      const ok = await release(database, lease, "HEDERA_NOT_CONFIGURED", "Hedera operator credentials or topic are not configured.");
      return { outcome: ok ? "RETRY_SCHEDULED" : "STALE_LEASE", jobId: job.id, stage: "HCS_CONFIGURATION" };
    }
    const txId = createHcsTransactionId();
    if (!await persistHcsId(database, lease, status.network, status.topicId, txId)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "HCS_TRANSACTION_ID_PERSIST" };
    if (!await renewLease(database, lease)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "HCS_LEASE_RENEWAL" };
    const anchorRun = await withLeaseHeartbeat(database, lease, () => submitHcsAnchor(anchorPayload(job), txId));
    if (!anchorRun.leaseValid) return { outcome: "STALE_LEASE", jobId: job.id, stage: "HCS_LEASE_HEARTBEAT" };
    const anchor = anchorRun.value;
    if (anchor.status === "CONSENSUS_CONFIRMED" && anchor.transactionId === txId && anchor.consensusTimestamp) {
      const ok = await advance(database, lease, "HCS_CONSENSUS_CONFIRMED", {
        hedera_status: "CONSENSUS_CONFIRMED", hedera_consensus_timestamp: anchor.consensusTimestamp,
        last_error_code: null, last_error_detail: null,
      });
      return { outcome: ok ? "STAGE_ADVANCED" : "STALE_LEASE", jobId: job.id, stage: "HCS_CONSENSUS_CONFIRMED" };
    }
    if (anchor.status === "FAILED") {
      const ok = await advance(database, lease, "NEEDS_RECONCILIATION", { hedera_status: "FAILED", last_error_code: "HCS_SUBMISSION_FAILED", last_error_detail: anchor.message });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "HCS_SUBMISSION" };
    }
    const ok = await release(database, lease, "HCS_SUBMISSION_AMBIGUOUS", anchor.message);
    return { outcome: ok ? "RETRY_SCHEDULED" : "STALE_LEASE", jobId: job.id, stage: "HCS_SUBMISSION" };
  }

  if (job.status === "HCS_SUBMITTED" || job.status === "HCS_CONSENSUS_CONFIRMED") {
    if (!await authorize(database, lease)) {
      const ok = await advance(database, lease, "NEEDS_RECONCILIATION", { last_error_code: "MRV_AUTHORIZATION_REVOKED", last_error_detail: "Authorization failed before Mirror Node reconciliation." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "MIRROR_AUTHORIZATION" };
    }
    if (!job.hedera_transaction_id || !job.hedera_topic_id || !job.guardian_execution_id) {
      const ok = await advance(database, lease, "NEEDS_RECONCILIATION", { last_error_code: "HCS_BINDING_MISSING", last_error_detail: "Persisted transaction, topic or Guardian execution binding is missing." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "MIRROR_BINDING" };
    }
    if (!await renewLease(database, lease)) return { outcome: "STALE_LEASE", jobId: job.id, stage: "MIRROR_LEASE_RENEWAL" };
    const payload = anchorPayload(job);
    const mirrorRun = await withLeaseHeartbeat(database, lease, () => reconcileHcsTransaction(job.hedera_transaction_id!, job.hedera_topic_id!, integrityHash(payload), job.activity_id, job.verification_id, job.evidence_id, job.guardian_execution_id!));
    if (!mirrorRun.leaseValid) return { outcome: "STALE_LEASE", jobId: job.id, stage: "MIRROR_LEASE_HEARTBEAT" };
    const mirror = mirrorRun.value;
    if (mirror.status === "CONFIRMED") {
      const ok = await advance(database, lease, "MIRROR_VERIFIED", {
        hedera_consensus_timestamp: mirror.consensusTimestamp,
        mirror_verified_at: new Date(), mirror_verification_digest: integrityHash(payload),
        hedera_status: "CONSENSUS_CONFIRMED", last_error_code: null, last_error_detail: null,
      });
      return { outcome: ok ? "STAGE_ADVANCED" : "STALE_LEASE", jobId: job.id, stage: "MIRROR_VERIFIED" };
    }
    if (mirror.status === "MISMATCH" || mirror.status === "FAILED") {
      const ok = await advance(database, lease, "NEEDS_RECONCILIATION", { last_error_code: "HCS_MIRROR_MISMATCH", last_error_detail: mirror.message });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "MIRROR_RECONCILIATION" };
    }
    const ok = await release(database, lease, "HCS_MIRROR_PENDING", mirror.message);
    return { outcome: ok ? "RETRY_SCHEDULED" : "STALE_LEASE", jobId: job.id, stage: "MIRROR_RECONCILIATION" };
  }

  if (job.status === "MIRROR_VERIFIED") {
    if (!await authorize(database, lease)) {
      const ok = await advance(database, lease, "NEEDS_RECONCILIATION", { last_error_code: "MRV_AUTHORIZATION_REVOKED", last_error_detail: "Authorization failed before final provenance persistence." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "PROVENANCE_AUTHORIZATION" };
    }
    if (!job.guardian_execution_id || !job.hedera_topic_id || !job.hedera_transaction_id || !job.hedera_consensus_timestamp || !job.mirror_verification_digest || !job.mirror_verified_at) {
      const ok = await advance(database, lease, "NEEDS_RECONCILIATION", { last_error_code: "MRV_FINALIZATION_BINDING_MISSING", last_error_detail: "Guardian, HCS and Mirror verification bindings must all be persisted before provenance finalization." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "PROVENANCE_BINDING" };
    }
    const payload = anchorPayload(job);
    const digest = integrityHash(payload);
    if (digest !== job.mirror_verification_digest) {
      const ok = await advance(database, lease, "NEEDS_RECONCILIATION", { last_error_code: "MRV_FINALIZATION_DIGEST_MISMATCH", last_error_detail: "Persisted Mirror verification digest no longer matches the immutable job payload." });
      return { outcome: ok ? "NEEDS_RECONCILIATION" : "STALE_LEASE", jobId: job.id, stage: "PROVENANCE_DIGEST" };
    }
    const finalized = await database.finalize(job.id, lease.leaseToken, digest);
    return { outcome: finalized ? "STAGE_ADVANCED" : "STALE_LEASE", jobId: job.id, stage: finalized ? "COMPLETED" : "PROVENANCE_FINALIZATION" };
  }

  return { outcome: "IDLE", jobId: job.id, stage: job.status };
}
