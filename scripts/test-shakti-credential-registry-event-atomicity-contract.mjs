#!/usr/bin/env node
import fs from "node:fs";
const migration = fs.readFileSync("migrations/098_credential_registry_event_atomicity.sql", "utf8");
const required = [
  "create constraint trigger credential_registry_event_atomicity_guard",
  "deferrable initially deferred",
  "when 'ISSUED' then 'ISSUED'",
  "when 'ACTIVE' then 'ACTIVATED'",
  "when 'TRANSFERRED' then 'TRANSFERRED'",
  "when 'RETIRED' then 'RETIRED'",
  "select re.event_type",
  "order by re.created_at desc, re.id desc",
  "latest_event_type is distinct from required_event",
  "requires matching latest registry event",
];
const failures = required.filter((x) => !migration.includes(x));
if (failures.length) {
  console.error("Shakti credential registry atomicity contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti credential registry atomicity contract PASSED.");
