import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { assertEprReturnReadDatabaseContract } from "./epr-return-read-contract.js";

const validRow = {
  connection_role: "rupaykg_app_runtime",
  runtime_role_valid: true,
  no_role_memberships: true,
  returns_rls_enabled: true,
  returns_force_rls: true,
  returns_owner: "rupaykg_app_owner",
  policy_count: "1",
  expected_policy_count: "1",
  can_select_returns: true,
  can_insert_returns: false,
  can_update_returns: false,
  can_delete_returns: false,
  can_select_schemes: true,
  can_insert_schemes: false,
  can_update_schemes: false,
  can_delete_schemes: false,
  can_read_signing_keys: false,
  can_create_public: false,
  can_create_database: false,
  verifier_schema_usage: true,
  verifier_execute: true,
  verifier_valid: true,
};

function fakePool(row: Record<string, unknown>): Pool {
  return {
    async query() { return { rows: [row], rowCount: 1 }; },
  } as unknown as Pool;
}

test("accepts only the dedicated read-only EPR runtime contract", async () => {
  await assert.doesNotReject(assertEprReturnReadDatabaseContract(fakePool(validRow)));
});

test("fails closed when the verifier owner or pinned search_path is invalid", async () => {
  await assert.rejects(
    assertEprReturnReadDatabaseContract(fakePool({ ...validRow, verifier_valid: false })),
    /EPR_RETURN_READ_DATABASE_CONTRACT_INVALID/,
  );
});

test("fails closed when RLS is not forced", async () => {
  await assert.rejects(
    assertEprReturnReadDatabaseContract(fakePool({ ...validRow, returns_force_rls: false })),
    /EPR_RETURN_READ_DATABASE_CONTRACT_INVALID/,
  );
});

test("fails closed when the runtime can create public objects or databases", async () => {
  await assert.rejects(
    assertEprReturnReadDatabaseContract(fakePool({ ...validRow, can_create_public: true })),
    /EPR_RETURN_READ_DATABASE_CONTRACT_INVALID/,
  );
  await assert.rejects(
    assertEprReturnReadDatabaseContract(fakePool({ ...validRow, can_create_database: true })),
    /EPR_RETURN_READ_DATABASE_CONTRACT_INVALID/,
  );
});

test("fails closed when the runtime can write EPR rows or read signing keys", async () => {
  await assert.rejects(
    assertEprReturnReadDatabaseContract(fakePool({ ...validRow, can_update_returns: true })),
    /EPR_RETURN_READ_DATABASE_CONTRACT_INVALID/,
  );
  await assert.rejects(
    assertEprReturnReadDatabaseContract(fakePool({ ...validRow, can_read_signing_keys: true })),
    /EPR_RETURN_READ_DATABASE_CONTRACT_INVALID/,
  );
});
