import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { isValidSyncWindowTimestamp, reconcileGovernmentInbox, runGovernmentInboxWorker, validateGovernmentInboxPayload } from "./async-mirror-worker.js";

function fakePool(rows: unknown[]) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const pool = {
    query: async (sql: string, values: unknown[] = []) => {
      statements.push({ sql, values });
      if (sql.includes("returning inbox.id")) return { rows, rowCount: rows.length };
      if (sql.includes("group by status")) return { rows };
      if (sql.includes("lease_until < now()")) return { rows: [{ count: "2" }] };
      return { rows: [], rowCount: 1 };
    },
  };
  return { pool: pool as unknown as Pool, statements };
}

const row = {
  id: "3b6f2a54-8cb2-4d0a-ae11-99a13e68b2b4",
  authority_code: "MH-PCB",
  municipal_code: "MCGM-MUM",
  batch_id: "b5e74bb0-b3a1-4fd7-ae67-c3c2a68d56ab",
  payload: {
    batchMetadata: { authorityCode: "MH-PCB", municipalCode: "MCGM-MUM", batchId: "b5e74bb0-b3a1-4fd7-ae67-c3c2a68d56ab", syncWindowTimestamp: "2026-10-19T02:30:00Z" },
    rawDataLogs: ["Waste collection record from authorized source"],
  },
  attempts: 1,
  lease_token: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

test("worker claims a bounded batch and marks structurally valid payloads as internal-only validated", async () => {
  const { pool, statements } = fakePool([row]);
  const result = await runGovernmentInboxWorker(pool);
  assert.deepEqual(result, { claimed: 1, validated: 1, rejected: 0, retried: 0, quarantined: 0 });
  assert.match(statements[1]!.sql, /for update skip locked/i);
  assert.match(statements[2]!.sql, /lease_token=\$2/i);
  assert.match(statements[2]!.sql, /status='VALIDATED'/i);
});

test("worker rejects metadata mismatch without retrying deterministic validation failures", async () => {
  const { pool } = fakePool([{ ...row, payload: { ...row.payload, batchMetadata: { ...row.payload.batchMetadata, municipalCode: "OTHER" } } }]);
  const result = await runGovernmentInboxWorker(pool);
  assert.equal(result.rejected, 1);
});

test("worker retries transient errors and quarantines an exhausted attempt", async () => {
  const { pool, statements } = fakePool([{ ...row, attempts: 1 }]);
  const retry = await runGovernmentInboxWorker(pool, async () => { throw new Error("temporary outage"); }, { maxAttempts: 3 });
  assert.equal(retry.retried, 1);
  assert.match(statements[2]!.sql, /next_attempt_at=case when \$3='RETRY'/i);

  const exhaustedPool = fakePool([{ ...row, attempts: 3 }]);
  const exhausted = await runGovernmentInboxWorker(exhaustedPool.pool, async () => { throw new Error("still unavailable"); }, { maxAttempts: 3 });
  assert.equal(exhausted.quarantined, 1);
  assert.match(exhaustedPool.statements[2]!.sql, /quarantined_at=case when \$3='QUARANTINED'/i);
});

test("structural validator rejects unknown fields", async () => {
  const payload = row.payload as Record<string, any>;
  const result = await validateGovernmentInboxPayload({
    authorityCode: "MH-PCB", municipalCode: "MCGM-MUM", batchId: row.batch_id,
    payload: { ...payload, unauthorizedField: true },
  });
  assert.equal(result.errorCode, "BATCH_UNKNOWN_FIELD");
});

test("reconciliation reports unresolved statuses and expired leases read-only", async () => {
  const { pool, statements } = fakePool([
    { status: "RETRY", count: "4", oldest_at: "2026-10-20T09:00:00Z" },
    { status: "PROCESSING", count: "1", oldest_at: "2026-10-20T08:00:00Z" },
  ]);
  const result = await reconcileGovernmentInbox(pool);
  assert.deepEqual(result, {
    byStatus: { RETRY: 4, PROCESSING: 1 },
    expiredLeases: 2,
    oldestUnresolvedAt: "2026-10-20T08:00:00Z",
  });
  assert.equal(statements.length, 2);
  assert.match(statements[0]!.sql, /group by status/i);
});


test("government inbox timestamp validation checks actual calendar and clock values", () => {
  assert.equal(isValidSyncWindowTimestamp("2026-02-30T02:30:00Z"), false);
  assert.equal(isValidSyncWindowTimestamp("2024-02-29T02:30:00Z"), true);
  assert.equal(isValidSyncWindowTimestamp("2026-10-19T24:00:00Z"), false);
  assert.equal(isValidSyncWindowTimestamp("2026-10-19T02:30:00+05:30"), true);
});
