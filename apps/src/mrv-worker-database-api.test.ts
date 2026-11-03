import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { MrvWorkerDatabaseApi } from "./mrv-worker-database-api.js";

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
  const job = { id: "job-1", status: "CLAIMED", payload_snapshot: {} };
  const { pool, calls } = poolReturning({ job, leaseToken: "00000000-0000-4000-8000-000000000001" });
  const lease = await new MrvWorkerDatabaseApi(pool).claim("worker-a", 120);
  assert.equal(lease?.job.id, "job-1");
  assert.match(calls[0], /mrv_worker_api\.claim_next_job/);
});

test("worker adapter rejects malformed claim results and unsafe lease durations", async () => {
  const { pool } = poolReturning({ job: { id: "job-1" } });
  await assert.rejects(() => new MrvWorkerDatabaseApi(pool).claim("worker-a", 120), /INVALID_CLAIM/);
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
