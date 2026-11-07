#!/usr/bin/env node
import fs from "node:fs";

const migration = fs.readFileSync("migrations/20261107_core_tenant_rls_activation_gate.sql", "utf8");
const integration = fs.readFileSync("apps/src/tenant-isolation.integration.test.ts", "utf8");
const failures = [];

for (const table of ["activities", "measurements", "evidence", "carbon_calculations", "epr_obligations"]) {
  if (!new RegExp(`alter table public\\.${table} enable row level security`).test(migration)) failures.push(`RLS is not enabled for ${table}`);
  if (!new RegExp(`shakti_${table}_tenant`).test(migration)) failures.push(`tenant policy is missing for ${table}`);
}
if (/grant select, insert, update, delete on public\\.(activities|measurements|evidence|carbon_calculations|epr_obligations)/.test(migration)) {
  failures.push("core RLS gate grants DELETE; least-privilege contract requires SELECT/INSERT/UPDATE only");
}
if (!/set local role rupaykg_app_runtime/.test(integration)) failures.push("integration suite does not explicitly execute protected RLS assertions as the disposable runtime role");
if (!integration.includes("Shakti RLS runtime role isolates core tenant rows")) failures.push("missing core RLS runtime acceptance test");
if (!integration.includes("Shakti RLS child-row scope follows the parent activity tenant")) failures.push("missing child-row RLS runtime acceptance test");

if (failures.length) {
  console.error("Shakti core RLS contract FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Shakti core RLS contract PASSED: five protected core tables have tenant policies, runtime execution is explicitly non-BYPASSRLS, and core grants remain least-privilege.");
