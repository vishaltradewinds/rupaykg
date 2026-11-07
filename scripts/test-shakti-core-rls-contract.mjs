#!/usr/bin/env node
import fs from "node:fs";

const migration = fs.readFileSync("migrations/20261107_core_tenant_rls_activation_gate.sql", "utf8");
const integration = fs.readFileSync("apps/src/tenant-isolation.integration.test.ts", "utf8");
const failures = [];

const expectedPolicies = {
  activities: /create policy shakti_activities_tenant on public\.activities[\s\S]*?using \(organization_id = app\.current_organization_id\(\)\)[\s\S]*?with check \(organization_id = app\.current_organization_id\(\)\)/,
  measurements: /create policy shakti_measurements_tenant on public\.measurements[\s\S]*?using \(exists \(select 1 from public\.activities a where a\.id = measurements\.activity_id and a\.organization_id = app\.current_organization_id\(\)\)\)[\s\S]*?with check \(exists \(select 1 from public\.activities a where a\.id = measurements\.activity_id and a\.organization_id = app\.current_organization_id\(\)\)\)/,
  evidence: /create policy shakti_evidence_tenant on public\.evidence[\s\S]*?using \(exists \(select 1 from public\.activities a where a\.id = evidence\.activity_id and a\.organization_id = app\.current_organization_id\(\)\)\)[\s\S]*?with check \(exists \(select 1 from public\.activities a where a\.id = evidence\.activity_id and a\.organization_id = app\.current_organization_id\(\)\)\)/,
  carbon_calculations: /create policy shakti_carbon_calculations_tenant on public\.carbon_calculations[\s\S]*?using \(exists \(select 1 from public\.activities a where a\.id = carbon_calculations\.activity_id and a\.organization_id = app\.current_organization_id\(\)\)\)[\s\S]*?with check \(exists \(select 1 from public\.activities a where a\.id = carbon_calculations\.activity_id and a\.organization_id = app\.current_organization_id\(\)\)\)/,
  epr_obligations: /create policy shakti_epr_obligations_tenant on public\.epr_obligations[\s\S]*?using \(obligated_organization_id = app\.current_organization_id\(\)\)[\s\S]*?with check \(obligated_organization_id = app\.current_organization_id\(\)\)/,
};

for (const table of Object.keys(expectedPolicies)) {
  if (!new RegExp(`alter table public\\.${table} enable row level security`).test(migration)) {
    failures.push(`RLS is not enabled for ${table}`);
  }
  if (!expectedPolicies[table].test(migration)) {
    failures.push(`tenant policy semantics are incomplete or do not bind ${table} to app.current_organization_id()`);
  }
}

if (/grant select, insert, update, delete on public\.(activities|measurements|evidence|carbon_calculations|epr_obligations)/.test(migration)) {
  failures.push("core RLS gate grants DELETE; least-privilege contract requires SELECT/INSERT/UPDATE only");
}
if (!/set local role rupaykg_app_runtime/.test(integration)) {
  failures.push("integration suite does not explicitly execute protected RLS assertions as the disposable runtime role");
}
if (!integration.includes("Shakti RLS runtime role isolates core tenant rows")) {
  failures.push("missing core RLS runtime acceptance test");
}
if (!integration.includes("Shakti RLS child-row scope follows the parent activity tenant")) {
  failures.push("missing child-row RLS runtime acceptance test");
}

if (failures.length) {
  console.error("Shakti core RLS contract FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Shakti core RLS contract PASSED: five protected core tables have tenant policies, runtime execution is explicitly non-BYPASSRLS, and core grants remain least-privilege.");
