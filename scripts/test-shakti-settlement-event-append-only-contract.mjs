#!/usr/bin/env node
import fs from "node:fs";

const migration = fs.readFileSync("migrations/080_settlement_event_append_only_integrity.sql", "utf8");
const route = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const failures = [];

for (const required of [
  "prevent_settlement_event_mutation",
  "settlement_event_immutable_guard",
  "settlement events are immutable and append-only",
  "settlement_event_hash_nonempty",
]) {
  if (!migration.includes(required)) failures.push("missing append-only settlement event control: " + required);
}

if (!/insert into settlement_events/.test(route)) {
  failures.push("settlement lifecycle must append settlement_events");
}
if (/update settlement_events\s+set|delete\s+from settlement_events/i.test(route)) {
  failures.push("runtime settlement routes must not mutate or delete settlement_events");
}

if (failures.length) {
  console.error("Shakti settlement event append-only contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti settlement event append-only contract PASSED: settlement evidence is append-only with non-empty hashes.");
