#!/usr/bin/env node
import fs from "node:fs";
const source=fs.readFileSync("apps/src/tenant-db.ts","utf8");
const failures=[];
const fn=source.slice(source.indexOf("export async function withTenantTransaction"),source.indexOf("export async function withIdentityTransaction"));
for(const required of [
 "join organizations o on o.id=om.organization_id and o.status='VERIFIED'",
 "om.status='VERIFIED'",
 "om.identity_id=$1 and om.organization_id=$2"
]) if(!fn.includes(required)) failures.push("tenant transaction authoritative membership query missing: "+required);
if(failures.length){console.error("Shakti tenant organization liveness contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1)}
console.log("Shakti tenant organization liveness contract PASSED");
