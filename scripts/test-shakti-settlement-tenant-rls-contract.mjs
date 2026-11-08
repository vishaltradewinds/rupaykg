#!/usr/bin/env node
import fs from "node:fs";

const migration = fs.readFileSync("migrations/091_settlement_tenant_rls.sql", "utf8");
const failures = [];

for (const table of ["settlements", "settlement_events"]) {
  if (!migration.includes("alter table public." + table + " enable row level security")) {
    failures.push(table + " RLS enablement missing");
  }
}

for (const policy of [
  "shakti_settlements_select_bilateral",
  "shakti_settlements_insert_payer",
  "shakti_settlements_update_payer",
  "shakti_settlement_events_select_bilateral",
  "shakti_settlement_events_insert_payer",
]) {
  if (!migration.includes("create policy " + policy)) failures.push(policy + " missing");
}

if (!migration.includes("grant select, insert, update on public.settlements to rupaykg_app_runtime")) {
  failures.push("settlements runtime DML grant missing");
}
if (!migration.includes("grant select, insert on public.settlement_events to rupaykg_app_runtime")) {
  failures.push("settlement_events runtime DML grant missing");
}
if (!migration.includes("revoke update, delete on public.settlement_events from rupaykg_app_runtime")) { failures.push("settlement_events destructive runtime privileges must be explicitly revoked"); }
if (!migration.includes("revoke delete on public.settlements from rupaykg_app_runtime")) { failures.push("settlements DELETE runtime privilege must be explicitly revoked"); }
if (migration.includes("grant update on public.settlement_events") || migration.includes("grant delete on public.settlement_events")) {
  failures.push("settlement_events must remain append-only for runtime role");
}
if (migration.includes("grant delete on public.settlements")) {
  failures.push("settlements DELETE grant must remain absent");
}
if (!migration.includes("payer_id = app.current_organization_id()")) {
  failures.push("payer authority boundary missing");
}
if (!migration.includes("payee_id = app.current_organization_id()")) {
  failures.push("bilateral settlement read boundary missing");

if (failures.length) {
  console.error("Shakti settlement tenant RLS contract FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("Shakti settlement tenant RLS contract PASSED");
