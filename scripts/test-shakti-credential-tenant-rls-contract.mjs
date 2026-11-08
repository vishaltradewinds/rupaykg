#!/usr/bin/env node
import fs from "node:fs";
const migration = fs.readFileSync("migrations/095_credentials_tenant_rls.sql", "utf8");
const failures = [];
for (const required of [
  "alter table public.credentials enable row level security",
  "shakti_credentials_select_current_owner",
  "shakti_credentials_insert_issuer",
  "shakti_credentials_update_current_owner",
  "credentials.issuer_organization_id = app.current_organization_id()",
  "revoke delete on public.credentials from rupaykg_app_runtime",
  "grant select, insert, update on public.credentials to rupaykg_app_runtime",
]) {
  if (!migration.includes(required)) failures.push("missing credential RLS control: " + required);
}
if (failures.length) {
  console.error("Shakti credential tenant RLS contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti credential tenant RLS contract PASSED.");
