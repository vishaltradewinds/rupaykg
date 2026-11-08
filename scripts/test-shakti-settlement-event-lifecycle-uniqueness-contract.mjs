#!/usr/bin/env node
import fs from "node:fs";

const migration = fs.readFileSync("migrations/081_settlement_event_lifecycle_uniqueness.sql", "utf8");
const route = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const failures = [];

if (!migration.includes("settlement_events_settlement_event_type_uq")) {
  failures.push("missing settlement lifecycle event uniqueness index");
}
if (!/on settlement_events\(settlement_id, event_type\)/.test(migration)) {
  failures.push("lifecycle event uniqueness must be scoped by settlement and event type");
}
if (!/insert into settlement_events/.test(route)) {
  failures.push("settlement routes must append lifecycle events");
}

if (failures.length) {
  console.error("Shakti settlement event lifecycle uniqueness contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti settlement event lifecycle uniqueness contract PASSED.");
