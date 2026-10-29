import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { isValidSyncWindowTimestamp, reconcileGovernmentInbox, runGovernmentInboxWorker, validateGovernmentInboxPayload } from "./async-mirror-worker.js";
import { canonicalGovBridgeHash } from "./government-inbox-hash.js";

function fakePool(rows: unknown[], crosswalkRows?: unknown[]) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const pool = {
    query: async (sql: string, values: unknown[] = []) => {
      statements.push({ sql, values });
      if (sql.includes("returning inbox.id")) return { rows, rowCount: rows.length };
      if (sql.includes("from government_jurisdiction_crosswalks c")) return { rows: crosswalkRows ?? [{ id: "crosswalk-id", organization_id: "organization-id", geography_id: "geography-id", activity_id: null, source_version: "synthetic-v1" }], rowCount: (crosswalkRows ?? [{}]).length };
      if (sql.includes("group by status")) return { rows };
      if (sql.includes("lease_until < now()")) return { rows: [{ count: "2" }] };
      return { rows: [], rowCount: 1 };
    },
  };
  return { pool: pool as unknown as Pool, statements };
}

const rowPayload = {
    batchMetadata: { authorityCode: "MH-PCB", municipalCode: "MCGM-MUM", batchId: "b5e74bb0-b3a1-4fd7-ae67-c3c2a68d56ab", syncWindowTimestamp: "2026-10-19T02:30:00Z", sourceVersion: "synthetic-v1" },
    rawDataLogs: ["Waste collection record from authorized source"],
  };

const row = {
  id: "3b6f2a54-8cb2-4d0a-ae11-99a13e68b2b4",
  authority_code: "MH-PCB",
  municipal_code: "MCGM-MUM",
  batch_id: "b5e74bb0-b3a1-4fd7-ae67-c3c2a68d56ab",
  sync_window_timestamp: new Date("2026-10-19T02:30:00Z"),
  payload: rowPayload,
  payload_sha256: canonicalGovBridgeHash(rowPayload),
  attempts: 1,
  lease_token: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

test("worker claims a bounded batch and marks structurally valid payloads as internal-only validated", async () => {
  const { pool, statements } = fakePool([row]);
  const result = await runGovernmentInboxWorker(pool);
  assert.deepEqual(result, { claimed: 1, validated: 1, rejected: 0, unresolved: 0, retried: 0, quarantined: 0 });
  assert.match(statements[1]!.sql, /for update skip locked/i);
  assert.match(statements[3]!.sql, /lease_token=\$2/i);
  assert.match(statements[3]!.sql, /status='VALIDATED'/i);
});

test("worker keeps structurally valid but unmapped batches unresolved", async () => {
  const { pool, statements } = fakePool([row], []);
  const result = await runGovernmentInboxWorker(pool);
  assert.deepEqual(result, { claimed: 1, validated: 0, rejected: 0, unresolved: 1, retried: 0, quarantined: 0 });
  assert.match(statements[3]!.sql, /status='UNRESOLVED'/i);
  assert.equal(statements[3]!.values[2], "GOVERNMENT_CROSSWALK_NOT_FOUND");
});

test("worker keeps ambiguous crosswalk candidates unresolved instead of choosing one", async () => {
  const candidates = [
    { id: "crosswalk-a", organization_id: "organization-a", geography_id: "geography-a", activity_id: null, source_version: "synthetic-v1" },
    { id: "crosswalk-b", organization_id: "organization-b", geography_id: "geography-b", activity_id: null, source_version: "synthetic-v1" },
  ];
  const { pool, statements } = fakePool([row], candidates);
  const result = await runGovernmentInboxWorker(pool);
  assert.deepEqual(result, { claimed: 1, validated: 0, rejected: 0, unresolved: 1, retried: 0, quarantined: 0 });
  assert.match(statements[3]!.sql, /status='UNRESOLVED'/i);
  assert.equal(statements[3]!.values[2], "GOVERNMENT_CROSSWALK_AMBIGUOUS");
  const summary = JSON.parse(String(statements[3]!.values[3])) as Record<string, unknown>;
  assert.equal(summary.reason, "MULTIPLE_VERIFIED_JURISDICTION_CROSSWALKS");
  assert.equal(summary.officialAcceptance, false);
  assert.equal(summary.authoritativeMrvMutation, false);
  assert.equal(summary.guardianSubmission, false);
});

test("worker rejects metadata mismatch without retrying deterministic validation failures", async () => {
  const changedPayload = { ...row.payload as Record<string, any>, batchMetadata: { ...(row.payload as any).batchMetadata, municipalCode: "OTHER" } };
  const { pool } = fakePool([{ ...row, payload: changedPayload, payload_sha256: canonicalGovBridgeHash(changedPayload) }]);
  const result = await runGovernmentInboxWorker(pool);
  assert.equal(result.rejected, 1);
});

test("worker rejects payload changes that do not match the stored canonical hash", async () => {
  const changedPayload = { ...row.payload as Record<string, any>, rawDataLogs: ["Tampered source evidence record"] };
  const { pool, statements } = fakePool([{ ...row, payload: changedPayload }]);
  const result = await runGovernmentInboxWorker(pool);
  assert.equal(result.rejected, 1);
  assert.equal(statements[2]!.values[2], "BATCH_PAYLOAD_HASH_MISMATCH");
});

test("worker rejects payload/database sync-window timestamp divergence", async () => {
  const { pool, statements } = fakePool([{ ...row, sync_window_timestamp: new Date("2026-10-20T02:30:00Z") }]);
  const result = await runGovernmentInboxWorker(pool);
  assert.equal(result.rejected, 1);
  assert.equal(statements[2]!.values[2], "BATCH_TIMESTAMP_DATABASE_MISMATCH");
});

test("worker quarantines exhausted unclaimed inbox rows instead of leaving them stuck", async () => {
  const { pool, statements } = fakePool([]);
  await runGovernmentInboxWorker(pool, undefined, { maxAttempts: 3 });
  assert.match(statements[0]!.sql, /attempts >= \$1/i);
  assert.match(statements[0]!.sql, /status in \('RECEIVED','RETRY'\)/i);
  assert.match(statements[0]!.sql, /lease_until is null or lease_until < now\(\)/i);
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


test("government inbox timestamp validation checks calendar, clock, precision, and timezone boundaries", () => {
  const cases: Array<[string, boolean]> = [
    ["2026-02-30T02:30:00Z", false],
    ["2026-13-01T02:30:00Z", false],
    ["2024-02-29T02:30:00Z", true],
    ["2026-10-19T24:00:00Z", false],
    ["2026-10-19T02:60:00Z", false],
    ["2026-10-19T02:30:60Z", false],
    ["2026-10-19T02:30:00.123Z", true],
    ["2026-10-19T02:30:00.1234Z", false],
    ["2026-10-19T02:30:00", false],
    ["2026-10-19T02:30:00+05:30", true],
    ["2026-10-19T02:30:00-04:00", true],
    ["2026-10-19T02:30:00+25:00", false],
    ["2026-10-19T02:30:00+01:60", false],
    ["2026-10-19T02:30:00+24:00", false],
  ];
  for (const [timestamp, expected] of cases) {
    assert.equal(isValidSyncWindowTimestamp(timestamp), expected, timestamp);
  }
});


test("worker does not report success when both outcome and retry persistence fail", async () => {
  const attemptedWrites: string[] = [];
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("returning inbox.id")) return { rows: [row], rowCount: 1 };
      if (sql.includes("from government_jurisdiction_crosswalks c")) return { rows: [], rowCount: 0 };
      if (sql.includes("set status='UNRESOLVED'")) {
        attemptedWrites.push("outcome");
        throw new Error("synthetic outcome persistence failure");
      }
      if (sql.includes("set status=$3")) {
        attemptedWrites.push("retry");
        throw new Error("synthetic retry persistence failure");
      }
      return { rows: [], rowCount: 1 };
    },
  } as unknown as Pool;

  await assert.rejects(
    runGovernmentInboxWorker(pool),
    /synthetic retry persistence failure/,
  );
  assert.deepEqual(attemptedWrites, ["outcome", "retry"]);
});


test("worker renews its fenced lease while validation runs beyond the original lease window", async () => {
  const statements: string[] = [];
  const pool = {
    query: async (sql: string) => {
      statements.push(sql);
      if (sql.includes("returning inbox.id")) return { rows: [row], rowCount: 1 };
      if (sql.includes("set lease_until=now()")) return { rows: [], rowCount: 1 };
      if (sql.includes("from government_jurisdiction_crosswalks c")) {
        return { rows: [{ id: "crosswalk-id", organization_id: "organization-id", geography_id: "geography-id", activity_id: null, source_version: "synthetic-v1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
  } as unknown as Pool;

  const result = await runGovernmentInboxWorker(pool, async () => {
    await new Promise(resolve => setTimeout(resolve, 5_200));
    return { valid: true, summary: { validation: "SYNTHETIC_TEST_ONLY" } };
  }, { leaseSeconds: 15 });

  assert.equal(result.validated, 1);
  const renewal = statements.find(sql => sql.includes("set lease_until=now()"));
  assert.ok(renewal, "slow validation should trigger a lease renewal");
  assert.match(renewal, /where id=\$1 and status='PROCESSING' and lease_token=\$2 and lease_until > now\(\)/i);
  const terminal = statements.find(sql => sql.includes("set status='VALIDATED'"));
  assert.ok(terminal);
  assert.match(terminal, /where id=\$1 and status='PROCESSING' and lease_token=\$2 and lease_until > now\(\)/i);
});


test("worker cannot finalize an outcome after its lease token has been replaced", async () => {
  const statements: string[] = [];
  const pool = {
    query: async (sql: string) => {
      statements.push(sql);
      if (sql.includes("returning inbox.id")) return { rows: [row], rowCount: 1 };
      if (sql.includes("from government_jurisdiction_crosswalks c")) {
        return { rows: [{ id: "crosswalk-id", organization_id: "organization-id", geography_id: "geography-id", activity_id: null, source_version: "synthetic-v1" }], rowCount: 1 };
      }
      // Simulate another worker reclaiming the row and changing its lease token
      // before this worker's fenced terminal update.
      if (sql.includes("set status='VALIDATED'")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    },
  } as unknown as Pool;

  const result = await runGovernmentInboxWorker(pool);
  assert.equal(result.claimed, 1);
  assert.equal(result.validated, 0);
  const terminalUpdate = statements.find(sql => sql.includes("set status='VALIDATED'"));
  assert.ok(terminalUpdate);
  assert.match(terminalUpdate, /where id=\$1 and status='PROCESSING' and lease_token=\$2/i);
});


test("worker renews leases for later batch rows while an earlier row is slow", async () => {
  const secondRow = { ...row, id: "second-row-id", lease_token: "second-lease-token" };
  const statements: Array<{ sql: string; values?: unknown[] | undefined }> = [];
  const pool = {
    query: async (sql: string, values?: unknown[]) => {
      statements.push({ sql, values });
      if (sql.includes("returning inbox.id")) return { rows: [row, secondRow], rowCount: 2 };
      if (sql.includes("set lease_until=now()")) return { rows: [], rowCount: 1 };
      if (sql.includes("from government_jurisdiction_crosswalks c")) {
        return { rows: [{ id: "crosswalk-id", organization_id: "organization-id", geography_id: "geography-id", activity_id: null, source_version: "synthetic-v1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
  } as unknown as Pool;

  let calls = 0;
  const result = await runGovernmentInboxWorker(pool, async () => {
    calls += 1;
    if (calls === 1) await new Promise(resolve => setTimeout(resolve, 5_200));
    return { valid: true, summary: { validation: "SYNTHETIC_TEST_ONLY" } };
  }, { batchSize: 2, leaseSeconds: 15 });

  assert.equal(result.claimed, 2);
  assert.equal(result.validated, 2);
  const secondRowRenewal = statements.find(entry =>
    entry.sql.includes("set lease_until=now()") && entry.values?.[0] === "second-row-id");
  assert.ok(secondRowRenewal, "the second row's lease must renew before its sequential processing begins");
  assert.match(secondRowRenewal.sql, /lease_until > now\(\)/i);
});


test("worker does not finalize or retry a row after lease renewal reports lost ownership", async () => {
  const statements: string[] = [];
  const pool = {
    query: async (sql: string) => {
      statements.push(sql);
      if (sql.includes("returning inbox.id")) return { rows: [row], rowCount: 1 };
      if (sql.includes("set lease_until=now()")) return { rows: [], rowCount: 0 };
      if (sql.includes("from government_jurisdiction_crosswalks c")) {
        return { rows: [{ id: "crosswalk-id", organization_id: "organization-id", geography_id: "geography-id", activity_id: null, source_version: "synthetic-v1" }], rowCount: 1 };
      }
      if (sql.includes("set status='VALIDATED'") || sql.includes("set status=$3")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    },
  } as unknown as Pool;

  const result = await runGovernmentInboxWorker(pool, async () => {
    await new Promise(resolve => setTimeout(resolve, 5_200));
    return { valid: true, summary: { validation: "SYNTHETIC_TEST_ONLY" } };
  }, { leaseSeconds: 15 });

  assert.equal(result.validated, 0);
  assert.equal(result.retried, 0);
  assert.equal(statements.some(sql => sql.includes("set status='VALIDATED'")), false);
  assert.match(statements.find(sql => sql.includes("set status=$3")) ?? "", /lease_until > now\(\)/i);
});
