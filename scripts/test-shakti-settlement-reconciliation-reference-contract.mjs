#!/usr/bin/env node
import fs from "node:fs";

const migration=fs.readFileSync("migrations/089_settlement_reconciliation_reference_integrity.sql","utf8");
const route=fs.readFileSync("apps/src/registry-routes.ts","utf8");
const failures=[];

for(const required of [
  "settlements_reconciliation_reference_uq",
  "create unique index if not exists settlements_reconciliation_reference_uq",
  "on settlements(reconciliation_reference)",
  "where reconciliation_reference is not null and btrim(reconciliation_reference) <> ''",
]) if(!migration.includes(required)) failures.push("missing reconciliation-reference database uniqueness control: "+required);

for(const required of [
  "reconciliationConflict",
  "reconciliation_reference=$1 and id<>$2",
  "RECONCILIATION_REFERENCE_EXISTS",
  "constraint==="settlements_reconciliation_reference_uq"",
]) if(!route.includes(required)) failures.push("missing reconciliation-reference route replay control: "+required);

if(failures.length){console.error("Shakti settlement reconciliation-reference integrity contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1)}
console.log("Shakti settlement reconciliation-reference integrity contract PASSED: reconciliation evidence is preflighted and database-unique.");
