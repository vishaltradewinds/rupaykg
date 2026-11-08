import fs from "node:fs";

const grantSource = fs.readFileSync("migrations/20261107_runtime_grant_reconciliation.sql", "utf8")
  + "\n" + fs.readFileSync("migrations/090_runtime_dml_grant_reconciliation_completion.sql", "utf8");
const routeFiles = [
  "apps/src/auth-routes.ts",
  "apps/src/onboarding-hierarchy-routes.ts",
  "apps/src/platform-admin-routes.ts",
  "apps/src/registry-routes.ts",
  "apps/src/value-routes.ts",
  "apps/src/epr-return-routes.ts",
  "apps/src/bwg-routes.ts",
  "apps/src/cpcb-swm-routes.ts",
  "apps/src/evidence-vault-routes.ts",
  "apps/src/mrv-routes.ts",
  "apps/src/sync-routes.ts",
  "apps/src/workspace-routes.ts",
  "apps/src/statutory-routes.ts",
];

const requiredGrants = [
  "grant insert on table public.identities to rupaykg_app_runtime;",
  "grant insert, update on table public.identity_password_credentials to rupaykg_app_runtime;",
  "grant insert, update on table public.identity_sessions to rupaykg_app_runtime;",
  "grant insert, update on table public.organizations to rupaykg_app_runtime;",
  "grant insert on table public.roles to rupaykg_app_runtime;",
  "grant insert, update on table public.organization_geography_scopes to rupaykg_app_runtime;",
  "grant insert on table public.organization_verification_evidence to rupaykg_app_runtime;",
  "grant insert, update on table public.stakeholder_applications to rupaykg_app_runtime;",
  "grant update on table public.stakeholder_application_approvals to rupaykg_app_runtime;",
  "grant insert on table public.audit_events to rupaykg_app_runtime;",
  "grant update on table public.organization_geography_scopes to rupaykg_app_runtime;",
  "grant update on table public.organization_verification_evidence to rupaykg_app_runtime;",
  "grant update on table public.organizations to rupaykg_app_runtime;",
];

const missing = requiredGrants.filter((line) => !grantSource.includes(line));
if (missing.length) {
  console.error("Shakti runtime DML grant contract FAILED:");
  for (const line of missing) console.error("- " + line);
  process.exit(1);
}

if (/grant\s+(?:[^;]*\b)?delete\s+on\s+table\s+[^;]+\s+to\s+rupaykg_app_runtime/i.test(grantSource)) {
  throw new Error("Runtime role must not receive DELETE privilege.");
}
if (/^grant\s+[^;]*\bon\s+(?:table\s+)?schema_migrations\b/im.test(grantSource)) {
  throw new Error("schema_migrations must remain outside the runtime grant contract.");
}

const violations = [];
for (const relative of routeFiles) {
  const source = fs.readFileSync(relative, "utf8");
  if (/\bdelete\s+from\s+(?:public\.)?[a-z_][a-z0-9_]*/i.test(source)) {
    violations.push(relative + ": DELETE statements are not permitted in audited runtime routes.");
  }
}
if (violations.length) {
  console.error("Shakti runtime DML grant contract FAILED:");
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("Shakti runtime DML grant contract PASSED: audited auth/onboarding/platform/runtime writes have explicit grants and no DELETE privilege is exposed.");
