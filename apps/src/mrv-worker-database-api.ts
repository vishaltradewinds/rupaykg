import type { Pool } from "pg";
import type { MrvJobLease, MrvJobStagePatch, MrvJobStatus, MrvSubmissionJob } from "./mrv-submission-jobs.js";

type ApiResult<T> = { result: T };
type ClaimResult = { job: MrvSubmissionJob; leaseToken: string };

function one<T>(rows: ApiResult<T>[], operation: string): T {
  if (rows.length !== 1 || !Object.prototype.hasOwnProperty.call(rows[0], "result")) throw new Error(`MRV_WORKER_API_INVALID_RESPONSE:${operation}`);
  return rows[0].result;
}

function booleanResult(value: unknown, operation: string): boolean {
  if (typeof value === "boolean") return value;
  throw new Error(`MRV_WORKER_API_INVALID_BOOLEAN:${operation}`);
}

function advanceResult(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MRV_WORKER_API_INVALID_ADVANCE_RESULT");
  }
  const result = value as Record<string, unknown>;
  if (Object.keys(result).length !== 1 || typeof result.advanced !== "boolean") {
    throw new Error("MRV_WORKER_API_INVALID_ADVANCE_RESULT");
  }
  return result.advanced;
}

const JOB_STATUSES = new Set<MrvJobStatus>([
  "REQUESTED", "CLAIMED", "GUARDIAN_SUBMITTED", "GUARDIAN_VERIFIED",
  "HCS_SUBMITTED", "HCS_CONSENSUS_CONFIRMED", "MIRROR_VERIFIED",
  "PROVENANCE_PERSISTED", "COMPLETED", "REJECTED", "RETRYABLE_FAILURE",
  "PERMANENT_FAILURE", "NEEDS_RECONCILIATION", "CANCELLED",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`MRV_WORKER_API_INVALID_JOB_FIELD:${key}`);
  return value;
}

function nullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`MRV_WORKER_API_INVALID_JOB_FIELD:${key}`);
  return value;
}

function dateValue(row: Record<string, unknown>, key: string, nullable = false): Date | null {
  const value = row[key];
  if (nullable && value === null) return null;
  if (!(typeof value === "string" || value instanceof Date)) throw new Error(`MRV_WORKER_API_INVALID_JOB_FIELD:${key}`);
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`MRV_WORKER_API_INVALID_JOB_FIELD:${key}`);
  return parsed;
}

function objectValue(row: Record<string, unknown>, key: string, nullable = false): Record<string, unknown> | null {
  const value = row[key];
  if (nullable && value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`MRV_WORKER_API_INVALID_JOB_FIELD:${key}`);
  return value as Record<string, unknown>;
}

function completeJob(value: unknown, leaseToken: string): MrvSubmissionJob {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("MRV_WORKER_API_INVALID_JOB");
  const row = value as Record<string, unknown>;
  const id = requiredString(row, "id");
  if (!UUID.test(id)) throw new Error("MRV_WORKER_API_INVALID_JOB_FIELD:id");
  const status = requiredString(row, "status");
  if (!JOB_STATUSES.has(status as MrvJobStatus)) throw new Error("MRV_WORKER_API_INVALID_JOB_FIELD:status");
  const attemptCount = row.attempt_count;
  if (!Number.isSafeInteger(attemptCount) || (attemptCount as number) < 0) throw new Error("MRV_WORKER_API_INVALID_JOB_FIELD:attempt_count");
  const payloadSnapshot = objectValue(row, "payload_snapshot")!;
  const guardianResult = objectValue(row, "guardian_result", true);
  const guardianStatus = nullableString(row, "guardian_status");
  if (guardianStatus !== null && !["VERIFIED", "REJECTED", "UNAVAILABLE", "NOT_CONFIGURED"].includes(guardianStatus)) throw new Error("MRV_WORKER_API_INVALID_JOB_FIELD:guardian_status");
  const hederaNetwork = nullableString(row, "hedera_network");
  if (hederaNetwork !== null && !["testnet", "previewnet", "mainnet"].includes(hederaNetwork)) throw new Error("MRV_WORKER_API_INVALID_JOB_FIELD:hedera_network");
  const hederaStatus = nullableString(row, "hedera_status");
  if (hederaStatus !== null && !["NOT_CONFIGURED", "CONSENSUS_CONFIRMED", "RETRYABLE_FAILURE", "FAILED"].includes(hederaStatus)) throw new Error("MRV_WORKER_API_INVALID_JOB_FIELD:hedera_status");
  const leaseOwner = nullableString(row, "lease_owner");
  const rowLeaseToken = nullableString(row, "lease_token");
  const leaseExpiresAt = dateValue(row, "lease_expires_at", true);
  if (!leaseOwner || !rowLeaseToken || !UUID.test(rowLeaseToken) || !leaseExpiresAt || rowLeaseToken !== leaseToken) throw new Error("MRV_WORKER_API_INVALID_JOB_LEASE");
  const idempotencyKey = requiredString(row, "idempotency_key");
  if (idempotencyKey.length < 32 || idempotencyKey.length > 128) throw new Error("MRV_WORKER_API_INVALID_JOB_FIELD:idempotency_key");
  const guardianIdempotencyKey = nullableString(row, "guardian_idempotency_key");
  if (guardianIdempotencyKey !== null && (guardianIdempotencyKey.length < 32 || guardianIdempotencyKey.length > 128)) {
    throw new Error("MRV_WORKER_API_INVALID_JOB_FIELD:guardian_idempotency_key");
  }
  const payloadHash = requiredString(row, "payload_hash");
  if (!/^[a-f0-9]{64}$/.test(payloadHash)) throw new Error("MRV_WORKER_API_INVALID_JOB_FIELD:payload_hash");
  const foreignIds = ["activity_id", "verification_id", "evidence_id", "organization_id", "geography_id", "requested_by_identity_id"] as const;
  const foreignValues = Object.fromEntries(foreignIds.map(key => {
    const fieldValue = requiredString(row, key);
    if (!UUID.test(fieldValue)) throw new Error(`MRV_WORKER_API_INVALID_JOB_FIELD:${key}`);
    return [key, fieldValue];
  }));
  const guardianPolicyId = requiredString(row, "guardian_policy_id");
  return {
    id, status: status as MrvJobStatus,
    idempotency_key: idempotencyKey,
    payload_hash: payloadHash,
    activity_id: foreignValues.activity_id,
    verification_id: foreignValues.verification_id,
    evidence_id: foreignValues.evidence_id,
    organization_id: foreignValues.organization_id,
    geography_id: foreignValues.geography_id,
    requested_by_identity_id: foreignValues.requested_by_identity_id,
    guardian_policy_id: guardianPolicyId,
    methodology_code: nullableString(row, "methodology_code"),
    payload_snapshot: payloadSnapshot,
    attempt_count: attemptCount as number,
    lease_owner: leaseOwner,
    lease_token: rowLeaseToken,
    lease_expires_at: leaseExpiresAt,
    next_attempt_at: dateValue(row, "next_attempt_at")!,
    guardian_idempotency_key: guardianIdempotencyKey,
    guardian_execution_id: nullableString(row, "guardian_execution_id"),
    guardian_status: guardianStatus,
    guardian_result: guardianResult,
    hedera_network: hederaNetwork,
    hedera_topic_id: nullableString(row, "hedera_topic_id"),
    hedera_transaction_id: nullableString(row, "hedera_transaction_id"),
    hedera_consensus_timestamp: nullableString(row, "hedera_consensus_timestamp"),
    hedera_status: hederaStatus,
    mirror_verified_at: dateValue(row, "mirror_verified_at", true),
    mirror_verification_digest: nullableString(row, "mirror_verification_digest"),
    last_error_code: nullableString(row, "last_error_code"),
    last_error_detail: nullableString(row, "last_error_detail"),
    created_at: dateValue(row, "created_at")!,
    updated_at: dateValue(row, "updated_at")!,
    completed_at: dateValue(row, "completed_at", true),
  };
}

function claimResult(value: unknown): MrvJobLease | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("MRV_WORKER_API_INVALID_CLAIM");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.leaseToken !== "string" || !UUID.test(candidate.leaseToken)) throw new Error("MRV_WORKER_API_INVALID_CLAIM");
  return { job: completeJob(candidate.job, candidate.leaseToken), leaseToken: candidate.leaseToken };
}

/** Function-only adapter. It never queries application tables or opens a multi-statement transaction. */
export class MrvWorkerDatabaseApi {
  constructor(private readonly pool: Pool) {}

  async claim(workerId: string, leaseSeconds: number): Promise<MrvJobLease | null> {
    if (!workerId.trim() || workerId.length > 128 || !Number.isInteger(leaseSeconds) || leaseSeconds < 10 || leaseSeconds > 900) throw new TypeError("MRV_WORKER_INVALID_CLAIM_ARGUMENT");
    const q = await this.pool.query<ApiResult<unknown>>("select mrv_worker_api.claim_next_job($1,$2) as result", [workerId, leaseSeconds]);
    return claimResult(one(q.rows, "claim_next_job"));
  }

  async authorize(jobId: string): Promise<boolean> {
    const q = await this.pool.query<ApiResult<unknown>>("select mrv_worker_api.authorize_job($1::uuid) as result", [jobId]);
    return booleanResult(one(q.rows, "authorize_job"), "authorize_job");
  }

  async persistGuardian(jobId: string, token: string, key: string): Promise<boolean> {
    const q = await this.pool.query<ApiResult<unknown>>("select mrv_worker_api.persist_guardian_binding($1::uuid,$2::uuid,$3) as result", [jobId, token, key]);
    return booleanResult(one(q.rows, "persist_guardian_binding"), "persist_guardian_binding");
  }

  async persistHedera(jobId: string, token: string, network: "testnet" | "previewnet" | "mainnet", topicId: string, txId: string): Promise<boolean> {
    const q = await this.pool.query<ApiResult<unknown>>("select mrv_worker_api.persist_hedera_binding($1::uuid,$2::uuid,$3,$4,$5) as result", [jobId, token, network, topicId, txId]);
    return booleanResult(one(q.rows, "persist_hedera_binding"), "persist_hedera_binding");
  }

  async renew(jobId: string, token: string, seconds: number): Promise<boolean> {
    if (!Number.isInteger(seconds) || seconds < 10 || seconds > 900) throw new TypeError("MRV_WORKER_INVALID_LEASE_DURATION");
    const q = await this.pool.query<ApiResult<unknown>>("select mrv_worker_api.renew_lease($1::uuid,$2::uuid,$3) as result", [jobId, token, seconds]);
    const value = one(q.rows, "renew_lease");
    if (value === null) return false;
    if (typeof value !== "string" && !(value instanceof Date)) throw new Error("MRV_WORKER_API_INVALID_RENEWAL");
    const renewedUntil = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (!Number.isFinite(renewedUntil.getTime())) {
      throw new Error("MRV_WORKER_API_INVALID_RENEWAL");
    }
    return true;
  }

  async advance(jobId: string, token: string, status: MrvJobStatus, patch: MrvJobStagePatch = {}): Promise<boolean> {
    const q = await this.pool.query<ApiResult<unknown>>("select mrv_worker_api.advance_job($1::uuid,$2::uuid,$3,$4::jsonb) as result", [jobId, token, status, JSON.stringify(patch)]);
    return advanceResult(one(q.rows, "advance_job"));
  }

  async release(jobId: string, token: string, nextAttemptAt: Date, code: string, detail: string): Promise<boolean> {
    if (!Number.isFinite(nextAttemptAt.getTime()) || !code.trim() || code.length > 128 || detail.length > 2000) throw new TypeError("MRV_WORKER_INVALID_RELEASE_ARGUMENT");
    const q = await this.pool.query<ApiResult<unknown>>("select mrv_worker_api.release_job($1::uuid,$2::uuid,$3::timestamptz,$4,$5) as result", [jobId, token, nextAttemptAt, code, detail]);
    return booleanResult(one(q.rows, "release_job"), "release_job");
  }

  async finalize(jobId: string, token: string, digest: string): Promise<boolean> {
    if (!/^[a-f0-9]{64}$/i.test(digest)) throw new TypeError("MRV_WORKER_INVALID_PROVENANCE_DIGEST");
    const q = await this.pool.query<ApiResult<unknown>>("select mrv_worker_api.finalize_provenance($1::uuid,$2::uuid,$3) as result", [jobId, token, digest]);
    return booleanResult(one(q.rows, "finalize_provenance"), "finalize_provenance");
  }
}
