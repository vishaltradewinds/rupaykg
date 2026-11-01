import test from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { withSignedRequestDatabaseContext } from "./request-database-context.js";

const auth = {
  identityId: "11111111-1111-4111-8111-111111111111",
  activeOrganizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  memberships: [{
    organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    role_id: "role-1",
    status: "VERIFIED",
  }],
};
const options = {
  secret: "test-only-hmac-secret-material-32-bytes-minimum",
  keyId: "test-key",
};

function fakePool(failAt?: string) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let released = false;
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push(values === undefined ? { sql } : { sql, values });
      if (sql === failAt) throw new Error("synthetic query failure");
      return { rows: [] };
    },
    release: () => { released = true; },
  };
  return {
    calls,
    get released() { return released; },
    pool: { connect: async () => client as unknown as PoolClient },
  };
}

test("request database context pins BEGIN, signed context, work and COMMIT to one client", async () => {
  const fake = fakePool();
  const result = await withSignedRequestDatabaseContext(
    fake.pool,
    auth,
    options,
    async (client) => {
      await client.query("select tenant_rows");
      return "ok";
    },
  );
  assert.equal(result, "ok");
  assert.deepEqual(fake.calls.map((call) => call.sql), [
    "begin",
    "select set_config('app.request_context', $1, true)",
    "select tenant_rows",
    "commit",
  ]);
  const context = String(fake.calls[1]?.values?.[0] ?? "");
  const [payload, signature] = context.split(".");
  assert.ok(payload);
  assert.match(signature ?? "", /^[0-9a-f]{64}$/);
  assert.equal(fake.released, true);
});

test("request database context rolls back and releases after work fails", async () => {
  const fake = fakePool("select tenant_rows");
  await assert.rejects(
    withSignedRequestDatabaseContext(fake.pool, auth, options, async (client) => {
      await client.query("select tenant_rows");
      return "unreachable";
    }),
    /synthetic query failure/,
  );
  assert.deepEqual(fake.calls.map((call) => call.sql), [
    "begin",
    "select set_config('app.request_context', $1, true)",
    "select tenant_rows",
    "rollback",
  ]);
  assert.equal(fake.released, true);
});

test("request database context refuses unverified active organization before acquiring a client", async () => {
  const fake = fakePool();
  await assert.rejects(
    withSignedRequestDatabaseContext(
      fake.pool,
      { ...auth, memberships: [{ ...auth.memberships[0]!, status: "PENDING" }] },
      options,
      async () => "unreachable",
    ),
    /membership is not verified/,
  );
  assert.equal(fake.calls.length, 0);
  assert.equal(fake.released, false);
});
