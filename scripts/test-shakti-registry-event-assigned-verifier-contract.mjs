#!/usr/bin/env node
import fs from "node:fs";
const migration = fs.readFileSync("migrations/099_registry_event_assigned_verifier_read.sql", "utf8");
const required = [
  "create or replace function app.is_assigned_approved_verifier",
  "security definer",
  "v.verifier_identity_id = app.current_identity_id()",
  "v.decision = 'APPROVED'",
  "i.status = 'VERIFIED'",
  "has_verification_permission(v.verifier_identity_id)",
  "from public.organization_memberships m",
  "m.identity_id = v.verifier_identity_id",
  "m.status = 'VERIFIED'",
  "m.organization_id = c.issuer_organization_id",
  "revoke all on function app.is_assigned_approved_verifier(uuid) from public",
  "grant execute on function app.is_assigned_approved_verifier(uuid) to rupaykg_app_runtime",
  "create policy shakti_registry_events_select_assigned_verifier",
  "app.is_assigned_approved_verifier(registry_events.credential_id)",
  "for select",
  "-- No additional write authority is granted by this policy.",
];
const failures = required.filter((x) => !migration.includes(x));
if (failures.length) {
  console.error("Shakti assigned-verifier registry read contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti assigned-verifier registry read contract PASSED.");
