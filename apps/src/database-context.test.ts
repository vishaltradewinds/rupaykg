import test from "node:test";
import assert from "node:assert/strict";
import { Pool, type PoolClient } from "pg";
import { createTenantTransaction, tenantDatabaseContextFromAuth } from "./database-context.js";

const context = {
  identityId: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
};

function fakePool(options: { failAt?: string } = {}) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let released = 0;
  const client = {
    async query(sql: string, values?: unknown[]) {
      calls.push(values === undefined ? { sql } : { sql, values });
      if (options.failAt === sql) throw new Error("simulated database failure");
      return { rows: [] };
    },
    release() { released += 1; },
  };
  const pool = {
    async connect() { return client; },
  };
  return { pool: pool as unknown as Pool, calls, released: () => released };
}

test("tenant transaction sets verified identity and organization transaction-locally on one client", async () => {
  const fake = fakePool();
  const run = createTenantTransaction(fake.pool);
  const value = await run(context, async (client) => {
    await client.query("select 42");
    return "ok";
  });
  assert.equal(value, "ok");
  assert.deepEqual(fake.calls.map((call) => call.sql), [
    "BEGIN",
    "select set_config('rupaykg.identity_id', $1, true), set_config('rupaykg.organization_id', $2, true)",
    "select 42",
    "COMMIT",
  ]);
  assert.deepEqual(fake.calls[1]?.values, [context.identityId, context.organizationId]);
  assert.equal(fake.released(), 1);
});

test("tenant transaction rolls back and releases client when work fails", async () => {
  const fake = fakePool();
  const run = createTenantTransaction(fake.pool);
  await assert.rejects(
    run(context, async () => { throw new Error("work failed"); }),
    /work failed/,
  );
  assert.equal(fake.calls.at(-1)?.sql, "ROLLBACK");
  assert.equal(fake.released(), 1);
});

test("tenant transaction preserves original error if rollback also fails", async () => {
  const fake = fakePool({ failAt: "ROLLBACK" });
  const run = createTenantTransaction(fake.pool);
  await assert.rejects(
    run(context, async () => { throw new Error("original failure"); }),
    /original failure/,
  );
  assert.equal(fake.released(), 1);
});

test("invalid identity or organization context fails before acquiring a connection", async () => {
  const fake = fakePool();
  const run = createTenantTransaction(fake.pool);
  await assert.rejects(
    run({ ...context, identityId: "not-a-uuid" }, async () => "unreachable"),
    /identityId must be a UUID/,
  );
  await assert.rejects(
    run({ ...context, organizationId: "" }, async () => "unreachable"),
    /organizationId must be a UUID/,
  );
  assert.equal(fake.calls.length, 0);
  assert.equal(fake.released(), 0);
});

test("tenant context is derived only from a verified active membership", () => {
  const auth = {
    identityId: context.identityId,
    activeOrganizationId: context.organizationId,
    memberships: [{ organization_id: context.organizationId, role_id: "role-1", status: "VERIFIED" }],
  };
  assert.deepEqual(tenantDatabaseContextFromAuth(auth), context);
});

test("tenant context rejects missing or unverified active membership", () => {
  assert.throws(
    () => tenantDatabaseContextFromAuth({
      identityId: context.identityId,
      memberships: [{ organization_id: context.organizationId, role_id: "role-1", status: "VERIFIED" }],
    }),
    /verified active organization is required/,
  );
  assert.throws(
    () => tenantDatabaseContextFromAuth({
      identityId: context.identityId,
      activeOrganizationId: context.organizationId,
      memberships: [{ organization_id: context.organizationId, role_id: "role-1", status: "PENDING" }],
    }),
    /verified active organization is required/,
  );
});

const databaseIntegrationEnabled = process.env.CI === "true"
  && process.env.NODE_ENV !== "production"
  && process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1"
  && Boolean(process.env.DATABASE_URL);

test("tenant context does not leak when a pooled PostgreSQL connection is reused", {
  skip: !databaseIntegrationEnabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: true },
    max: 1,
  });
  try {
    const run = createTenantTransaction(pool);
    const first = {
      identityId: "33333333-3333-4333-8333-333333333333",
      organizationId: "44444444-4444-4444-8444-444444444444",
    };
    const second = {
      identityId: "55555555-5555-4555-8555-555555555555",
      organizationId: "66666666-6666-4666-8666-666666666666",
    };
    const readContext = async (client: PoolClient) => {
      const result = await client.query<{ identity_id: string | null; organization_id: string | null }>(
        "select current_setting('rupaykg.identity_id', true) identity_id, current_setting('rupaykg.organization_id', true) organization_id",
      );
      return result.rows[0];
    };
    assert.deepEqual(await run(first, readContext), {
      identity_id: first.identityId,
      organization_id: first.organizationId,
    });
    const afterCommit = await pool.query<{ identity_id: string | null; organization_id: string | null }>(
      "select current_setting('rupaykg.identity_id', true) identity_id, current_setting('rupaykg.organization_id', true) organization_id",
    );
    assert.equal(afterCommit.rows[0]?.identity_id, null);
    assert.equal(afterCommit.rows[0]?.organization_id, null);
    assert.deepEqual(await run(second, readContext), {
      identity_id: second.identityId,
      organization_id: second.organizationId,
    });
  } finally {
    await pool.end();
  }
});
