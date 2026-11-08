import fs from "node:fs";

const source = fs.readFileSync("migrations/20261107_runtime_grant_reconciliation.sql", "utf8");
const required = [
  "grant execute on function app.current_identity_id() to rupaykg_app_runtime;",
  "grant execute on function app.current_organization_id() to rupaykg_app_runtime;",
  "grant execute on function app.set_request_context(uuid,uuid) to rupaykg_app_runtime;",
  "grant execute on function app.set_identity_context(uuid) to rupaykg_app_runtime;",
  "grant execute on function app.set_platform_context(uuid) to rupaykg_app_runtime;",
  "grant execute on function app.set_authority_context(uuid,text,uuid) to rupaykg_app_runtime;",
];
const missing = required.filter(line => !source.includes(line));
if (missing.length) {
  console.error("Shakti execution-context grant reconciliation FAILED:");
  for (const line of missing) console.error("- " + line);
  process.exit(1);
}
if (/grant .* on schema_migrations/.test(source)) throw new Error("schema_migrations grant must remain absent");
console.log("Shakti execution-context grant reconciliation PASSED");
