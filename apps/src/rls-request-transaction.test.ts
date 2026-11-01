import test from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import type { AuthContext } from "./auth.js";
import { RlsRequestContextError, withRlsRequestTransaction } from "./rls-request-transaction.js";

const auth: AuthContext = {
  identityId: "11111111-1111-4111-8111-111111111111",
  activeOrganizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  memberships: [{ organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role_id: "role-a", status: "VERIFIED" }],
};
const config = { hmacSecret: "unit-test-hmac-secret-material-which-is-long-enough", keyId: "test_key", ttlSeconds: 60 };

function fakePool(failOn?: string) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let released = 0;
  const client = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      if (sql === failOn) throw new Error("synthetic query failure");
      return { rows: [], rowCount: 0, command: "SELECT", oid: 0, fields: [] };
    },
    release() { released += 1; },
  } as unknown as PoolClient;
  return { calls, get released() { return released; }, pool: { async connect() { return client; } } };
}

test("opens transaction, sets signed context transaction-locally, commits and releases", async () => {
  const fake = fakePool();
  const result = await withRlsRequestTransaction(fake.pool, auth, config, async (client) => {
    await client.query("select protected_rows");
    return "ok";
  });
  assert.equal(result, "ok");
  assert.deepEqual(fake.calls.map((x) => x.sql), ["BEGIN", "select set_config('app.request_context', $1, true)", "select protected_rows", "COMMIT"]);
  const token = fake.calls[1]?.values?.[0];
  assert.equal(typeof token, "string");
  assert.match(String(token), /^11111111-1111-4111-8111-111111111111\|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\|[0-9]+\|[0-9]+\|test_key\.[a-f0-9]{64}$/);
  assert.equal(fake.released, 1);
});

test("rolls back and releases after an operation failure", async () => {
  const fake = fakePool("select fail");
  await assert.rejects(withRlsRequestTransaction(fake.pool, auth, config, async (client) => { await client.query("select fail"); }), /synthetic query failure/);
  assert.equal(fake.calls.at(-1)?.sql, "ROLLBACK");
  assert.equal(fake.released, 1);
});

test("does not acquire a connection without a verified single organization", async () => {
  let connects = 0;
  const pool = { async connect() { connects += 1; throw new Error("must not connect"); } };
  const missing = { ...auth, activeOrganizationId: undefined };
  await assert.rejects(withRlsRequestTransaction(pool, missing, config, async () => undefined), (error: unknown) => error instanceof RlsRequestContextError && error.code === "RLS_ORGANIZATION_CONTEXT_REQUIRED");
  const pending = { ...auth, memberships: [{ ...auth.memberships[0]!, status: "PENDING" }] };
  await assert.rejects(withRlsRequestTransaction(pool, pending, config, async () => undefined), (error: unknown) => error instanceof RlsRequestContextError && error.code === "RLS_VERIFIED_MEMBERSHIP_REQUIRED");
  assert.equal(connects, 0);
});

test("fails closed for bilateral settlement context until multi-party policies exist", async () => {
  let connects = 0;
  const pool = { async connect() { connects += 1; throw new Error("must not connect"); } };
  await assert.rejects(withRlsRequestTransaction(pool, { ...auth, bilateralOrganizationScope: true }, config, async () => undefined), (error: unknown) => error instanceof RlsRequestContextError && error.code === "RLS_BILATERAL_CONTEXT_UNSUPPORTED");
  assert.equal(connects, 0);
});
