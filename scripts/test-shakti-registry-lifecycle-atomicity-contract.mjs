#!/usr/bin/env node
import fs from "node:fs";
const source=fs.readFileSync("apps/src/registry-routes.ts","utf8");
const failures=[];
const blocks=[
  ["credential transfer",/app\.post\("\/api\/v1\/credentials\/:credentialId\/transfer"/],
  ["credential retirement",/app\.post\("\/api\/v1\/credentials\/:credentialId\/retire"/],
  ["settlement creation",/app\.post\("\/api\/v1\/settlements"/],
];
for(const [name,re] of blocks) if(!re.test(source)) failures.push(name+" route missing");
if((source.match(/withTenantTransaction\(pool/g)||[]).length<8) failures.push("registry lifecycle routes must remain inside tenant transactions");
if(!/update credentials set status='TRANSFERRED' where id=\$1/.test(source)) failures.push("transfer state mutation missing");
if(!/insert into registry_events\(credential_id,event_type,from_owner_id,to_owner_id,recorded_by_identity_id,event_hash\)/.test(source)) failures.push("transfer provenance append missing");
if(!/update credentials set status='RETIRED' where id=\$1/.test(source)) failures.push("retirement state mutation missing");
if(!/insert into registry_events\(credential_id,event_type,from_owner_id,recorded_by_identity_id,event_hash\)/.test(source)) failures.push("retirement provenance append missing");
if(!/select id from settlements where credential_id=\$1 and status not in\('SETTLED','CANCELLED'\) limit 1/.test(source)) failures.push("retirement open-settlement gate missing");
if(!/select status from credentials where id=\$1 for update/.test(source)) failures.push("credential lifecycle row lock missing");
if(!source.includes("constraint===\"credentials_activity_verification_unique_idx\"")) failures.push("credential issuance must classify concurrent duplicate verification constraint deterministically");
if(!source.includes("CREDENTIAL_EXISTS")) failures.push("credential issuance duplicate conflict code missing");
if(!/order by created_at desc,id desc limit 1/.test(source)) failures.push("deterministic registry ordering missing");
if(failures.length){console.error("Shakti registry lifecycle atomicity contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1)}
console.log("Shakti registry lifecycle atomicity contract PASSED.");
