#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dir = path.resolve("migrations");
const files = (await readdir(dir)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
const failures = [];

const boundaryMigration = await readFile(path.join(dir, "101_security_definer_schema_boundary.sql"), "utf8");
const requiredBoundaryControls = [
  ["public schema CREATE revoke", /revoke\s+create\s+on\s+schema\s+public\s+from\s+public/i],
  ["app schema CREATE revoke", /revoke\s+create\s+on\s+schema\s+app\s+from\s+public/i],
  ["PUBLIC EXECUTE revoke", /revoke\s+all\s+on\s+function\s+%I\.%I\(%s\)\s+from\s+public/i],
];
for (const [name, pattern] of requiredBoundaryControls) {
  if (!pattern.test(boundaryMigration)) failures.push("101_security_definer_schema_boundary.sql: missing " + name);
}
const requiredRuntimeExecutes = [
  "grant execute on function app.current_identity_id() to rupaykg_app_runtime;",
  "grant execute on function app.current_organization_id() to rupaykg_app_runtime;",
  "grant execute on function app.set_request_context(uuid,uuid) to rupaykg_app_runtime;",
  "grant execute on function app.set_identity_context(uuid) to rupaykg_app_runtime;",
  "grant execute on function app.set_platform_context(uuid) to rupaykg_app_runtime;",
  "grant execute on function app.set_authority_context(uuid,text,uuid) to rupaykg_app_runtime;",
];
for (const grant of requiredRuntimeExecutes) {
  if (!boundaryMigration.includes(grant)) failures.push("101_security_definer_schema_boundary.sql: missing explicit runtime grant: " + grant);
}

for (const file of files) {
  const source = await readFile(path.join(dir, file), "utf8");
  const functionStarts = [...source.matchAll(/create\s+(?:or\s+replace\s+)?function\b/gi)].map((m) => m.index ?? 0);
  for (let i = 0; i < functionStarts.length; i++) {
    const start = functionStarts[i];
    const end = functionStarts[i + 1] ?? source.length;
    const block = source.slice(start, end);
    if (!/security\s+definer/i.test(block)) continue;
    if (!/set\s+search_path\s*=\s*public,\s*app\b/i.test(block)) {
      failures.push(file + ": SECURITY DEFINER function must use fixed search_path = public, app");
    }
    if (/grant\s+execute\s+on\s+function\s+[^;]+\s+to\s+public/i.test(block)) {
      failures.push(file + ": SECURITY DEFINER function must not grant EXECUTE to PUBLIC");
    }
  }
}

if (failures.length) {
  console.error("Shakti SECURITY DEFINER migration contract FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log(`Shakti SECURITY DEFINER migration contract PASSED: audited ${files.length} migrations.`);
