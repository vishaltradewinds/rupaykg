#!/usr/bin/env node
import fs from "node:fs";

const files = ["apps/src/auth-routes.ts","apps/src/onboarding-hierarchy-routes.ts"];
const failures = [];
for (const file of files) {
  const source = fs.readFileSync(file,"utf8");
  if (/body[^;\n]*(identityId|approvalLevel|authorityLevel|authorityGeographyId)/.test(source)) {
    failures.push(file + ": request body must not establish identity or authority context");
  }
  if (/set_(identity|platform|authority)_context\([^\n]*(body|request)/i.test(source)) {
    failures.push(file + ": execution-context helper must not receive request-body authority");
  }
}
const auth = fs.readFileSync("apps/src/auth-routes.ts","utf8");
if (!auth.includes("withIdentityTransaction(pool,auth.identityId")) failures.push("auth onboarding must use authenticated identity transaction");
const hierarchy = fs.readFileSync("apps/src/onboarding-hierarchy-routes.ts","utf8");
if (!hierarchy.includes("withAuthorityTransaction(pool,a.identityId,pending.approval_level,pending.geography_id")) failures.push("approval decision must use authoritative pending authority context");
if (failures.length) {
  console.error("Shakti auth/onboarding no-body-authority contract FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("Shakti auth/onboarding no-body-authority contract PASSED");
