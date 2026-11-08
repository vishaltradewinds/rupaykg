#!/usr/bin/env node
import fs from "node:fs";

const migration = fs.readFileSync("migrations/083_registry_event_append_only_integrity.sql", "utf8");
const route = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const failures = [];

for (const required of [
  "prevent_registry_event_mutation",
  "before update or delete on registry_events",
  "registry_event_hash_nonempty",
  "btrim(event_hash) <> ''",
  "registry events are immutable and append-only",
]) {
  if (!migration.includes(required)) failures.push("migration missing registry event integrity control: " + required);
}
if (!route.includes("insert into registry_events")) failures.push("registry runtime must append registry events");
if (/update\\s+registry_events|delete\\s+from\\s+registry_events/i.test(route)) failures.push("registry runtime must not mutate/delete historical registry events");
if (!route.includes('canonicalEventHash(')) failures.push("registry runtime must retain cryptographic event hashing");

if (failures.length) {
  console.error("Shakti registry event append-only integrity contract FAILED:\\n" + failures.map((x) => "- " + x).join("\\n"));
  process.exit(1);
}
console.log("Shakti registry event append-only integrity contract PASSED: registry provenance evidence is append-only and non-empty-hash protected.");
