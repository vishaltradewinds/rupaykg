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
  can_truncate_returns: false,
  can_reference_returns: false,
  can_trigger_returns: false,
  can_select_schemes: true,
  can_insert_schemes: false,
  can_update_schemes: false,
  can_delete_schemes: false,
  can_truncate_schemes: false,
  can_reference_schemes: false,
  can_trigger_schemes: false,
  can_read_signing_keys: false,
  can_insert_signing_keys: false,
  can_update_signing_keys: false,
  can_delete_signing_keys: false,
  can_truncate_signing_keys: false,
  can_reference_signing_keys: false,
  can_trigger_signing_keys: false,
  can_create_public: false,
  can_create_security_schema: false,
  can_create_database: false,
  verifier_schema_usage: true,
  verifier_execute: true,
  verifier_valid: true,
  can_read_memberships: false,
  can_read_roles: false,
  permission_schema_usage: true,
  permission_helper_execute: true,
  permission_helper_public_execute: false,
  permission_helper_valid: true,
  permission_owner_valid: true,
  permission_owner_no_memberships: true,
  session_resolver_execute: true,
  session_resolver_public_execute: false,
  session_resolver_valid: true,
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
  await assert.rejects(
    assertEprReturnReadDatabaseContract(fakePool({ ...validRow, can_create_security_schema: true })),
    /EPR_RETURN_READ_DATABASE_CONTRACT_INVALID/,
  );
});

test("fails closed on any EPR mutation privilege or request-signing-key access", async () => {
  const forbidden = [
    "can_insert_returns", "can_update_returns", "can_delete_returns",
    "can_truncate_returns", "can_reference_returns", "can_trigger_returns",
    "can_insert_schemes", "can_update_schemes", "can_delete_schemes",
    "can_truncate_schemes", "can_reference_schemes", "can_trigger_schemes",
    "can_read_signing_keys", "can_insert_signing_keys", "can_update_signing_keys",
    "can_delete_signing_keys", "can_truncate_signing_keys",
    "can_reference_signing_keys", "can_trigger_signing_keys",
  ] as const;
  for (const field of forbidden) {
    await assert.rejects(
      assertEprReturnReadDatabaseContract(fakePool({ ...validRow, [field]: true })),
      /EPR_RETURN_READ_DATABASE_CONTRACT_INVALID/,
      field,
    );
  }
});
