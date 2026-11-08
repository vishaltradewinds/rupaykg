#!/usr/bin/env node
import fs from "node:fs";
const source=fs.readFileSync("apps/src/registry-routes.ts","utf8");
const failures=[];
for(const route of ["/api/v1/settlements/:settlementId/authorize","/api/v1/settlements/:settlementId/settle","/api/v1/settlements/:settlementId/confirm"]){
 const start=source.indexOf(`app.post("${route}"`);
 const end=source.indexOf("\n  app.post(",start+1);
 const b=source.slice(start,end<0?source.length:end);
 if(!b.includes("auth.activeOrganizationId!==r.rows[0].payer_id")) failures.push(route+": payer must match authenticated active organization");
 if(!b.includes('withTenantTransaction(pool,{...auth,activeOrganizationId:auth.activeOrganizationId ?? ""}')) failures.push(route+": mutation must execute inside authenticated tenant transaction");
}
if(failures.length){console.error("Shakti settlement lifecycle active-tenant contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1);}
console.log("Shakti settlement lifecycle active-tenant contract PASSED");
