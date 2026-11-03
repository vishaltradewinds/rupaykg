import assert from "node:assert/strict";
import test from "node:test";
import { assertMrvWorkerRoleContract, type MrvWorkerRoleContract } from "./mrv-worker-role-contract.js";

const safeRole: MrvWorkerRoleContract = {
  current_user: "rupaykg_mrv_worker_runtime",
  session_user: "rupaykg_mrv_worker_runtime",
  rolcanlogin: true,
  rolinherit: false,
  rolsuper: false,
  rolbypassrls: false,
  rolcreatedb: false,
  rolcreaterole: false,
  rolreplication: false,
  owner_membership: false,
  elevated_membership: false,
  any_role_membership: false,
  public_create: false,
  direct_table_privileges: false,
  worker_api_execute: true,
  public_worker_api_execute: false,
  worker_api_complete: true,
  worker_api_secure: true,
};

test("accepts only the dedicated function-only worker database role", () => {
  assert.doesNotThrow(() => assertMrvWorkerRoleContract(safeRole));
});

test("rejects privileged role flags and memberships", () => {
  for (const patch of [
    { owner_membership: true },
    { elevated_membership: true },
    { any_role_membership: true },
    { rolinherit: true },
    { rolsuper: true },
    { rolbypassrls: true },
    { rolcreatedb: true },
    { rolcreaterole: true },
    { rolreplication: true },
  ]) {
    assert.throws(() => assertMrvWorkerRoleContract({ ...safeRole, ...patch }));
  }
});

test("rejects direct table privileges, public schema creation, or missing API execution", () => {
  for (const patch of [
    { public_create: true },
    { direct_table_privileges: true },
    { worker_api_execute: false },
    { worker_api_complete: false },
    { worker_api_secure: false },
  ]) {
    assert.throws(() => assertMrvWorkerRoleContract({ ...safeRole, ...patch }));
  }
});

test("rejects PUBLIC execution on the worker API", () => {
  assert.throws(() => assertMrvWorkerRoleContract({
    ...safeRole,
    public_worker_api_execute: true,
  }));
});

test("rejects a session role that differs from the authenticated worker role", () => {
  assert.throws(() => assertMrvWorkerRoleContract({
    ...safeRole,
    session_user: "postgres",
  }));
});

test("rejects any identity other than the dedicated runtime role", () => {
  assert.throws(() => assertMrvWorkerRoleContract({
    ...safeRole,
    current_user: "rupaykg_app_runtime",
  }));
});
