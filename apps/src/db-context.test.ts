import test from "node:test";
import assert from "node:assert/strict";
import { withDatabaseTenantContext } from "./db-context.js";

function fakePool() {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  let released = false;
  let committed = false;
  let rolledBack = false;

  const client = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };

  return {
    calls,
    get released() { return released; },
    get committed() { return committed; },
    get rolledBack() { return rolledBack; },
    pool: {
      async connect() {
        return client;
      },
    } as any,
    markCommit() { committed = true; },
    markRollback() { rolledBack = true; },
  };
}

test("binds tenant context with transaction-scoped SET LOCAL semantics", async () => {
  const state = fakePool();
  const result = await withDatabaseTenantContext(
    state.pool,
    {
      identityId: "identity-1",
      organizationId: "organization-1",
      bilateralOrganizationScope: true,
      serviceMode: false,
    },
    async (client) => {
      await client.query("select current_setting('app.rupaykg.organization_id', true)");
      return "ok";
    },
  );

  assert.equal(result, "ok");
  assert.deepEqual(state.calls, [
    { text: "BEGIN", values: undefined },
    { text: "select set_config('app.rupaykg.identity_id', $1, true)", values: ["identity-1"] },
    { text: "select set_config('app.rupaykg.organization_id', $1, true)", values: ["organization-1"] },
    { text: "select set_config('app.rupaykg.bilateral_scope', $1, true)", values: ["true"] },
    { text: "select set_config('app.rupaykg.service_mode', $1, true)", values: ["false"] },
    { text: "select current_setting('app.rupaykg.organization_id', true)", values: undefined },
    { text: "COMMIT", values: undefined },
  ]);
  assert.equal(state.released, true);
});

test("rolls back and releases the pooled client when protected work fails", async () => {
  const state = fakePool();
  const expected = new Error("protected write failed");

  await assert.rejects(
    withDatabaseTenantContext(
      state.pool,
      { identityId: "identity-1", organizationId: "organization-1" },
      async () => {
        throw expected;
      },
    ),
    expected,
  );

  assert.equal(state.calls.at(-1)?.text, "ROLLBACK");
  assert.equal(state.released, true);
});
