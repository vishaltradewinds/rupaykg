import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { executeAgenticReadTools } from "./agentic-tool-handlers.js";

function fakePool(rows: unknown[]) {
  const calls: Array<{ sql: string; values: unknown[] | undefined }> = [];
  const pool = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rows, rowCount: rows.length };
    },
  } as unknown as Pool;
  return { pool, calls };
}

test("read handlers use fixed parameterized queries scoped to organization and geography", async () => {
  const { pool, calls } = fakePool([{ id: "activity-1", measurement_count: "2", evidence_count: "3", verified_count: "1" }]);
  const result = await executeAgenticReadTools(pool, {
    goal: "prepare_compliance",
    organizationId: "org-1",
    geographyId: "00000000-0000-4000-8000-000000000001",
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.values, ["org-1", "00000000-0000-4000-8000-000000000001"]);
  assert.match(calls[0]!.sql, /a\.organization_id=\$1/);
  assert.match(calls[0]!.sql, /organization_has_geography_scope/);
  assert.match(calls[0]!.sql, /limit 100/i);
  assert.deepEqual(result.sourceRecordIds, ["activity-1"]);
  assert.equal(result.measurementCount, 2);
  assert.equal(result.evidenceCount, 3);
  assert.equal(result.verifiedCount, 1);
  assert.deepEqual(result.toolIds, ["activities.list", "evidence.count", "verifications.count"]);
});

test("onboarding handler returns only bounded application IDs and aggregate evidence counts", async () => {
  const { pool, calls } = fakePool([{ id: "application-1", evidence_count: "2", verified_count: "1" }]);
  const result = await executeAgenticReadTools(pool, {
    goal: "onboard_stakeholder",
    organizationId: "org-2",
    geographyId: null,
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]!.values, ["org-2", null]);
  assert.match(calls[0]!.sql, /stakeholder_applications/);
  assert.match(calls[0]!.sql, /limit 100/i);
  assert.deepEqual(result.sourceRecordIds, ["application-1"]);
  assert.equal(result.measurementCount, 0);
  assert.equal(result.evidenceCount, 2);
  assert.equal(result.verifiedCount, 1);
  assert.deepEqual(result.toolIds, ["stakeholder_applications.list", "organization_verification.count"]);
});

test("read handler propagates database failure rather than fabricating evidence", async () => {
  const pool = { query: async () => { throw new Error("database unavailable"); } } as unknown as Pool;
  await assert.rejects(() => executeAgenticReadTools(pool, {
    goal: "trace_resource_flow",
    organizationId: "org-3",
    geographyId: null,
  }), /database unavailable/);
});
