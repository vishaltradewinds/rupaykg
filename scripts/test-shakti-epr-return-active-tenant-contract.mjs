#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/epr-return-routes.ts", "utf8");
const failures = [];

if (source.includes('request.headers["x-rupaykg-organization-id"]')) {
  failures.push("EPR return routes must not select tenant from request organization header");
}
if (source.includes('requiredString(body, "organizationId")')) {
  failures.push("EPR return routes must not select tenant from request-body organizationId");
}
if (!source.includes("const organizationId = auth.activeOrganizationId;")) {
  failures.push("EPR return routes must bind organizationId to auth.activeOrganizationId");
}
if (!source.includes('if (!organizationId || !canAct(auth, organizationId))')) {
  failures.push("EPR return routes must fail closed without active verified organization");
}
if ((source.match(/withTenantTransaction\(pool, tenantAuth/g) ?? []).length < 3) {
  failures.push("EPR return mutation/read paths must remain tenant-transaction bound");
}

if (failures.length) {
  console.error("Shakti EPR return active-tenant contract FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("Shakti EPR return active-tenant contract PASSED");
