#!/usr/bin/env node
import fs from "node:fs";
const source=fs.readFileSync("apps/src/registry-routes.ts","utf8");
const failures=[];
const settlement=source.slice(source.indexOf('app.post("/api/v1/settlements"'),source.indexOf('app.post("/api/v1/settlements/:settlementId/authorize"'));
if(!/select payer\.status as payer_status,payee\.status as payee_status from organizations payer join organizations payee on payee\.id=\$2 where payer\.id=\$1/.test(settlement)) failures.push("settlement creation must verify both payer and payee organization status at the DB boundary");
if(!/payer_status!=="VERIFIED"\|\|parties\.rows\[0\]\.payee_status!=="VERIFIED"/.test(settlement)) failures.push("settlement creation must fail closed unless both parties are VERIFIED");
if(!/SETTLEMENT_PARTIES_NOT_VERIFIED/.test(settlement)) failures.push("unverified settlement parties require deterministic conflict code");
if(!/canPerformHighRiskActionInDatabase\(c,auth,payerId,"AUTHORIZE_SETTLEMENT"\)/.test(settlement)) failures.push("settlement creation must retain high-risk authorization");
if(failures.length){console.error("Shakti settlement verified-party boundary contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1)}
console.log("Shakti settlement verified-party boundary contract PASSED.");
