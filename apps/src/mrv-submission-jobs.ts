import { createHash, randomUUID } from "node:crypto";
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

export interface EnqueueMrvSubmissionJobInput {
  activityId: string;
  verificationId: string;
  evidenceId: string;
  organizationId: string;
  geographyId: string;
  requestedByIdentityId: string;
  guardianPolicyId: string;
  methodologyCode?: string | null;
  payloadSnapshot: Record<string, unknown>;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}

export function createMrvSubmissionIdempotencyKey(input: Pick<EnqueueMrvSubmissionJobInput, "activityId" | "verificationId" | "evidenceId" | "guardianPolicyId" | "methodologyCode">): string {
  return createHash("sha256").update([input.activityId, input.verificationId, input.evidenceId, input.guardianPolicyId, input.methodologyCode ?? ""].join("|")).digest("hex");
}

/**
 * Re-check all mutable authorization and MRV bindings immediately before an
 * irreversible provider stage. Enqueue-time validation alone is insufficient:
 * membership, organization, evidence or verification may have changed.
 */
export async function isMrvSubmissionJobStillAuthorized(client: PoolClient, jobId: string): Promise<boolean> {
  const result = await client.query<{ authorized: boolean }>(
    `select exists (
       select 1
         from mrv_submission_jobs j
         join activities a on a.id=j.activity_id
                           and a.organization_id=j.organization_id
                           and a.geography_id=j.geography_id
         join organizations o on o.id=j.organization_id and o.status='VERIFIED'
         join identities i on i.id=j.requested_by_identity_id and i.status='VERIFIED' and i.suspended_at is null
         join evidence e on e.id=j.evidence_id and e.activity_id=a.id and e.status='VERIFIED'
         join verifications v on v.id=j.verification_id
                              and v.evidence_id=e.id and v.activity_id=a.id
                              and v.decision='APPROVED'
         join organization_memberships om on om.identity_id=j.requested_by_identity_id
                                          and om.organization_id=j.organization_id
                                          and om.status='VERIFIED'
         join roles r on r.id=om.role_id and r.organization_id=j.organization_id
        where j.id=$1
          and a.status='COMPLETED'
          and v.verifier_identity_id <> a.actor_identity_id
          and a.geography_id is not null
          and organization_has_geography_scope(j.organization_id,a.geography_id)
          and exists (select 1 from jsonb_array_elements_text(r.permissions) p where p = 'guardian:operate')
     ) as authorized`,
    [jobId],
  );
  return result.rows[0]?.authorized === true;
}

/** Enqueue an immutable MRV request; repeated identical requests return the same row. */
export async function enqueueMrvSubmissionJob(client: PoolClient, input: EnqueueMrvSubmissionJobInput): Promise<MrvSubmissionJob> {
  if (!input.guardianPolicyId.trim() || !Object.keys(input.payloadSnapshot).length) throw new TypeError("MRV policy and payload snapshot are required");
  const idempotencyKey = createMrvSubmissionIdempotencyKey(input);
  const canonicalPayload = stableJson(input.payloadSnapshot);
  const payloadHash = createHash("sha256").update(canonicalPayload).digest("hex");
  const result = await client.query<MrvSubmissionJob>(
    `insert into mrv_submission_jobs(
       idempotency_key,payload_hash,activity_id,verification_id,evidence_id,organization_id,geography_id,
       requested_by_identity_id,guardian_policy_id,methodology_code,payload_snapshot
     ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     on conflict(idempotency_key) do update set updated_at=mrv_submission_jobs.updated_at
       where mrv_submission_jobs.payload_hash=excluded.payload_hash
     returning *`,
    [idempotencyKey,payloadHash,input.activityId,input.verificationId,input.evidenceId,input.organizationId,input.geographyId,input.requestedByIdentityId,input.guardianPolicyId,input.methodologyCode ?? null,JSON.stringify(input.payloadSnapshot)],
  );
  if (!result.rows[0]) throw new Error("MRV_IDEMPOTENCY_PAYLOAD_CONFLICT");
  return result.rows[0];
}

const claimableStatuses: MrvJobStatus[] = [
  "REQUESTED", "CLAIMED", "GUARDIAN_SUBMITTED", "GUARDIAN_VERIFIED",
  "HCS_SUBMITTED", "HCS_CONSENSUS_CONFIRMED", "MIRROR_VERIFIED",
  "RETRYABLE_FAILURE",
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

/**
 * Persist Guardian's deterministic idempotency key before the provider call.
 * A retry must reuse the exact key; the active lease remains fenced while the
 * external request runs after the short database transaction commits.
 */
export async function persistMrvGuardianIdempotencyKey(
  client: PoolClient,
  jobId: string,
  leaseToken: string,
  idempotencyKey: string,
): Promise<MrvSubmissionJob | null> {
  const key = idempotencyKey.trim();
  if (key.length < 32 || key.length > 128) throw new TypeError("Guardian idempotency key must be 32-128 characters");
  const result = await client.query<MrvSubmissionJob>(
    `update mrv_submission_jobs
        set status = 'GUARDIAN_SUBMITTED',
            guardian_idempotency_key = coalesce(guardian_idempotency_key, $3)
      where id = $1 and lease_token = $2::uuid and lease_expires_at > now()
        and status in ('CLAIMED','GUARDIAN_SUBMITTED')
        and (guardian_idempotency_key is null or guardian_idempotency_key = $3)
      returning *`,
    [jobId, leaseToken, key],
  );
  return result.rows[0] ?? null;
}

/**
 * Persist the Hedera transaction ID before the network side effect. The same
 * transaction ID is immutable once assigned; retries must reuse it. This
 * keeps the lease live while the provider call runs outside a DB transaction.
 */
export async function persistMrvHcsTransactionId(
  client: PoolClient,
  jobId: string,
  leaseToken: string,
  network: "testnet" | "previewnet" | "mainnet",
  topicId: string,
  transactionId: string,
): Promise<MrvSubmissionJob | null> {
  if (!topicId.trim() || !transactionId.trim()) throw new TypeError("Hedera topic and transaction IDs are required");
  const result = await client.query<MrvSubmissionJob>(
    `update mrv_submission_jobs
        set status = 'HCS_SUBMITTED', hedera_network = $3, hedera_topic_id = $4,
            hedera_transaction_id = coalesce(hedera_transaction_id, $5)
      where id = $1 and lease_token = $2::uuid and lease_expires_at > now()
        and status in ('GUARDIAN_VERIFIED','HCS_SUBMITTED')
        and (hedera_transaction_id is null or hedera_transaction_id = $5)
        and (hedera_topic_id is null or hedera_topic_id = $4)
        and (hedera_network is null or hedera_network = $3)
      returning *`,
    [jobId, leaseToken, network, topicId, transactionId],
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

/** Extend a live lease while a bounded provider operation is still running. */
export async function renewMrvSubmissionJobLease(
  client: PoolClient,
  jobId: string,
  leaseToken: string,
  leaseSeconds = 60,
): Promise<Date | null> {
  const duration = boundedLeaseSeconds(leaseSeconds);
  const result = await client.query<{ lease_expires_at: Date }>(
    `update mrv_submission_jobs
        set lease_expires_at = now() + make_interval(secs => $3)
      where id = $1 and lease_token = $2::uuid and lease_expires_at > now()
      returning lease_expires_at`,
    [jobId, leaseToken, duration],
  );
  return result.rows[0]?.lease_expires_at ?? null;
}
