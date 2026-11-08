#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/onboarding-hierarchy-routes.ts", "utf8");
const failures = [];

if (!source.includes("withAuthorityTransaction(pool,a.identityId,pending.approval_level,pending.geography_id")) {
  failures.push("decision route must bind authority context to the authoritative pending approval level and geography");
}
if (!source.includes("next.approval_level!==pending.approval_level||next.geography_id!==pending.geography_id")) {
  failures.push("decision route must reject a changed approval-chain authority context");
}
if (/text\(b,"approvalLevel"\)|text\(b,"authorityLevel"\)|text\(b,"authorityGeographyId"\)/.test(source)) {
  failures.push("request body must not establish approval authority level or authority geography");
}
if (!source.includes("eligible(c,a,next.approval_level,appn.geography_kind??null,appn.geography_id??null)")) {
  failures.push("decision route must re-authorize the current approval step inside the authority transaction");
}

if (failures.length) {
  console.error("Shakti authority boundary contract FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("Shakti authority boundary contract PASSED");
