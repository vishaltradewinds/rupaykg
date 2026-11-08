#!/usr/bin/env node
import fs from "node:fs";

const failures = [];

const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
const migrationRunner = fs.readFileSync("apps/src/migrate.ts", "utf8");
const tenantDb = fs.readFileSync("apps/src/tenant-db.ts", "utf8");
const auth = fs.readFileSync("apps/src/auth.ts", "utf8");

const requiredWorkflowInvariants = [
  ["manual workflow trigger", /workflow_dispatch:/],
  ["deterministic dependency install", /npm ci --no-audit --no-fund/],
  ["disposable non-BYPASSRLS runtime role", /create role rupaykg_app_runtime nologin nobypassrls/],
  ["protected migration gate", /RUPAYKG_ALLOW_PROTECTED_SHAKTI_MIGRATIONS: ["']1["']/],
  ["runtime DB integration flag", /RUPAYKG_RUN_DB_INTEGRATION_TESTS: ["']1["']/],
  ["runtime non-BYPASSRLS assertion flag", /RUPAYKG_REQUIRE_NON_BYPASSRLS: ["']1["']/],
  ["separate owner fixture connection", /RUPAYKG_TEST_OWNER_DATABASE_URL:/],
];
for (const [name, pattern] of requiredWorkflowInvariants) {
  if (!pattern.test(workflow)) failures.push(`CI invariant missing: ${name}`);
}

const requiredMigrationInvariants = [
  ["protected migration allowlist", /authority_hierarchy_context\|platform_execution_context\|runtime_grant_reconciliation\|core_tenant_rls_activation_gate/],
  ["explicit protected gate", /RUPAYKG_ALLOW_PROTECTED_SHAKTI_MIGRATIONS/],
  ["legacy numeric migration compatibility", /prefixCounts/],
  ["duplicate-prefix disambiguation", /filename\.replace\(\/\\\.sql\$\/, ""\)/],
];
for (const [name, pattern] of requiredMigrationInvariants) {
  if (!pattern.test(migrationRunner)) failures.push(`Migration invariant missing: ${name}`);
}

if (!/withTenantTransaction/.test(tenantDb) || !/set_request_context/.test(tenantDb)) {
  failures.push("Tenant transaction invariant missing: request context must be established inside the transaction.");
}
if (!/auth\.activeOrganizationId/.test(tenantDb)) {
  failures.push("Tenant transaction invariant missing: active organization context is required.");
}
if (!/auth\.memberships\.length\s*===\s*0/.test(auth) || !/!organizationId/.test(auth)) {
  failures.push("Authorization fail-closed invariant missing for empty organization/membership context.");
}

if (failures.length) {
  console.error("Shakti operational invariants FAILED:");
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Shakti operational invariants PASSED: CI, protected migration, tenant-context and fail-closed authorization guardrails are present.");
