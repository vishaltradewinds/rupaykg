import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { canonicalGovBridgeHash } from "./government-inbox-hash.js";
import { runGovernmentInboxWorker } from "./async-mirror-worker.js";

const enabled = process.env.CI === "true"
  && process.env.NODE_ENV !== "production"
  && process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1"
  && Boolean(process.env.DATABASE_URL);

function makePool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: true },
    max: 4,
  });
}

async function insertInboxRows(pool: Pool, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = randomUUID();
    const batchId = randomUUID();
    const payload = {
      batchMetadata: {
        authorityCode: "CI-CONCURRENCY",
        municipalCode: "CI-TEST",
        batchId,
        syncWindowTimestamp: "2026-10-31T00:00:00Z",
        sourceVersion: "ci-concurrency-v1",
      },
      rawDataLogs: ["Disposable PostgreSQL worker concurrency fixture"],
    };
    await pool.query(
      `insert into async_mirror_inbox
        (id,authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256)
       values ($1,'CI-CONCURRENCY','CI-TEST',$2,$3::timestamptz,$4::jsonb,$5)`,
      [id, batchId, "2026-10-31T00:00:00Z", JSON.stringify(payload), canonicalGovBridgeHash(payload)],
    );
    ids.push(id);
  }
  return ids;
}

test("two concurrent workers claim disjoint rows under PostgreSQL SKIP LOCKED", {
  skip: !enabled ? "requires disposable CI PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = makePool();
  try {
    const insertedIds = await insertInboxRows(pool, 4);
    const observedIds: string[] = [];
    let release!: () => void;
    const allFourEntered = new Promise<void>((resolve) => { release = resolve; });
    const validate = async (input: { id: string }) => {
      observedIds.push(input.id);
      if (observedIds.length === 4) release();
      await allFourEntered;
      return { valid: false, errorCode: "CI_CONCURRENCY_FIXTURE" };
    };

    const [left, right] = await Promise.all([
      runGovernmentInboxWorker(pool, validate, { batchSize: 2, leaseSeconds: 120, maxAttempts: 5 }),
      runGovernmentInboxWorker(pool, validate, { batchSize: 2, leaseSeconds: 120, maxAttempts: 5 }),
    ]);

    assert.equal(left.claimed + right.claimed, 4);
    assert.equal(new Set(observedIds).size, 4, "no inbox row may be claimed by both workers");
    assert.deepEqual(new Set(observedIds), new Set(insertedIds));
    assert.equal(left.rejected + right.rejected, 4);
  } finally {
    await pool.end();
  }
});

test("a stale worker cannot complete after its fencing token has been replaced", {
  skip: !enabled ? "requires disposable CI PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = makePool();
  try {
    const [id] = await insertInboxRows(pool, 1);
    const result = await runGovernmentInboxWorker(pool, async () => {
      await pool.query(
        `update async_mirror_inbox
            set lease_token=gen_random_uuid(), lease_until=now() + interval '120 seconds'
          where id=$1 and status='PROCESSING'`,
        [id],
      );
      return { valid: false, errorCode: "CI_STALE_FENCE_FIXTURE" };
    }, { batchSize: 1, leaseSeconds: 120, maxAttempts: 5 });

    assert.equal(result.claimed, 1);
    assert.equal(result.rejected, 0, "stale completion must not be counted as accepted");
    const current = await pool.query<{ status: string; lease_token: string | null }>(
      "select status,lease_token from async_mirror_inbox where id=$1",
      [id],
    );
    assert.equal(current.rows[0]?.status, "PROCESSING");
    assert.ok(current.rows[0]?.lease_token, "replacement lease token must remain in force");
  } finally {
    await pool.end();
  }
});
