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
if (failures.length) {
  console.error("Shakti credential authority immutability contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti credential authority immutability contract PASSED.");
