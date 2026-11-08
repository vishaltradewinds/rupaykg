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

const protectedMigrationIdentities = [
  ["20261107_authority_hierarchy_context", "20261107_(authority_hierarchy_context"],
  ["20261107_context_identity_bootstrap", "20261107_(authority_hierarchy_context|context_identity_bootstrap"],
  ["20261107_context_organization_id", "20261107_(authority_hierarchy_context|context_identity_bootstrap|platform_execution_context|runtime_grant_reconciliation|context_organization_id"],
  ["20261107_platform_execution_context", "platform_execution_context"],
  ["20261107_runtime_grant_reconciliation", "runtime_grant_reconciliation"],
  ["20261107_core_tenant_rls_activation_gate", "core_tenant_rls_activation_gate"],
  ["20261108_context_identity_liveness_hardening", "20261108_context_identity_liveness_(hardening"],
  ["20261108_context_identity_liveness_completion", "20261108_context_identity_liveness_(hardening|completion"],
  ["082_settlement_reference_trigger_insert_safety", "082_settlement_reference_trigger_insert_safety"],
  ["088_field_sync_append_only_integrity", "088_field_sync_append_only_integrity"],
  ["089_settlement_reconciliation_reference_integrity", "089_settlement_reconciliation_reference_integrity"],
  ["090_runtime_dml_grant_reconciliation_completion", "090_runtime_dml_grant_reconciliation_completion"],
  ["091_settlement_tenant_rls", "091_settlement_tenant_rls"],
  ["092_settlement_lifecycle_transition_integrity", "092_settlement_lifecycle_transition_integrity"],
  ["093_registry_event_tenant_rls", "093_registry_event_tenant_rls"],
  ["094_registry_event_identity_write_authority", "094_registry_event_identity_write_authority"],
  ["095_credentials_tenant_rls", "095_credentials_tenant_rls"],
  ["096_credential_authority_field_immutability", "096_credential_authority_field_immutability"],
  ["097_field_sync_tenant_rls", "097_field_sync_tenant_rls"],
  ["098_credential_registry_event_atomicity", "098_credential_registry_event_atomicity"],
  ["099_registry_event_assigned_verifier_read", "099_registry_event_assigned_verifier_read"],
  ["100_credential_runtime_update_column_scope", "100_credential_runtime_update_column_scope"],
];
for (const [filename, identity] of protectedMigrationIdentities) {
  if (!migrationRunner.includes(identity)) failures.push(`Migration invariant missing: protected migration identity ${filename}`);
}
const requiredMigrationInvariants = [
  ["explicit protected gate", /RUPAYKG_ALLOW_PROTECTED_SHAKTI_MIGRATIONS/],
  ["legacy numeric migration compatibility", /prefixCounts/],
  ["duplicate-prefix disambiguation", /filename\.replace\(\/\\.sql\$\/, ""\)/],
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
if (!/auth\.memberships\.some\(\(m\) => m\.status === "VERIFIED" && m\.organization_id === auth\.activeOrganizationId\)/.test(tenantDb)) {
  failures.push("Tenant transaction invariant missing: active organization must have verified membership.");
}
if (!/select exists \(select 1 from organization_memberships om\s+join organizations o on o\.id\s*=\s*om\.organization_id\s+and o\.status\s*=\s*'VERIFIED'\s+where om\.identity_id\s*=\s*\$1\s+and om\.organization_id\s*=\s*\$2\s+and om\.status\s*=\s*'VERIFIED'\)/.test(tenantDb)) {
  failures.push("Tenant transaction invariant missing: authoritative database membership must be revalidated inside the transaction.");
}
if (!/auth\.memberships\.length\s*===\s*0/.test(auth) || !/!organizationId/.test(auth) || !/m\.status\s*===\s*"VERIFIED"/.test(auth)) {
  failures.push("Authorization fail-closed invariant missing for empty organization/membership context.");
}

if (failures.length) {
  console.error("Shakti operational invariants FAILED:");
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Shakti operational invariants PASSED: CI, protected migration, tenant-context and fail-closed authorization guardrails are present.");
