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
]) {
  if (!source.includes(required)) failures.push("missing migration integrity control: " + required);
}
if (failures.length) {
  console.error("Shakti migration integrity contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti migration integrity contract PASSED: applied migration content is checksum-bound.");
