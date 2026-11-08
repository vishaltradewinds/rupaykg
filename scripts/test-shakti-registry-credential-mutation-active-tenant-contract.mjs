#!/usr/bin/env node
import fs from "node:fs";
const s=fs.readFileSync("apps/src/registry-routes.ts","utf8");
const failures=[];
for(const route of [
  "/api/v1/credentials",
  "/api/v1/credentials/:credentialId/activate",
  "/api/v1/credentials/:credentialId/transfer",
  "/api/v1/credentials/:credentialId/retire",
]){
  const start=s.indexOf(`app.post("${route}"`);
  const end=s.indexOf("\n  app.post(",start+1);
  const b=s.slice(start,end<0?s.length:end);
  if(start<0) failures.push(route+": route not found");
  else {
    if(!b.includes("auth.activeOrganizationId")) failures.push(route+": must require authenticated active organization");
    if(!b.includes("withTenantTransaction")) failures.push(route+": mutation must execute in tenant transaction");
  }
}
const retire=s.slice(s.indexOf('app.post("/api/v1/credentials/:credentialId/retire"'),s.indexOf("\n  app.post(",s.indexOf('app.post("/api/v1/credentials/:credentialId/retire"'))<0?s.length:s.indexOf("\n  app.post(",s.indexOf('app.post("/api/v1/credentials/:credentialId/retire"')));
if(!retire.includes("auth.activeOrganizationId!==o.rows[0].owner_id")) failures.push("credential retirement must bind active tenant to authoritative current owner");
if(failures.length){console.error("Shakti registry credential mutation active-tenant contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1);}
console.log("Shakti registry credential mutation active-tenant contract PASSED");
