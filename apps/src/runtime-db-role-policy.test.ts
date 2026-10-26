import assert from "node:assert/strict";
import test from "node:test";
import { runtimeDatabaseRoleFailure, type RuntimeDatabaseRoleState } from "./runtime-db-role-policy.js";

const safeRole: RuntimeDatabaseRoleState = {
  roleName: "rupaykg_runtime",
  isSuperuser: false,
  canCreateDatabase: false,
  canCreateRole: false,
  canReplicate: false,
  bypassesRls: false,
  ownsDatabase: false,
  canCreateInDatabase: false,
  ownsPublicSchema: false,
  ownsPublicObjects: false,
  canCreateInPublicSchema: false,
  hasUnsafeTablePrivileges: false,
};

test("dedicated least-privilege runtime role passes", () => {
  assert.equal(runtimeDatabaseRoleFailure(safeRole), null);
});

test("runtime role fails closed for every elevated role attribute", () => {
  const cases: Array<[keyof RuntimeDatabaseRoleState, string]> = [
    ["isSuperuser", "SUPERUSER"],
    ["canCreateDatabase", "CREATEDB"],
    ["canCreateRole", "CREATEROLE"],
    ["canReplicate", "REPLICATION"],
    ["bypassesRls", "BYPASSRLS"],
    ["ownsDatabase", "database ownership"],
    ["canCreateInDatabase", "CREATE on database"],
    ["ownsPublicSchema", "public schema ownership"],
    ["ownsPublicObjects", "public application object ownership"],
    ["canCreateInPublicSchema", "CREATE on public schema"],
    ["hasUnsafeTablePrivileges", "TRUNCATE/REFERENCES/TRIGGER"],
  ];

  for (const [key, expected] of cases) {
    const failure = runtimeDatabaseRoleFailure({ ...safeRole, [key]: true });
    assert.ok(failure, `${key} must fail closed`);
    assert.match(failure, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("missing current role identity fails closed", () => {
  assert.match(runtimeDatabaseRoleFailure({ ...safeRole, roleName: " " }) ?? "", /could not be identified/i);
});
