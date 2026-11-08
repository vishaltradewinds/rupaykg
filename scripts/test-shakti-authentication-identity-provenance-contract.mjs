#!/usr/bin/env node
import fs from "node:fs";

const auth = fs.readFileSync("apps/src/auth.ts", "utf8");
const routes = fs.readFileSync("apps/src/auth-routes.ts", "utf8");
const failures = [];

if (!auth.includes("where s.token_hash = $1") || !auth.includes("and i.status = 'VERIFIED'") || !auth.includes("and i.suspended_at is null")) {
  failures.push("authenticate must derive identity from a live, non-revoked session for a verified, non-suspended identity");
}
if (!auth.includes("requestedOrganizationId && !memberships.rows.some((m) => m.organization_id === requestedOrganizationId)")) {
  failures.push("organization header must be limited to verified memberships");
}
if (!auth.includes("memberships.rows.length > 1 && !requestedOrganizationId")) {
  failures.push("multi-organization identities must fail closed without explicit organization selection");
}
if (!routes.includes("const sessionToken=await issueSession(pool,row.id")) {
  failures.push("login session issuance must use the authenticated database identity, not request-body identity");
}
if (!routes.includes("const body=bodyOf(request),email=emailOf(body),password=text(body,\"password\")")) {
  failures.push("login must derive credentials from email/password body only");
}
if (/body[^;]*identityId|body[^;]*organizationId.*issueSession|issueSession\(pool,[^,]+body/.test(routes)) {
  failures.push("request body must not supply identity authority to session issuance");
}

if (failures.length) {
  console.error("Shakti authentication identity provenance contract FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("Shakti authentication identity provenance contract PASSED");
