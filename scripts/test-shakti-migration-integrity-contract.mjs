#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/migrate.ts", "utf8");
const failures = [];
for (const required of [
  "createHash",
  "alter table schema_migrations add column if not exists checksum text",
  'createHash("sha256").update(sql).digest("hex")',
  "checksum mismatch: applied content has changed",
  "insert into schema_migrations(version, filename, checksum)",
  "100_credential_runtime_update_column_scope",
  "20261108_context_identity_liveness_hardening",
  "20261108_context_identity_liveness_completion",
  "RUPAYKG_ALLOW_PROTECTED_SHAKTI_MIGRATIONS",
]) {
  if (!source.includes(required)) failures.push("missing migration integrity control: " + required);
}
if (!/20261108_context_identity_liveness_(hardening|completion)/.test(source)) {
  failures.push("missing protected identity-liveness migration gate regex");
}
if (failures.length) {
  console.error("Shakti migration integrity contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti migration integrity contract PASSED: applied migration content is checksum-bound.");
