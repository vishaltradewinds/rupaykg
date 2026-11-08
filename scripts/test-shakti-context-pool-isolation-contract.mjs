#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/tenant-db.ts", "utf8");
const failures = [];

for (const fn of ["withIdentityTransaction", "withTenantTransaction", "withPlatformTransaction", "withAuthorityTransaction"]) {
  const start = source.indexOf("export async function " + fn);
  if (start < 0) failures.push(fn + " is missing");
  else {
    const end = source.indexOf("\nexport async function ", start + 1);
    const body = source.slice(start, end < 0 ? source.length : end);
    if (!body.includes('await client.query("begin")')) failures.push(fn + " must begin an explicit transaction");
    if (!body.includes('await client.query("commit")')) failures.push(fn + " must commit only after callback success");
    if (!body.includes('await client.query("rollback")')) failures.push(fn + " must rollback on failure");
    if (!body.includes("client.release()")) failures.push(fn + " must release the pooled client");
  }
}

if (failures.length) {
  console.error("Shakti context pool isolation contract FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("Shakti context pool isolation contract PASSED");
