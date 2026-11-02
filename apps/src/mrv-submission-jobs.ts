import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

export type MrvJobStatus =
  | "REQUESTED" | "CLAIMED" | "GUARDIAN_SUBMITTED" | "GUARDIAN_VERIFIED"
  | "HCS_SUBMITTED" | "HCS_CONSENSUS_CONFIRMED" | "MIRROR_VERIFIED"
  | "PROVENANCE_PERSISTED" | "COMPLETED" | "REJECTED" | "RETRYABLE_FAILURE"
  | "PERMANENT_FAILURE" | "NEEDS_RECONCILIATION" | "CANCELLED";

export interface MrvSubmissionJob {
  id: string;
  idempotency_key: string;
  payload_hash: string;
  activity_id: string;
  verification_id: string;
  evidence_id: string;
  organization_id: string;
  geography_id: string;
  requested_by_identity_id: string;
  guardian_policy_id: string;
  methodology_code: string | null;
  payload_snapshot: Record<string, unknown>;
  status: MrvJobStatus;
  attempt_count: number;
  lease_owner: string | null;
  lease_token: string | null;
  lease_expires_at: Date | null;
  next_attempt_at: Date;
  guardian_idempotency_key: string | null;
  guardian_execution_id: string | null;
  guardian_status: string | null;
  guardian_result: Record<string, unknown> | null;
  hedera_network: string | null;
  hedera_topic_id: string | null;
  hedera_transaction_id: string | null;
  hedera_consensus_timestamp: string | null;
  hedera_status: string | null;
  mirror_verified_at: Date | null;
  mirror_verification_digest: string | null;
  last_error_code: string | null;
  last_error_detail: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface MrvJobLease {
  job: MrvSubmissionJob;
  leaseToken: string;
}

export interface MrvJobStagePatch {
  guardian_idempotency_key?: string | null;
  guardian_execution_id?: string | null;
  guardian_status?: "VERIFIED" | "REJECTED" | "UNAVAILABLE" | "NOT_CONFIGURED" | null;
  guardian_result?: Record<string, unknown> | null;
  hedera_network?: "testnet" | "previewnet" | "mainnet" | null;
  hedera_topic_id?: string | null;
  hedera_transaction_id?: string | null;
  hedera_consensus_timestamp?: string | null;
  hedera_status?: "NOT_CONFIGURED" | "CONSENSUS_CONFIRMED" | "RETRYABLE_FAILURE" | "FAILED" | null;
  mirror_verified_at?: Date | null;
  mirror_verification_digest?: string | null;
  last_error_code?: string | null;
  last_error_detail?: string | null;
  completed_at?: Date | null;
  next_attempt_at?: Date;
}

const claimableStatuses: MrvJobStatus[] = [
  "REQUESTED", "CLAIMED", "GUARDIAN_SUBMITTED", "GUARDIAN_VERIFIED",
  "HCS_SUBMITTED", "HCS_CONSENSUS_CONFIRMED", "MIRROR_VERIFIED",
  "PROVENANCE_PERSISTED", "RETRYABLE_FAILURE", "NEEDS_RECONCILIATION",
];

function boundedLeaseSeconds(seconds: number): number {
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 900) {
    throw new RangeError("MRV worker lease must be between 10 and 900 seconds");
  }
  return seconds;
}

/**
 * Claim one due job atomically. Caller must provide a checked-out client and
 * run this inside a short transaction. SKIP LOCKED permits parallel workers.
 * External Guardian/Hedera/ Mirror Node calls must happen after COMMIT.
 */
export async function claimNextMrvSubmissionJob(
  client: PoolClient,
  workerId: string,
  leaseSeconds = 60,
): Promise<MrvJobLease | null> {
  const owner = workerId.trim();
  if (!owner || owner.length > 128) throw new TypeError("MRV worker ID must be 1-128 characters");
  const duration = boundedLeaseSeconds(leaseSeconds);
  const leaseToken = randomUUID();
  const result = await client.query<MrvSubmissionJob>(
    `with candidate as (
       select id
         from mrv_submission_jobs
        where status = any($1::text[])
          and next_attempt_at <= now()
          and (lease_token is null or lease_expires_at <= now())
        order by next_attempt_at, created_at, id
        for update skip locked
        limit 1
     )
     update mrv_submission_jobs job
        set status = case
              when job.status in ('REQUESTED','RETRYABLE_FAILURE','NEEDS_RECONCILIATION') then 'CLAIMED'
              else job.status
            end,
            lease_owner = $2,
            lease_token = $3::uuid,
            lease_expires_at = now() + make_interval(secs => $4),
            attempt_count = job.attempt_count + 1
       from candidate
      where job.id = candidate.id
      returning job.*`,
    [claimableStatuses, owner, leaseToken, duration],
  );
  const job = result.rows[0];
  return job ? { job, leaseToken } : null;
}

/**
 * Advance a job only while this worker still owns an unexpired lease.
 * Field names are allow-listed; the lease is cleared in the same UPDATE.
 * A null result means another worker reclaimed the job or the lease expired.
 */
export async function advanceMrvSubmissionJob(
  client: PoolClient,
  jobId: string,
  leaseToken: string,
  nextStatus: MrvJobStatus,
  patch: MrvJobStagePatch = {},
): Promise<MrvSubmissionJob | null> {
  const allowedColumns: Array<keyof MrvJobStagePatch> = [
    "guardian_idempotency_key", "guardian_execution_id", "guardian_status", "guardian_result",
    "hedera_network", "hedera_topic_id", "hedera_transaction_id", "hedera_consensus_timestamp",
    "hedera_status", "mirror_verified_at", "mirror_verification_digest", "last_error_code",
    "last_error_detail", "completed_at", "next_attempt_at",
  ];
  const entries = allowedColumns.filter((key) => Object.prototype.hasOwnProperty.call(patch, key));
  const values: unknown[] = [jobId, leaseToken, nextStatus];
  const assignments = entries.map((key) => {
    values.push(patch[key]);
    return `${key} = $${values.length}`;
  });
  assignments.push("lease_owner = null", "lease_token = null", "lease_expires_at = null");
  const result = await client.query<MrvSubmissionJob>(
    `update mrv_submission_jobs
        set status = $3, ${assignments.join(", ")}
      where id = $1
        and lease_token = $2::uuid
        and lease_expires_at > now()
      returning *`,
    values,
  );
  return result.rows[0] ?? null;
}

/** Explicitly release a still-valid lease without advancing the workflow stage. */
export async function releaseMrvSubmissionJobLease(
  client: PoolClient,
  jobId: string,
  leaseToken: string,
  retryAt: Date,
  errorCode: string,
  errorDetail: string,
): Promise<boolean> {
  const result = await client.query(
    `update mrv_submission_jobs
        set lease_owner = null, lease_token = null, lease_expires_at = null,
            next_attempt_at = $3, last_error_code = $4, last_error_detail = $5
      where id = $1 and lease_token = $2::uuid and lease_expires_at > now()`,
    [jobId, leaseToken, retryAt, errorCode.slice(0, 128), errorDetail.slice(0, 2000)],
  );
  return result.rowCount === 1;
}
