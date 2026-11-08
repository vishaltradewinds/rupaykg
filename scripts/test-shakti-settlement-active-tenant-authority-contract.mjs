#!/usr/bin/env node
import fs from "node:fs";
const source=fs.readFileSync("apps/src/registry-routes.ts","utf8");
const start=source.indexOf('app.post("/api/v1/settlements"');
const end=source.indexOf('\n  app.post("/api/v1/settlements/:settlementId/authorize"',start);
const block=source.slice(start,end);
const failures=[];
for(const [name,re] of [
 ["active organization required",/if\(!auth\.activeOrganizationId\)/],
 ["payer bound to active organization",/auth\.activeOrganizationId!==payerId/],
 ["payer and payee remain separately authorized",/canActForOrganization\(auth,payerId\).*canActForOrganization\(auth,payeeId\)/],
 ["tenant transaction uses authenticated payer context",/withTenantTransaction\(pool,\{\.\.\.auth,activeOrganizationId:payerId\}/],
]) if(!re.test(block)) failures.push(name);
if(failures.length){console.error("Shakti settlement active-tenant authority contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1);}
console.log("Shakti settlement active-tenant authority contract PASSED");
