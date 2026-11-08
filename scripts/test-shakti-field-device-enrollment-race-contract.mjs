#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/sync-routes.ts", "utf8");
const schema = fs.readFileSync("migrations/003_identity_geography_operations.sql", "utf8");
const failures = [];

if (!/create table field_devices[\s\S]*device_id text not null unique/.test(schema))
  failures.push("field_devices.device_id must remain database-unique");
if (!/select id,status from field_devices where device_id=\$1/.test(source))
  failures.push("enrollment must preflight the device identifier");
if (!/insert into field_devices\(device_id,identity_id,organization_id,status,registered_by_identity_id,registered_at\)/.test(source))
  failures.push("enrollment insert must persist authoritative device binding");
if (!/error.*code.*=== "23505"/.test(source))
  failures.push("unique device enrollment races must be classified from PostgreSQL 23505");
if (!/reply\.code\(409\)\.send\(\{ error: "Device identifier is already enrolled", code: "DEVICE_ALREADY_ENROLLED"/.test(source))
  failures.push("device enrollment uniqueness conflict must return deterministic 409");

if (failures.length) {
  console.error("Shakti field-device enrollment race contract FAILED:\n" + failures.map(x => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti field-device enrollment race contract PASSED.");
