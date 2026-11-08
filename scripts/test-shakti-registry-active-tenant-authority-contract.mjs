#!/usr/bin/env node
import fs from "node:fs";
const s=fs.readFileSync("apps/src/registry-routes.ts","utf8");
const failures=[];
const issuance=s.match(/app\.post\("\/api\/v1\/credentials"[\s\S]*?(?=\n  app\.post|\n}\s*$)/)?.[0]??"";
if(!issuance) failures.push("credential issuance route not found");
if(!issuance.includes("if(!auth.activeOrganizationId)")) failures.push("credential issuance must require an active organization");
if(!issuance.includes("auth.activeOrganizationId!==issuerOrganizationId")) failures.push("issuer organization must match authenticated active organization");
if(!issuance.includes("withTenantTransaction(pool,{...auth,activeOrganizationId:issuerOrganizationId}")) failures.push("credential issuance must execute in the authenticated tenant transaction");
if(/withTenantTransaction\(pool,\{\.\.\.auth,activeOrganizationId:issuerOrganizationId\}/.test(issuance) && !issuance.includes("auth.activeOrganizationId!==issuerOrganizationId")) failures.push("request-body issuer organization cannot override tenant context");
if(failures.length){console.error("Shakti registry active-tenant authority contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1);}
console.log("Shakti registry active-tenant authority contract PASSED");
