import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient } from "pg";
import {
  beginRequestDatabaseContext,
  createContextAwarePool,
  finishRequestDatabaseContext,
  runWithRequestDatabaseContext,
} from "./tenant-db-context.js";
import type { AuthContext } from "./auth.js";

type Call = { sql: string; values?: unknown[] };

class FakeClient {
  calls: Call[] = [];
  released = false;
  releaseError?: Error | boolean;
  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, values });
    return { rows: [], rowCount: 0, command: sql.split(/\s+/)[0]?.toUpperCase() ?? "" };
  }
  release(error?: Error | boolean) {
    this.released = true;
    this.releaseError = error;
  }
}

class FakePool {
  clients: FakeClient[] = [];
  rawQueries: Call[] = [];
  async connect() {
    const client = new FakeClient();
    this.clients.push(client);
    return client;
  }
  async query(sql: string, values?: unknown[]) {
    this.rawQueries.push({ sql, values });
    return { rows: [], rowCount: 0 };
  }
}

const auth: AuthContext = {
  identityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  activeOrganizationId: "11111111-1111-4111-8111-111111111111",
  memberships: [
    { organization_id: "11111111-1111-4111-8111-111111111111", role_id: "r1", status: "VERIFIED" },
    { organization_id: "22222222-2222-4222-8222-222222222222", role_id: "r2", status: "VERIFIED" },
  ],
};

test("request context binds pool.query and pool.connect to one transaction client", async () => {
  const raw = new FakePool();
  const pool = raw as unknown as Pool;
  const context = await beginRequestDatabaseContext(pool, auth);
  const scoped = createContextAwarePool(pool);

  await runWithRequestDatabaseContext(context, async () => {
    await scoped.query("select 'request-query'");
    const client = await scoped.connect();
    await client.query("BEGIN");
    await client.query("update tenant_rows set value='nested'");
    await client.query("COMMIT");
    client.release();
  });

  await finishRequestDatabaseContext(context, true);
  const calls = raw.clients[0]!.calls;
  assert.deepEqual(calls.map((call) => call.sql), [
    "BEGIN",
    "select\n         set_config('app.identity_id', $1, true),\n         set_config('app.active_organization_id', $2, true),\n         set_config('app.organization_ids', $3, true),\n         set_config('app.bilateral_organization_scope', $4, true)",
    "select 'request-query'",
    "SAVEPOINT rupaykg_request_sp_1",
    "update tenant_rows set value='nested'",
    "RELEASE SAVEPOINT rupaykg_request_sp_1",
    "COMMIT",
  ]);
  assert.deepEqual(calls[1]!.values, [
    auth.identityId,
    auth.activeOrganizationId,
    auth.activeOrganizationId,
    "false",
  ]);
  assert.equal(raw.rawQueries.length, 0);
  assert.equal(raw.clients[0]!.released, true);
});

test("nested ROLLBACK maps to savepoint rollback and does not end the request transaction", async () => {
  const raw = new FakePool();
  const context = await beginRequestDatabaseContext(raw as unknown as Pool, auth);
  const scoped = createContextAwarePool(raw as unknown as Pool);

  await runWithRequestDatabaseContext(context, async () => {
    const client = await scoped.connect();
    await client.query("BEGIN");
    await client.query("insert into tenant_rows values (1)");
    await client.query("ROLLBACK");
    client.release();
  });
  await finishRequestDatabaseContext(context, true);

  assert.deepEqual(raw.clients[0]!.calls.slice(-4).map((call) => call.sql), [
    "SAVEPOINT rupaykg_request_sp_1",
    "insert into tenant_rows values (1)",
    "ROLLBACK TO SAVEPOINT rupaykg_request_sp_1",
    "RELEASE SAVEPOINT rupaykg_request_sp_1",
  ]);
  assert.equal(raw.clients[0]!.calls.at(-1)?.sql, "COMMIT");
});

test("an unclosed nested transaction fails closed and rolls back the request", async () => {
  const raw = new FakePool();
  const context = await beginRequestDatabaseContext(raw as unknown as Pool, auth);
  const scoped = createContextAwarePool(raw as unknown as Pool);
  await runWithRequestDatabaseContext(context, async () => {
    const client = await scoped.connect();
    await client.query("BEGIN");
    client.release();
  });

  await assert.rejects(() => finishRequestDatabaseContext(context, true), /UNCLOSED_SAVEPOINT/);
  assert.equal(raw.clients[0]!.calls.at(-1)?.sql, "ROLLBACK");
  assert.equal(raw.clients[0]!.released, true);
  assert.ok(raw.clients[0]!.releaseError instanceof Error);
});

test("a borrowed client release error marks the outer request transaction for rollback", async () => {
  const raw = new FakePool();
  const context = await beginRequestDatabaseContext(raw as unknown as Pool, auth);
  const scoped = createContextAwarePool(raw as unknown as Pool);
  await runWithRequestDatabaseContext(context, async () => {
    const client = await scoped.connect();
    client.release(new Error("route client failed"));
  });
  await finishRequestDatabaseContext(context, true);
  assert.equal(raw.clients[0]!.calls.at(-1)?.sql, "ROLLBACK");
});

test("concurrent request contexts never share their database clients", async () => {
  const raw = new FakePool();
  const pool = raw as unknown as Pool;
  const [a, b] = await Promise.all([
    beginRequestDatabaseContext(pool, { ...auth, identityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    beginRequestDatabaseContext(pool, { ...auth, identityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
  ]);
  const scoped = createContextAwarePool(pool);

  await Promise.all([
    runWithRequestDatabaseContext(a, async () => {
      await new Promise((resolve) => setImmediate(resolve));
      await scoped.query("select 'a'");
    }),
    runWithRequestDatabaseContext(b, async () => {
      await new Promise((resolve) => setImmediate(resolve));
      await scoped.query("select 'b'");
    }),
  ]);
  await Promise.all([finishRequestDatabaseContext(a, true), finishRequestDatabaseContext(b, true)]);

  assert.ok(raw.clients[0]!.calls.some((call) => call.sql === "select 'a'"));
  assert.ok(!raw.clients[0]!.calls.some((call) => call.sql === "select 'b'"));
  assert.ok(raw.clients[1]!.calls.some((call) => call.sql === "select 'b'"));
  assert.ok(!raw.clients[1]!.calls.some((call) => call.sql === "select 'a'"));
});

test("bilateral settlement context carries all verified organizations while normal context carries only active org", async () => {
  const raw = new FakePool();
  const bilateral = await beginRequestDatabaseContext(raw as unknown as Pool, { ...auth, bilateralOrganizationScope: true });
  assert.deepEqual(raw.clients[0]!.calls[1]!.values, [
    auth.identityId,
    auth.activeOrganizationId,
    "11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222",
    "true",
  ]);
  await finishRequestDatabaseContext(bilateral, false);
});
