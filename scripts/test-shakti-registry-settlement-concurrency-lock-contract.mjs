#!/usr/bin/env node
import fs from "node:fs";
const source=fs.readFileSync("apps/src/registry-routes.ts","utf8");
const failures=[];
const required=[
  ["credential transfer locks credential row",/select status from credentials where id=\$1 for update/],
  ["credential retirement locks credential row",/select status from credentials where id=\$1 for update/],
  ["settlement creation locks credential row",/select status from credentials where id=\$1 for update/],
  ["settlement authorization locks settlement row",/select status,payer_id,payee_id from settlements where id=\$1 for update/],
  ["settlement execution locks settlement row",/select status,payer_id,payee_id from settlements where id=\$1 for update/],
  ["settlement confirmation locks settlement row",/select status,payer_id,payee_id,external_reference from settlements where id=\$1 for update/],
];
for(const [name,re] of required) if(!re.test(source)) failures.push(name);
if((source.match(/order by created_at desc,id desc limit 1/g)||[]).length<2) failures.push("registry latest-state lookups must use deterministic locking-compatible ordering");
if(failures.length){console.error("Shakti registry/settlement concurrency lock contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1)}
console.log("Shakti registry/settlement concurrency lock contract PASSED: critical lifecycle rows are explicitly locked before authorization/state mutation.");
