#!/usr/bin/env node
import fs from "node:fs";
const source=fs.readFileSync("apps/src/registry-routes.ts","utf8");
const failures=[];
const settlement=source.slice(source.indexOf('app.post("/api/v1/settlements"'),source.indexOf('app.post("/api/v1/settlements/:settlementId/authorize"'));
const transfer=source.slice(source.indexOf('app.post("/api/v1/credentials/:credentialId/transfer"'),source.indexOf('app.post("/api/v1/credentials/:credentialId/retire"'));
if(!/from organizations payer join organizations payee on payee\.id=\$2 where payer\.id=\$1 for share of payer, payee/.test(settlement)) failures.push("settlement creation must lock both organization rows while verifying party status");
if(!/select id from organizations where id=\$1 and status='VERIFIED' for share/.test(transfer)) failures.push("credential transfer must lock the verified destination organization row before mutation");
if(!/payer_status!=="VERIFIED"\|\|parties\.rows\[0\]\.payee_status!=="VERIFIED"/.test(settlement)) failures.push("settlement creation must still fail closed for unverified parties");
if(!/status='VERIFIED' for share/.test(transfer)) failures.push("registry transfer destination verification must remain DB-bound");
if(failures.length){console.error("Shakti verified-organization transition lock contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1)}
console.log("Shakti verified-organization transition lock contract PASSED.");
