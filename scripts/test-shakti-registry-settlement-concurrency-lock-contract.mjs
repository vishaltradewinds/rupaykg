#!/usr/bin/env node
import fs from "node:fs";
const source=fs.readFileSync("apps/src/registry-routes.ts","utf8");
const failures=[];
const required=[
  ["credential transfer/retirement/settlement creation lock credential row",/select status from credentials where id=\$1 for update/],
  ["settlement authorization/execution/confirmation lock settlement row",/select status,payer_id,payee_id(?:,external_reference)? from settlements where id=\$1 for update/],
];
for(const [name,re] of required) if(!re.test(source)) failures.push(name);
const transferOwner=/select to_owner_id from registry_events where credential_id=\$1 and event_type in\('ISSUED','TRANSFERRED'\) order by created_at desc,id desc limit 1/.test(source);
const retirementOwner=/select coalesce\(to_owner_id,from_owner_id\) owner_id from registry_events where credential_id=\$1 order by created_at desc,id desc limit 1/.test(source);
const settlementOwner=/select id,from_owner_id,to_owner_id,event_type from registry_events where credential_id=\$1 and event_type in\('ISSUED','TRANSFERRED','RETIRED'\) order by created_at desc,id desc limit 1/.test(source);
if(!transferOwner) failures.push("credential transfer current-owner resolution is not deterministic");
if(!retirementOwner) failures.push("credential retirement current-owner resolution is not deterministic");
if(!settlementOwner) failures.push("settlement creation registry-state resolution is not deterministic");
if((source.match(/order by created_at desc,id desc limit 1/g)||[]).length<2) failures.push("registry latest-state lookups must use deterministic locking-compatible ordering");
if(failures.length){console.error("Shakti registry/settlement concurrency lock contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1)}
console.log("Shakti registry/settlement concurrency lock contract PASSED: critical lifecycle rows are explicitly locked before authorization/state mutation.");
