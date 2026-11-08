#!/usr/bin/env node
import fs from "node:fs";
const source=fs.readFileSync("apps/src/auth.ts","utf8");
const failures=[];
const fn=source.slice(source.indexOf("export async function hasOrganizationPermission"),source.indexOf("export async function canPerformHighRiskActionInDatabase"));
for(const required of [
  "join organizations o on o.id = om.organization_id and o.status = 'VERIFIED'",
  "om.status = 'VERIFIED'",
  "om.identity_id = $1 and om.organization_id = $2",
  "jsonb_array_elements_text(r.permissions)"
]) if(!fn.includes(required)) failures.push("high-risk permission query missing verified-organization boundary: "+required);

const evidenceFn=source.slice(source.indexOf("export async function canVerifyEvidence"),source.indexOf("export function bearerChallenge"));
for(const required of ["join organizations o on o.id = om.organization_id and o.status = 'VERIFIED'","om.status = 'VERIFIED'"]) if(!evidenceFn.includes(required)) failures.push("evidence authorization query missing verified organization boundary: "+required);
if(failures.length){console.error("Shakti high-risk organization liveness contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1)}
console.log("Shakti high-risk organization liveness contract PASSED: DB permission checks require verified organization and verified membership.");
