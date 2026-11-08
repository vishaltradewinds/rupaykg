#!/usr/bin/env node
import fs from "node:fs";
const migration = fs.readFileSync("migrations/096_credential_authority_field_immutability.sql", "utf8");
const failures = [];
for (const required of [
  "prevent_credential_authority_field_mutation",
  "old.status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED')",
  "new.activity_id is distinct from old.activity_id",
  "new.issuer_organization_id is distinct from old.issuer_organization_id",
  "new.verification_id is distinct from old.verification_id",
  "new.quantity is distinct from old.quantity",
  "new.unit is distinct from old.unit",
  "new.credential_uri is distinct from old.credential_uri",
  "new.issued_at is distinct from old.issued_at",
  "credential_authority_field_immutability_guard",
]) {
  if (!migration.includes(required)) failures.push("missing credential immutability control: " + required);
}
for (const required of ["revoke update on public.credentials from rupaykg_app_runtime", "grant update (status) on public.credentials to rupaykg_app_runtime", "revoke delete on public.credentials from rupaykg_app_runtime"]) {
  if (!migration100.includes(required)) {
    console.error("Shakti credential runtime privilege contract FAILED: missing migration 100 control: " + required);
    process.exit(1);
  }
}

if (failures.length) {
  console.error("Shakti credential authority immutability contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti credential authority immutability contract PASSED.");

const grants = fs.readFileSync("migrations/100_credential_runtime_update_column_scope.sql", "utf8");\nconst routes = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const migration100 = fs.readFileSync("migrations/100_credential_runtime_update_column_scope.sql", "utf8");\nfor (const required of ["update credentials set status='ACTIVE'", "update credentials set status='TRANSFERRED'", "update credentials set status='RETIRED'"]) {\n  if (!routes.includes(required)) {\n    console.error("Shakti credential runtime mutation contract FAILED: missing " + required);\n    process.exit(1);\n  }\n}
for (const required of ["revoke update on public.credentials from rupaykg_app_runtime", "grant update (status) on public.credentials to rupaykg_app_runtime", "grant select, insert, update on public.credentials to rupaykg_app_runtime", "revoke delete on public.credentials from rupaykg_app_runtime"]) {
  if (!grants.includes(required)) {
    console.error("Shakti credential runtime update scope contract FAILED: missing " + required);
    process.exit(1);
  }
}
