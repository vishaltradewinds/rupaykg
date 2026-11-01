import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { assertAuthenticationPoolContract } from "./auth-db-contract.js";

function fakePool(role: Record<string, unknown>, verifierRows: Array<{ identity_id: string | null }> = [{ identity_id: null }]) {
  const calls: string[] = [];
  const pool = {
    calls,
    async query(sql: string) {
      calls.push(sql);
      if (/pg_catalog\.pg_roles/.test(sql)) return { rows: [role] };
      if (/verify_identity_session/.test(sql)) return { rows: verifierRows };
      throw new Error("Unexpected authentication pool query");
    },
  };
  return pool as unknown as Pool & { calls: string[] };
}

const safeRole = {
  role_name: "rupaykg_auth_login",
  can_login: true,
  is_superuser: false,
  can_create_db: false,
  can_create_role: false,
  can_replicate: false,
  bypasses_rls: false,
  inherits: true,
  has_auth_capability: true,
  inherits_privileged_role: false,
};

test("accepts only a non-privileged login inheriting the auth capability", async () => {
  const pool = fakePool(safeRole);
  await assertAuthenticationPoolContract(pool);
  assert.equal(pool.calls.length, 2);
});

test("rejects BYPASSRLS and privileged inherited roles", async () => {
  await assert.rejects(() => assertAuthenticationPoolContract(fakePool({ ...safeRole, bypasses_rls: true })), /AUTH_DATABASE_ROLE_INVALID/);
  await assert.rejects(() => assertAuthenticationPoolContract(fakePool({ ...safeRole, inherits_privileged_role: true })), /AUTH_DATABASE_ROLE_INVALID/);
});

test("rejects a login without the restricted capability role", async () => {
  await assert.rejects(() => assertAuthenticationPoolContract(fakePool({ ...safeRole, has_auth_capability: false })), /AUTH_DATABASE_ROLE_INVALID/);
});

test("rejects an incorrectly behaving session verifier", async () => {
  await assert.rejects(() => assertAuthenticationPoolContract(fakePool(safeRole, [{ identity_id: "11111111-1111-4111-8111-111111111111" }])), /AUTH_DATABASE_VERIFIER_INVALID/);
});
