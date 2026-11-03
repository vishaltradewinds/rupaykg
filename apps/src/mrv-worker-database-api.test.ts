import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { MrvWorkerDatabaseApi } from "./mrv-worker-database-api.js";

const JOB_ID = "00000000-0000-4000-8000-000000000010";
const LEASE_TOKEN = "00000000-0000-4000-8000-000000000001";

function completeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID, idempotency_key: "a".repeat(64), payload_hash: "b".repeat(64),
    activity_id: "00000000-0000-4000-8000-000000000011",
    verification_id: "00000000-0000-4000-8000-000000000012",
    evidence_id: "00000000-0000-4000-8000-000000000013",
    organization_id: "00000000-0000-4000-8000-000000000014",
    geography_id: "00000000-0000-4000-8000-000000000015",
    requested_by_identity_id: "00000000-0000-4000-8000-000000000016",
    guardian_policy_id: "policy-v1", methodology_code: null, payload_snapshot: {},
    status: "CLAIMED", attempt_count: 1, lease_owner: "worker-a",
    lease_token: LEASE_TOKEN, lease_expires_at: "2026-11-03T16:00:00.000Z",
    next_attempt_at: "2026-11-03T15:00:00.000Z", guardian_idempotency_key: null,
    guardian_execution_id: null, guardian_status: null, guardian_result: null,
    hedera_network: null, hedera_topic_id: null, hedera_transaction_id: null,
    hedera_consensus_timestamp: null, hedera_status: null, mirror_verified_at: null,
    mirror_verification_digest: null, last_error_code: null, last_error_detail: null,
    created_at: "2026-11-03T14:00:00.000Z", updated_at: "2026-11-03T15:00:00.000Z",
    completed_at: null, ...overrides,
  };
}

function poolReturning(value: unknown) {
  const calls: string[] = [];
  const pool = {
    query: async (sql: string) => {
      calls.push(sql);
      return { rows: [{ result: value }] };
    },
  } as unknown as Pool;
  return { pool, calls };
}

test("worker adapter uses only the restricted claim function", async () => {
  const { pool, calls } = poolReturning({ job: completeJob(), leaseToken: LEASE_TOKEN });
  const lease = await new MrvWorkerDatabaseApi(pool).claim("worker-a", 120);
  assert.equal(lease?.job.id, JOB_ID);
  assert.ok(lease?.job.created_at instanceof Date);
  assert.ok(lease?.job.lease_expires_at instanceof Date);
  assert.match(calls[0], /mrv_worker_api\.claim_next_job/);
});

test("worker adapter rejects malformed claim results and unsafe lease durations", async () => {
  const missing = new MrvWorkerDatabaseApi(poolReturning({ job: { id: JOB_ID }, leaseToken: LEASE_TOKEN }).pool);
  await assert.rejects(() => missing.claim("worker-a", 120), /INVALID_JOB_FIELD/);
  const wrongStatus = new MrvWorkerDatabaseApi(poolReturning({ job: completeJob({ status: "UNKNOWN" }), leaseToken: LEASE_TOKEN }).pool);
  await assert.rejects(() => wrongStatus.claim("worker-a", 120), /INVALID_JOB_FIELD:status/);
  const wrongLease = new MrvWorkerDatabaseApi(poolReturning({ job: completeJob({ lease_token: "00000000-0000-4000-8000-000000000099" }), leaseToken: LEASE_TOKEN }).pool);
  await assert.rejects(() => wrongLease.claim("worker-a", 120), /INVALID_JOB_LEASE/);
  await assert.rejects(() => new MrvWorkerDatabaseApi(pool).claim("worker-a", 1), /INVALID_CLAIM_ARGUMENT/);
});

test("worker adapter uses the exact authorization and persistence functions", async () => {
  const { pool, calls } = poolReturning(true);
  const api = new MrvWorkerDatabaseApi(pool);
  const id = "00000000-0000-4000-8000-000000000001";
  const token = "00000000-0000-4000-8000-000000000002";
  assert.equal(await api.authorize(id), true);
  assert.equal(await api.persistGuardian(id, token, "stable-key"), true);
  assert.equal(await api.persistHedera(id, token, "testnet", "0.0.1", "tx"), true);
  assert.match(calls[0], /mrv_worker_api\.authorize_job/);
  assert.match(calls[1], /mrv_worker_api\.persist_guardian_binding/);
  assert.match(calls[2], /mrv_worker_api\.persist_hedera_binding/);
});

test("worker adapter rejects malformed boolean responses", async () => {
  const { pool } = poolReturning("true");
  await assert.rejects(() => new MrvWorkerDatabaseApi(pool).authorize("job"), /INVALID_BOOLEAN/);
});

test("advance adapter accepts only the documented JSONB envelope", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const token = "00000000-0000-4000-8000-000000000002";
  const accepted = new MrvWorkerDatabaseApi(poolReturning({ advanced: true }).pool);
  assert.equal(await accepted.advance(id, token, "GUARDIAN_VERIFIED"), true);
  const rejected = new MrvWorkerDatabaseApi(poolReturning({ advanced: "true" }).pool);
  await assert.rejects(() => rejected.advance(id, token, "GUARDIAN_VERIFIED"), /INVALID_ADVANCE_RESULT/);
  const extra = new MrvWorkerDatabaseApi(poolReturning({ advanced: true, ignored: true }).pool);
  await assert.rejects(() => extra.advance(id, token, "GUARDIAN_VERIFIED"), /INVALID_ADVANCE_RESULT/);
  const legacy = new MrvWorkerDatabaseApi(poolReturning(true).pool);
  await assert.rejects(() => legacy.advance(id, token, "GUARDIAN_VERIFIED"), /INVALID_ADVANCE_RESULT/);
});
