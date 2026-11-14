import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import type { AuthContext } from "./auth.js";
import { withTenantTransaction } from "./tenant-db.js";

const identityId = "123e4567-e89b-42d3-a456-426614174000";
const organizationId = "223e4567-e89b-42d3-a456-426614174000";
const auth = {
  identityId,
  activeOrganizationId: organizationId,
  contextToken: "opaque-test-context",
  memberships: [{ organization_id: organizationId, status: "VERIFIED" }],
} as unknown as AuthContext;

function testPool(statements: string[]): Pool {
  const client = {
    query: async (sql: string) => { statements.push(sql); return { rows: [] }; },
    release: () => undefined,
  };
  return { connect: async () => client } as unknown as Pool;
}

test("read snapshot starts REPEATABLE READ READ ONLY before runtime role and tenant context", async () => {
  const statements: string[] = [];
  const result = await withTenantTransaction(testPool(statements), auth, async client => {
    await client.query("select 1");
    return "snapshot";
  }, { isolationLevel: "REPEATABLE READ", readOnly: true });

  assert.equal(result, "snapshot");
  assert.equal(statements[0], "begin isolation level repeatable read read only");
  const roleIndex = statements.indexOf("set local role rupaykg_app_runtime");
  const contextIndex = statements.findIndex(sql => sql.includes("app.set_request_context"));
  const readIndex = statements.indexOf("select 1");
  assert.ok(roleIndex > 0);
  assert.ok(contextIndex > roleIndex);
  assert.ok(readIndex > contextIndex);
  assert.equal(statements.at(-1), "commit");
});

test("repeatable-read write transaction omits READ ONLY for immutable report-run persistence", async () => {
  const statements: string[] = [];
  await withTenantTransaction(testPool(statements), auth, async client => {
    await client.query("insert into report_runs default values");
  }, { isolationLevel: "REPEATABLE READ" });

  assert.equal(statements[0], "begin isolation level repeatable read");
  assert.equal(statements[0].includes("read only"), false);
  assert.equal(statements.at(-1), "commit");
});
