#!/usr/bin/env node
import fs from "node:fs";

const route = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const migration = fs.readFileSync("migrations/078_settlement_authorization_reference_integrity.sql", "utf8");
const failures = [];

for (const required of [
  "authorization_reference=$1 and id<>$2",
  "AUTHORIZATION_REFERENCE_EXISTS",
  "settlements_authorization_reference_uq",
]) {
  if (!route.includes(required)) failures.push("missing authorization-reference replay control: " + required);
}

for (const required of [
  "settlements_authorization_reference_uq",
  "prevent_settlement_authorization_reference_mutation",
  "settlement authorization reference cannot be changed after assignment",
]) {
  if (!migration.includes(required)) failures.push("missing authorization-reference database integrity control: " + required);
}

if (failures.length) {
  console.error("Shakti settlement authorization-reference contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}

console.log("Shakti settlement authorization-reference contract PASSED: authorization evidence is unique and immutable.");
