import assert from "node:assert/strict";
import test from "node:test";
import { getPermissionsForRole } from "./rbac-policy.js";

const operationalRoles = [
  "citizen",
  "farmer",
  "safai_mitra",
  "fpo",
  "municipal_generator",
  "aggregator",
  "processor",
  "industry_generator",
  "commercial_generator",
  "institution_generator",
] as const;

test("approved operational stakeholders receive the minimum field permissions", () => {
  for (const role of operationalRoles) {
    const permissions = getPermissionsForRole(role);
    assert.ok(permissions.includes("dashboard:read"), `${role} must read its dashboard`);
    assert.ok(permissions.includes("waste:record"), `${role} must record waste operations`);
    assert.ok(permissions.includes("evidence:upload"), `${role} must upload evidence`);
    assert.equal(permissions.includes("admin:system"), false, `${role} must not administer system security`);
    assert.equal(permissions.includes("registry:write"), false, `${role} must not write the registry`);
  }
});

test("governance separation is preserved", () => {
  assert.ok(getPermissionsForRole("ACVA_USER").includes("VERIFY_EVIDENCE"));
  assert.ok(getPermissionsForRole("regulator").includes("VERIFY_EVIDENCE"));
  assert.equal(getPermissionsForRole("PROJECT_OWNER").includes("projects:verify"), false);
  assert.equal(getPermissionsForRole("PROJECT_OWNER").includes("ISSUE_CREDENTIAL"), false);
  assert.ok(getPermissionsForRole("super_admin").includes("MANAGE_STAKEHOLDERS"));
  assert.ok(getPermissionsForRole("super_admin").includes("ISSUE_CREDENTIAL"));
});

test("unknown roles fail closed", () => {
  assert.deepEqual(getPermissionsForRole("not-a-role"), []);
});
