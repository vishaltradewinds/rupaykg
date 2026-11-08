#!/usr/bin/env node
import fs from "node:fs";

const files = [
  "migrations/20261107_platform_execution_context.sql",
  "migrations/20261107_authority_hierarchy_context.sql",
];
const failures = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  if (!/language plpgsql\s+security definer\s+set search_path = public, app/i.test(source)) {
    failures.push(file + ": context function must be SECURITY DEFINER with fixed search_path");
  }
  if (!/set_config\('app\.identity_id'.*true\)/s.test(source)) {
    failures.push(file + ": identity context must be transaction-local");
  }
  if (!/set_config\('app\.execution_scope'.*true\)/s.test(source)) {
    failures.push(file + ": execution scope must be transaction-local");
  }
  if (!/grant execute on function app\./i.test(source)) {
    failures.push(file + ": runtime execute grant missing");
  }
}
const runtimeGrant = fs.readFileSync("migrations/20261107_runtime_grant_reconciliation.sql", "utf8");
if (!runtimeGrant.includes("grant execute on function app.set_identity_context(uuid)")) failures.push("identity context grant missing");
if (!runtimeGrant.includes("grant execute on function app.set_platform_context(uuid)")) failures.push("platform context grant missing");
if (!runtimeGrant.includes("grant execute on function app.set_authority_context(uuid,text,uuid)")) failures.push("authority context grant missing");
if (/grant .* on table public\.schema_migrations/i.test(runtimeGrant)) failures.push("runtime role must not receive schema_migrations grant");

if (failures.length) {
  console.error("Shakti context function security contract FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("Shakti context function security contract PASSED");
