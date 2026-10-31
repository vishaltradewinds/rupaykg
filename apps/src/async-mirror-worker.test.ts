import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { isValidSyncWindowTimestamp, reconcileGovernmentInbox, runGovernmentInboxWorker, validateGovernmentInboxPayload } from "./async-mirror-worker.js";
import { canonicalGovBridgeHash } from "./government-inbox-hash.js";

function fakePool(rows: unknown[], crosswalkRows?: unknown[]) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const query = async (sql: string, values: unknown[] = []) => {
    statements.push({ sql, values });
    if (sql.includes("returning inbox.id")) return { rows, rowCount: rows.length };
    if (sql.includes("from government_jurisdiction_crosswalks c")) return { rows: crosswalkRows ?? [{
      id: "crosswalk-id", organization_id: "organization-id", geography_id: "geography-id", activity_id: null,
      source_version: "synthetic-v1", source_snapshot_id: "snapshot-id", snapshot_content_sha256: "a".repeat(64),
      snapshot_dataset_code: "SYNTHETIC", snapshot_scope_kind: "OTHER", snapshot_scope_code: "TEST",
      snapshot_scope_geography_id: "geography-id", snapshot_scope_directory_source_id: "directory-id",
    }], rowCount: (crosswalkRows ?? [{}]).length };
    if (sql.includes("group by status")) return { rows };
    if (sql.includes("lease_until < now()")) return { rows: [{ count: "2" }] };
    return { rows: [], rowCount: 1 };
  };
  const pool = { query, connect: async () => ({ query, release: () => undefined }) };
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
  assert.equal(statements.length, 7, "atomic claim, lease refresh, serializable key lock and source resolution, fenced terminal update, and commit");
  assert.match(statements[0]!.sql, /with exhausted as \(/i);
  assert.match(statements[0]!.sql, /for update skip locked/i);
  assert.match(statements[0]!.sql, /returning inbox\.id/i);
  assert.match(statements[2]!.sql, /begin isolation level serializable/i);
  assert.match(statements[3]!.sql, /pg_advisory_xact_lock/i);
  assert.match(statements[4]!.sql, /for share of c,s/i);
  assert.match(statements[4]!.sql, /content_sha256/i);
  assert.match(statements[5]!.sql, /lease_token=\$2/i);
  assert.match(statements[5]!.sql, /lease_until > now\(\)/i);
  assert.match(statements[5]!.sql, /status='VALIDATED'/i);
  const validationSummary = JSON.parse(String(statements[5]!.values[2])) as Record<string, any>;
  assert.equal(validationSummary.jurisdictionCrosswalk.sourceSnapshot.id, "snapshot-id");
  assert.equal(validationSummary.jurisdictionCrosswalk.sourceSnapshot.contentSha256, "a".repeat(64));
  assert.equal(statements[6]!.sql, "COMMIT");
});

test("worker aborts and retries a validator that exceeds its strict deadline", async () => {
  const { pool, statements } = fakePool([row]);
  let observedSignal: AbortSignal | undefined;
  const result = await runGovernmentInboxWorker(pool, async (input) => {
    observedSignal = input.signal;
    return new Promise(() => undefined);
  }, { validationTimeoutSeconds: 1 });
  assert.equal(result.retried, 1);
  assert.equal(observedSignal?.aborted, true);
  const retry = statements.find((entry) => entry.sql.includes("next_attempt_at=case when"));
  assert.equal(retry?.values[4], "VALIDATION_TIMEOUT");
});

test("worker renews all claimed leases while a validator is running", async () => {
  const { pool, statements } = fakePool([row]);
  const result = await runGovernmentInboxWorker(pool, async () => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return { valid: true, summary: { validation: "TEST" } };
  }, { leaseSeconds: 15, leaseRenewalSeconds: 1, validationTimeoutSeconds: 5 });
  assert.equal(result.validated, 1);
  const renewal = statements.find((entry) => entry.sql.includes("update async_mirror_inbox inbox") && entry.sql.includes("unnest"));
  assert.ok(renewal, "a live lease renewal must be issued during validation");
  assert.match(renewal!.sql, /lease_until > now\(\)/i);
});

test("worker keeps structurally valid but unmapped batches unresolved", async () => {
  const { pool, statements } = fakePool([row], []);
  const result = await runGovernmentInboxWorker(pool);
  assert.deepEqual(result, { claimed: 1, validated: 0, rejected: 0, unresolved: 1, retried: 0, quarantined: 0 });
  assert.match(statements[5]!.sql, /status='UNRESOLVED'/i);
  assert.equal(statements[5]!.values[2], "GOVERNMENT_CROSSWALK_NOT_FOUND");
  assert.equal(statements[6]!.sql, "COMMIT");
});

test("worker keeps ambiguous crosswalk candidates unresolved instead of choosing one", async () => {
  const candidates = [
    { id: "crosswalk-a", organization_id: "organization-a", geography_id: "geography-a", activity_id: null, source_version: "synthetic-v1" },
    { id: "crosswalk-b", organization_id: "organization-b", geography_id: "geography-b", activity_id: null, source_version: "synthetic-v1" },
  ];
  const { pool, statements } = fakePool([row], candidates);
  const result = await runGovernmentInboxWorker(pool);
  assert.deepEqual(result, { claimed: 1, validated: 0, rejected: 0, unresolved: 1, retried: 0, quarantined: 0 });
  assert.match(statements[5]!.sql, /status='UNRESOLVED'/i);
  assert.equal(statements[5]!.values[2], "GOVERNMENT_CROSSWALK_AMBIGUOUS");
  const summary = JSON.parse(String(statements[5]!.values[3])) as Record<string, unknown>;
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
  assert.equal(statements[1]!.values[2], "BATCH_PAYLOAD_HASH_MISMATCH");
});

test("worker rejects payload/database sync-window timestamp divergence", async () => {
  const { pool, statements } = fakePool([{ ...row, sync_window_timestamp: new Date("2026-10-20T02:30:00Z") }]);
  const result = await runGovernmentInboxWorker(pool);
  assert.equal(result.rejected, 1);
  assert.equal(statements[1]!.values[2], "BATCH_TIMESTAMP_DATABASE_MISMATCH");
});

test("worker quarantines exhausted unclaimed inbox rows instead of leaving them stuck", async () => {
  const { pool, statements } = fakePool([]);
  await runGovernmentInboxWorker(pool, undefined, { maxAttempts: 3 });
  assert.match(statements[0]!.sql, /attempts >= \$3/i);
  assert.match(statements[0]!.sql, /status in \('RECEIVED','RETRY'\)/i);
  assert.match(statements[0]!.sql, /lease_until is null or lease_until < now\(\)/i);
  assert.match(statements[0]!.sql, /with exhausted as \(/i);
  assert.match(statements[0]!.sql, /for update skip locked/i);
});

test("worker retries transient errors and quarantines an exhausted attempt", async () => {
  const { pool, statements } = fakePool([{ ...row, attempts: 1 }]);
  const retry = await runGovernmentInboxWorker(pool, async () => { throw new Error("temporary outage"); }, { maxAttempts: 3 });
  assert.equal(retry.retried, 1);
  assert.match(statements[1]!.sql, /next_attempt_at=case when \$3='RETRY'/i);

  const exhaustedPool = fakePool([{ ...row, attempts: 3 }]);
  const exhausted = await runGovernmentInboxWorker(exhaustedPool.pool, async () => { throw new Error("still unavailable"); }, { maxAttempts: 3 });
  assert.equal(exhausted.quarantined, 1);
  assert.match(exhaustedPool.statements[1]!.sql, /quarantined_at=case when \$3='QUARANTINED'/i);
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
  assert.match(statements[1]!.sql, /lease_until is null or lease_until < now\(\)/i);
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
