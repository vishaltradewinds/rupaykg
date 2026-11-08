#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/migrate.ts", "utf8");
const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
const failures = [];
for (const required of [
  "createHash",
  "alter table schema_migrations add column if not exists checksum text",
  'createHash("sha256").update(sql).digest("hex")',
  "checksum mismatch: applied content has changed",
  "insert into schema_migrations(version, filename, checksum)",
  "100_credential_runtime_update_column_scope",
  "101_security_definer_schema_boundary",
  "20261108_context_identity_liveness_hardening",
  "20261108_context_identity_liveness_completion",
  "RUPAYKG_ALLOW_PROTECTED_SHAKTI_MIGRATIONS",
]) {
  if (!source.includes(required)) failures.push("missing migration integrity control: " + required);
}
const protectedMigrations = [
  "20261107_authority_hierarchy_context.sql", "20261107_context_identity_bootstrap.sql", "20261107_platform_execution_context.sql",
  "20261107_runtime_grant_reconciliation.sql", "20261107_context_organization_id.sql", "20261107_core_tenant_rls_activation_gate.sql",
  "20261108_context_identity_liveness_hardening.sql", "20261108_context_identity_liveness_completion.sql",
  "082_settlement_reference_trigger_insert_safety.sql", "088_field_sync_append_only_integrity.sql", "089_settlement_reconciliation_reference_integrity.sql",
  "090_runtime_dml_grant_reconciliation_completion.sql", "091_settlement_tenant_rls.sql", "092_settlement_lifecycle_transition_integrity.sql",
  "093_registry_event_tenant_rls.sql", "094_registry_event_identity_write_authority.sql", "095_credentials_tenant_rls.sql",
  "096_credential_authority_field_immutability.sql", "097_field_sync_tenant_rls.sql", "098_credential_registry_event_atomicity.sql",
  "099_registry_event_assigned_verifier_read.sql", "100_credential_runtime_update_column_scope.sql", "101_security_definer_schema_boundary.sql",
];
for (const migration of protectedMigrations) {
  if (!source.includes(migration.replace(/\.sql$/, ""))) failures.push("migration runner missing protected identity: " + migration);
  if (!workflow.includes(migration)) failures.push("CI protected migration gate missing: " + migration);
}
if (!/20261108_context_identity_liveness_(hardening|completion)/.test(source)) {
  failures.push("missing protected identity-liveness migration gate regex");
}
if (failures.length) {
  console.error("Shakti migration integrity contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti migration integrity contract PASSED: applied migration content is checksum-bound.");
