import test from "node:test";
import assert from "node:assert/strict";
import { readDatabaseRoleDiagnostic } from "./database-role-diagnostic.js";

test("database role diagnostic returns only identity and privilege booleans", async () => {
  let receivedSql = "";
  const expected = {
    current_user: "app_runtime",
    session_user: "app_runtime",
    is_superuser: false,
    bypasses_rls: false,
    can_create_roles: false,
    can_create_databases: false,
    can_create_in_public_schema: false,
    can_delete_verifications: false,
    can_truncate_verifications: false,
    can_trigger_verifications: false,
  };
  const fakePool = {
    query: async (sql: string) => {
      receivedSql = sql;
      return { rows: [expected] };
    },
  };
  const result = await readDatabaseRoleDiagnostic(fakePool as never);
  assert.deepEqual(result, expected);
  assert.match(receivedSql, /current_user/);
  assert.match(receivedSql, /session_user/);
  assert.match(receivedSql, /rolbypassrls/);
  assert.doesNotMatch(receivedSql, /DATABASE_URL|password|secret|credential/i);
  assert.equal(Object.keys(result).some((key) => /password|secret|url|credential/i.test(key)), false);
});

test("database role diagnostic fails closed if the database cannot resolve current role", async () => {
  const fakePool = { query: async () => ({ rows: [] }) };
  await assert.rejects(
    readDatabaseRoleDiagnostic(fakePool as never),
    /DATABASE_ROLE_DIAGNOSTIC_NO_CURRENT_ROLE/,
  );
});
