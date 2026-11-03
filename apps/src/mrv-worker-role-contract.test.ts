import assert from "node:assert/strict";
import test from "node:test";
import { assertMrvWorkerRoleContract, type MrvWorkerRoleContract } from "./mrv-worker-role-contract.js";

const safeRole: MrvWorkerRoleContract = {
  current_user: "rupaykg_mrv_worker_runtime", session_user: "rupaykg_mrv_worker_runtime",
  rolcanlogin: true, rolinherit: false, rolsuper: false, rolbypassrls: false,
  rolcreatedb: false, rolcreaterole: false, rolreplication: false,
  owner_membership: false, elevated_membership: false, any_role_membership: false,
  geography_scope_execute: true, public_create: false, required_table_reads: true,
  job_update: true, job_insert: false, job_delete: false,
  event_insert: true, event_update: false, event_delete: false,
  provenance_insert: true, provenance_update: false, provenance_delete: false,
  source_table_write: false,
};

test("accepts only the dedicated non-inheriting worker database role", () => {
  assert.doesNotThrow(() => assertMrvWorkerRoleContract(safeRole));
});

test("rejects owner/elevated role memberships and inherited privileges", () => {
  for (const patch of [
    { owner_membership: true }, { elevated_membership: true },
    { any_role_membership: true }, { rolinherit: true },
    { rolbypassrls: true }, { rolsuper: true },
  ]) assert.throws(() => assertMrvWorkerRoleContract({ ...safeRole, ...patch }));
});

test("rejects broad writes outside the MRV job ledger and append-only sinks", () => {
  for (const patch of [
    { source_table_write: true }, { job_insert: true }, { job_delete: true },
    { event_update: true }, { event_delete: true },
    { provenance_update: true }, { provenance_delete: true },
  ]) assert.throws(() => assertMrvWorkerRoleContract({ ...safeRole, ...patch }));
});

test("rejects a session role that differs from the authenticated worker role", () => {
  assert.throws(() => assertMrvWorkerRoleContract({ ...safeRole, session_user: "postgres" }));
});
