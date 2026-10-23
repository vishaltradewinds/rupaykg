import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { consumeAiIntakeRateLimit } from "./intelligence-routes.js";

test("AI intake limiter uses a database-atomic fixed-window counter scoped to identity and organization", async () => {
  let captured: { sql: string; values: unknown[] } | undefined;
  const pool = {
    query: async (sql: string, values: unknown[]) => {
      captured = { sql, values };
      return { rows: [{ request_count: 1 }] };
    },
  } as unknown as Pool;
  assert.equal(await consumeAiIntakeRateLimit(pool, "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"), true);
  assert.ok(captured);
  assert.match(captured.sql, /on conflict \(identity_id, organization_id, window_start\)/i);
  assert.match(captured.sql, /request_count < 10/i);
  assert.match(captured.sql, /returning request_count/i);
  assert.deepEqual(captured.values, ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"]);
});

test("AI intake limiter denies attempts after the database counter reaches its cap", async () => {
  const pool = {
    query: async () => ({ rows: [] }),
  } as unknown as Pool;
  assert.equal(await consumeAiIntakeRateLimit(pool, "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"), false);
});
