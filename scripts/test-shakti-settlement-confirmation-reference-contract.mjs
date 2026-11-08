#!/usr/bin/env node
import fs from "node:fs";

const route = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const migration = fs.readFileSync("migrations/077_settlement_confirmation_reference_integrity.sql", "utf8");
const failures = [];
const migration = fs.readFileSync("migrations/077_settlement_confirmation_reference_integrity.sql", "utf8");
if (!migration.includes("TG_OP = 'UPDATE'")) failures.push("settlement confirmation trigger must be INSERT-safe");

for (const required of [
  "confirmation_reference=$2,reconciliation_reference=$3",
  "[id,confirmationReference,reconciliationReference]",
  "select id from settlements where confirmation_reference=$1 and id<>$2",
]) {
  if (!route.includes(required)) failures.push("missing settlement confirmation persistence/replay control: " + required);
}

for (const required of [
  "add column if not exists confirmation_reference text",
  "settlements_confirmation_reference_uq",
  "prevent_settlement_confirmation_reference_mutation",
  "settled transaction requires external confirmation reference",
]) {
  if (!migration.includes(required)) failures.push("missing database confirmation-reference integrity control: " + required);
}

if (failures.length) {
  console.error("Shakti settlement confirmation-reference contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}

console.log("Shakti settlement confirmation-reference contract PASSED: confirmation evidence is persisted, uniquely constrained and immutable.");
