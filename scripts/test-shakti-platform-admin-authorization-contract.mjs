#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/platform-admin-routes.ts", "utf8");

const expected = [
  ["/api/v1/admin/identities/:identityId/suspend", "admin:users"],
  ["/api/v1/admin/identities/:identityId/reactivate", "admin:users"],
  ["/api/v1/admin/identities/:identityId/revoke-sessions", "admin:security"],
  ["/api/v1/admin/roles/:roleId/permissions", "admin:roles"],
  ["/api/v1/admin/access-change-requests", "admin:users"],
  ["/api/v1/admin/memberships", "admin:users"],
  ["/api/v1/admin/memberships/:membershipId/status", "admin:users"],
];

const failures = [];

for (const [route, permission] of expected) {
  const start = source.indexOf(`app.${route.includes("/memberships") && route.includes(":membershipId") ? "patch" : "post"}("${route}"`);
  if (start < 0) {
    failures.push(`missing route: ${route}`);
    continue;
  }
  const nextRoute = source.slice(start + route.length).search(/\n\s*app\.(?:get|post|patch|put|delete)\(/);
  const block = nextRoute < 0
    ? source.slice(start)
    : source.slice(start, start + route.length + nextRoute);

  if (!block.includes(`const result = await withPlatformTransaction(pool, context.auth.identityId, async (client) => {`)) {
    failures.push(`${route}: missing protected transaction`);
  }
  if (!block.includes(`if (!await assertPlatformPermission(client, context.auth.identityId, "${permission}"))`)) {
    failures.push(`${route}: missing in-transaction ${permission} authorization`);
  }
}

const decisionStart = source.indexOf("const decideAccessChange = async");
if (decisionStart < 0) {
  failures.push("missing shared access-change decision function");
} else {
  const decisionBlock = source.slice(decisionStart, source.indexOf("\n  app.post(\"/api/v1/admin/access-change-requests/:requestId/approve\"", decisionStart));
  if (!decisionBlock.includes('withPlatformTransaction(pool, context.auth.identityId, async (client) => {')) {
    failures.push("access-change decision: missing protected transaction");
  }
  if (!decisionBlock.includes('assertPlatformPermission(client, context.auth.identityId, "admin:users")')) {
    failures.push("access-change decision: missing in-transaction admin:users authorization");
  }
}

if (failures.length) {
  console.error("Platform-admin mutation authorization contract FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Platform-admin mutation authorization contract PASSED: every platform mutation boundary re-checks the expected permission inside its protected transaction.");
