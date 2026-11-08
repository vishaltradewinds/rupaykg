#!/usr/bin/env node
import fs from "node:fs";

const migration = fs.readFileSync("migrations/093_registry_event_tenant_rls.sql", "utf8");
const failures = [];
for (const required of [
  "alter table public.registry_events enable row level security",
  "shakti_registry_events_select_bilateral",
  "shakti_registry_events_insert_authorized_owner",
  "from_owner_id = app.current_organization_id()",
  "to_owner_id = app.current_organization_id()",
  "revoke update, delete on public.registry_events from rupaykg_app_runtime",
  "grant select, insert on public.registry_events to rupaykg_app_runtime",
]) {
  if (!migration.includes(required)) failures.push("missing registry event RLS control: " + required);
}
if (failures.length) {
  console.error("Shakti registry event tenant RLS contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti registry event tenant RLS contract PASSED: bilateral historical read and owner-authorized append-only runtime access are locked.");
