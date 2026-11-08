#!/usr/bin/env node
import fs from "node:fs";

const migration = fs.readFileSync("migrations/079_settlement_execution_external_reference_integrity.sql", "utf8");
const route = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const failures = [];

for (const required of [
  "prevent_settlement_execution_without_external_reference",
  "settlement_execution_external_reference_guard",
  "executing settlement requires external settlement reference",
  "new.status in ('EXECUTING','RECONCILING','SETTLED')",
]) {
  if (!migration.includes(required)) failures.push("missing execution external-reference database control: " + required);
}

for (const required of [
  "externalReference",
  "status='EXECUTING'",
  "status='RECONCILING'",
  "constraint === \"settlements_external_reference_unique_idx\"",
  "code === \"23505\"",
  "EXTERNAL_REFERENCE_EXISTS",
]) {
  if (!route.includes(required)) failures.push("missing execution route evidence: " + required);
}

if (failures.length) {
  console.error("Shakti settlement execution external-reference contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti settlement execution external-reference contract PASSED: execution and reconciliation states require external settlement evidence.");
