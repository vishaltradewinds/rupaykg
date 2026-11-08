#!/usr/bin/env node
import fs from "node:fs";
const migration = fs.readFileSync("migrations/099_registry_event_assigned_verifier_read.sql", "utf8");
const required = [
  "create policy shakti_registry_events_select_assigned_verifier",
  "v.verifier_identity_id = app.current_identity_id()",
  "v.decision = 'APPROVED'",
  "join public.verifications v on v.id = c.verification_id",
];
const failures = required.filter((x) => !migration.includes(x));
if (failures.length) {
  console.error("Shakti assigned-verifier registry read contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti assigned-verifier registry read contract PASSED.");
