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

function claimResult(value: unknown): MrvJobLease | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") throw new Error("MRV_WORKER_API_INVALID_CLAIM");
  const candidate = value as Partial<ClaimResult>;
  if (!candidate.job || typeof candidate.job !== "object" || typeof candidate.leaseToken !== "string" || !candidate.leaseToken) throw new Error("MRV_WORKER_API_INVALID_CLAIM");
  const job = candidate.job as MrvSubmissionJob;
  if (typeof job.id !== "string" || typeof job.status !== "string" || typeof job.payload_snapshot !== "object" || job.payload_snapshot === null) throw new Error("MRV_WORKER_API_INVALID_JOB");
  return { job, leaseToken: candidate.leaseToken };
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
