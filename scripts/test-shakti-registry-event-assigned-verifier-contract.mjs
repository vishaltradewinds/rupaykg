#!/usr/bin/env node
import fs from "node:fs";
const migration = fs.readFileSync("migrations/099_registry_event_assigned_verifier_read.sql", "utf8");
const required = [
  "create or replace function app.is_assigned_approved_verifier",
  "returns boolean",
  "language sql",
  "security definer",
  "stable",
  "select exists (",
  "set search_path = pg_catalog, public, app",
  "public.has_verification_permission(v.verifier_identity_id)",
  "v.verifier_identity_id = app.current_identity_id()",
  "v.decision = 'APPROVED'",
  "i.status = 'VERIFIED'",
  "from public.organization_memberships m",
  "m.identity_id = v.verifier_identity_id",
  "m.status = 'VERIFIED'",
  "m.organization_id = c.issuer_organization_id",
  "from public.organizations o",
  "o.id = c.issuer_organization_id",
  "o.status = 'VERIFIED'",
  "revoke all on function app.is_assigned_approved_verifier(uuid) from public",
  "grant execute on function app.is_assigned_approved_verifier(uuid) to rupaykg_app_runtime",
  "create policy shakti_registry_events_select_assigned_verifier",
  "app.is_assigned_approved_verifier(registry_events.credential_id)",
  "for select",
  "drop policy if exists shakti_registry_events_select_assigned_verifier",
  "-- No additional write authority is granted by this policy.",
  "-- The helper is read-only by construction: it returns a boolean and grants no table DML.",
];
const forbidden = [
  "create policy shakti_registry_events_select_assigned_verifier on public.registry_events for insert",
  "create policy shakti_registry_events_select_assigned_verifier on public.registry_events for update",
  "create policy shakti_registry_events_select_assigned_verifier on public.registry_events for delete",
  "grant insert on public.registry_events to rupaykg_app_runtime",
  "grant update on public.registry_events to rupaykg_app_runtime",
  "grant delete on public.registry_events to rupaykg_app_runtime",
  "insert into public.registry_events",
  "update public.registry_events",
  "delete from public.registry_events",
];
for (const item of forbidden) {
  if (migration.includes(item)) failures.push("assigned-verifier migration must not add write authority: " + item);
}

const failures = required.filter((x) => !migration.includes(x));
if (failures.length) {
  console.error("Shakti assigned-verifier registry read contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti assigned-verifier registry read contract PASSED.");
