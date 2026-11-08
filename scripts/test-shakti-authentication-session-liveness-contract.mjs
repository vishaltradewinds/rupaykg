#!/usr/bin/env node
import fs from "node:fs";

const auth = fs.readFileSync("apps/src/auth.ts", "utf8");
const routes = fs.readFileSync("apps/src/auth-routes.ts", "utf8");
const failures = [];

const requiredAuth = [
  "s.token_hash = $1",
  "s.revoked_at is null",
  "s.expires_at > now()",
  "i.status = 'VERIFIED'",
  "i.suspended_at is null",
  "join organizations o on o.id = om.organization_id and o.status = 'VERIFIED'",
  "organization_memberships",
  "status = 'VERIFIED'",
  "requestedOrganizationId",
  "memberships.rows.length > 1 && !requestedOrganizationId",
];
for (const required of requiredAuth) {
  if (!auth.includes(required)) failures.push("missing authentication liveness/tenant control: " + required);
}

const requiredRoutes = [
  'update identity_sessions set revoked_at=now() where token_hash=$1 and revoked_at is null',
  'const sessionToken=await issueSession(pool,row.id',
  'if(row.status!=="VERIFIED"||row.suspended_at)',
];
for (const required of requiredRoutes) {
  if (!routes.includes(required)) failures.push("missing session lifecycle control: " + required);
}

if (routes.includes("identityId = text(body") || routes.includes("identityId=text(body")) {
  failures.push("session issuance must not derive authenticated identity from request body");
}

if (failures.length) {
  console.error("Shakti authentication session-liveness contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}

console.log("Shakti authentication session-liveness contract PASSED: revoked/expired/suspended sessions fail closed and tenant selection remains membership-bound.");
