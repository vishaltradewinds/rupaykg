#!/usr/bin/env node
import fs from "node:fs";
const migration = fs.readFileSync("migrations/094_registry_event_identity_write_authority.sql", "utf8");
const failures = [];
for (const required of [
  "drop policy if exists shakti_registry_events_insert_authorized_owner",
  "create policy shakti_registry_events_insert_authorized_owner",
  "recorded_by_identity_id = app.current_identity_id()",
  "from_owner_id = app.current_organization_id()",
  "to_owner_id = app.current_organization_id()",
]) {
  if (!migration.includes(required)) failures.push("missing registry event identity authority control: " + required);
}
if (failures.length) {
  console.error("Shakti registry event identity write authority contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti registry event identity write authority contract PASSED.");
