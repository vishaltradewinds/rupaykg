#!/usr/bin/env node
import fs from "node:fs";
const migration = fs.readFileSync("migrations/097_field_sync_tenant_rls.sql", "utf8");
const failures = [];
for (const required of [
  "alter table public.field_sync_envelopes enable row level security",
  "alter table public.field_sync_conflicts enable row level security",
  "alter table public.field_sync_cursors enable row level security",
  "identity_id = app.current_identity_id()",
  "fd.organization_id = app.current_organization_id()",
  "fd.identity_id = app.current_identity_id()",
  "fd.status = 'VERIFIED'",
  "resolved_by_identity_id = app.current_identity_id()",
  "revoke delete on public.field_sync_envelopes, public.field_sync_conflicts, public.field_sync_cursors from rupaykg_app_runtime",
]) {
  if (!migration.includes(required)) failures.push("missing field-sync RLS control: " + required);
}
if (failures.length) {
  console.error("Shakti field-sync tenant RLS contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti field-sync tenant RLS contract PASSED.");
