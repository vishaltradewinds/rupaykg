#!/usr/bin/env node
import fs from "node:fs";

const sync = fs.readFileSync("apps/src/sync-routes.ts", "utf8");
const failures = [];

for (const required of [
  "POST /api/v1/field-devices/enroll",
  "field_devices(device_id,identity_id,organization_id,status,registered_by_identity_id,registered_at)",
  "auth.activeOrganizationId !== organizationId",
  "FIELD_DEVICE_ENROLLED",
  "withTenantTransaction(pool, tenantAuth",
]) {
  if (!sync.includes(required)) failures.push("field-device software boundary missing: " + required);
}

if (!fs.existsSync("docs/hardware/RUPAYKG_FIELD_EDGE_STACK.md")) {
  failures.push("hardware stack baseline document missing");
}

if (failures.length) {
  console.error("Shakti field hardware/software stack contract FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("Shakti field hardware/software stack contract PASSED");
