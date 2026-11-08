#!/usr/bin/env node
import fs from "node:fs";

const failures = [];
const workflow = fs.readFileSync(".github/workflows/tenant-isolation-live-acceptance.yml", "utf8");
const controlledMigration = fs.readFileSync(".github/workflows/controlled-shakti-production-migration.yml", "utf8");
const boundary = fs.readFileSync("ops/tenant-isolation/VERIFY_SECURITY_DEFINER_BOUNDARIES.sql", "utf8");
const activation = fs.readFileSync("ops/tenant-isolation/ACTIVATE_RLS.sql", "utf8");
const ddlPreflight = fs.readFileSync("ops/tenant-isolation/VERIFY_DDL_ROLE_PRE_RLS.sql", "utf8");

if (/psql "\$RUPAYKG_RUNTIME_DATABASE_URL" \\\\/.test(workflow)) {
  failures.push("SECURITY DEFINER acceptance step contains a double-backslash shell continuation; this passes a literal backslash instead of continuing the command.");
}
if (!/psql "\$RUPAYKG_RUNTIME_DATABASE_URL" \\\n\s+-v ON_ERROR_STOP=1 \\\n\s+-f ops\/tenant-isolation\/VERIFY_SECURITY_DEFINER_BOUNDARIES\.sql/.test(workflow)) {
  failures.push("SECURITY DEFINER acceptance step must invoke psql with ON_ERROR_STOP and the boundary verification SQL.");
}
if (!/where version in \('097','098','099'\)/.test(workflow)) {
  failures.push("Live acceptance must verify the Shakti 097-099 migration baseline.");
}
if (!/Required Shakti migration \$\{version\} is not applied/.test(workflow)) {
  failures.push("Live acceptance must fail closed when a required Shakti migration is missing.");
}
if (!/Verify runtime and DDL target identity match/.test(workflow)
 || !/runtime_fingerprint/.test(workflow)
 || !/ddl_fingerprint/.test(workflow)
 || !/Runtime and controlled DDL connections do not target the same PostgreSQL endpoint/.test(workflow)) {
  failures.push("Live acceptance must fail closed when runtime and controlled DDL connections target different PostgreSQL endpoints.");
}

if (!/environment:\s+\n\s+name: production-db-migration-approval/.test(controlledMigration)) {
  failures.push("Controlled production migration must require the production-db-migration-approval environment.");
}
if (!/DATABASE_URL: \$\{\{ secrets\.RUPAYKG_DDL_DATABASE_URL \}\}/.test(controlledMigration)) {
  failures.push("Controlled production migration must use the governed RUPAYKG_DDL_DATABASE_URL secret.");
}
if (!/Verify required DDL role safety/.test(controlledMigration)
 || !/rolsuper.*rolbypassrls/.test(controlledMigration)) {
  failures.push("Controlled production migration must verify the DDL role is not SUPERUSER or BYPASSRLS.");
}
if (!/EXPECTED_DDL_ROLE: rupaykg_ddl_migration/.test(controlledMigration)
 || !/current_user = '\$EXPECTED_DDL_ROLE'/.test(controlledMigration)
 || !/session_user = '\$EXPECTED_DDL_ROLE'/.test(controlledMigration)) {
  failures.push("Controlled production migration must execute only as the dedicated rupaykg_ddl_migration role.");
}
if (!/EXPECTED_PRE_MIGRATION_VERSION: "096"/.test(controlledMigration)
 || !/max\(version\).*\$EXPECTED_PRE_MIGRATION_VERSION/.test(controlledMigration)
 || !/count\(\*\).*097.*098.*099/.test(controlledMigration)) {
  failures.push("Controlled production migration must lock the cutover to the expected 096 baseline with no prior 097-099 application.");
}
if (!/Verify controlled DDL role owns protected tenant tables/.test(controlledMigration)
 || !/ddl_owner_assertion/.test(controlledMigration)
 || !/\)=17 then 1 else 0 end/.test(controlledMigration)) {
  failures.push("Controlled production migration must fail closed unless the executing DDL role owns all 17 protected tenant tables.");
}
const provisioning = fs.readFileSync("ops/tenant-isolation/PROVISION_CONTROLLED_DDL_ROLE.sql", "utf8");
if (!/authorized current owner\/admin/.test(provisioning)
 || !/target role will be non-BYPASSRLS/.test(provisioning)
 || !/expected runtime role rupaykg_app_runtime is missing/.test(provisioning)
 || !/alter table organizations owner to rupaykg_ddl_migration/.test(provisioning)) {
  failures.push("Controlled DDL-role provisioning must fail closed on unsafe provisioning sessions, require the runtime role, and explicitly transfer protected-table ownership.");
}

if (!fs.existsSync("ops/tenant-isolation/PROVISION_CONTROLLED_DDL_ROLE.sql")) {
  failures.push("Approval-gated controlled DDL-role provisioning plan is missing.");
}

if (!/npm run migrate -w @rupaykg\/api/.test(controlledMigration)) {
  failures.push("Controlled production migration must use the repository migration runner.");
}
if (!/Migration complete\. RLS activation remains a separate controlled DDL gate\./.test(controlledMigration)) {
  failures.push("Controlled production migration must not silently activate RLS.");
}

for (const fn of ["app.set_request_context", "app.is_verified_org_member", "app.authenticate_bearer_session"]) {
  if (!boundary.includes(fn)) failures.push(`Boundary verification missing function: ${fn}`);
}
if (!/not has_function_privilege\('public', 'app\.set_request_context/.test(boundary)
 || !/not has_function_privilege\('public', 'app\.is_verified_org_member/.test(boundary)
 || !/not has_function_privilege\('public', 'app\.authenticate_bearer_session/.test(boundary)) {
  failures.push("Boundary verification must fail closed on PUBLIC EXECUTE.");
}

const protectedTables = [
  "organizations", "roles", "activities", "obligations", "credentials",
  "settlements", "audit_events", "resource_flows", "field_devices",
  "organization_memberships", "measurements", "evidence", "verifications",
  "carbon_calculations", "mrv_observations",
  "evidence_verification_requirements", "chain_of_custody_links"
];

if (protectedTables.length !== 17) {
  failures.push(`Static Shakti protected-table inventory changed unexpectedly: expected 17, found ${protectedTables.length}.`);
}
for (const table of protectedTables) {
  if (!activation.includes(`('${table}')`) || !ddlPreflight.includes(`'${table}'`)) {
    failures.push(`Protected-table inventory missing from activation/preflight contract: ${table}`);
  }
}
if (!/\) <> 17 then/.test(activation) || !/\) = 17/.test(ddlPreflight)) {
  failures.push("RLS activation and DDL preflight must assert ownership of the same 17 protected tenant tables.");
}
if (/<> 18/.test(activation) || /= 18/.test(ddlPreflight)) {
  failures.push("Tenant-isolation activation/preflight must not contain the obsolete 18-table ownership assertion.");
}

if (failures.length) {
  console.error("Shakti live-acceptance workflow contract FAILED:");
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Shakti live-acceptance workflow contract PASSED.");
