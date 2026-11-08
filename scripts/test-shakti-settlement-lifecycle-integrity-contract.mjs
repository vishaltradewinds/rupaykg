#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const failures = [];

const required = [
  'where id=$1 for update',
  'status!=="CREATED"',
  'status!=="AUTHORIZED"',
  'status!=="RECONCILING"',
  "authorizationReference",
  "externalReference",
  "confirmationReference",
  "reconciliationReference",
  "confirmation_reference=$1 and id<>$2",
  "reconciliation_reference=$1 and id<>$2",
  "confirmation_reference=$2,reconciliation_reference=$3",
  "insert into settlement_events",
  "'AUTHORIZED'",
  "'EXECUTING'",
  "'SETTLED'",
];
for (const item of required) {
  if (!source.includes(item)) failures.push("missing settlement lifecycle/replay control: " + item);
}

const forbidden = [
  'update settlements set status=',
];
const stateUpdates = [...source.matchAll(/update settlements set status=([^\n]+)/g)].map((m) => m[0]);
if (stateUpdates.length < 3) {
  failures.push("settlement lifecycle must contain explicit state updates for execution and confirmation");
}

if (failures.length) {
  console.error("Shakti settlement lifecycle integrity contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti settlement lifecycle integrity contract PASSED: locked state transitions, external references, replay checks and immutable settlement events are present.");
