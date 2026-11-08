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
  ["future function PUBLIC EXECUTE default revoke", /alter\s+default\s+privileges\s+for\s+role\s+%I\s+revoke\s+execute\s+on\s+functions\s+from\s+public/i],
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

const requiredRuntimeFunctions = new Map([
  ["app.current_identity_id()", { name: "app.current_identity_id", args: "", searchPath: "public, app" }],
  ["app.current_organization_id()", { name: "app.current_organization_id", args: "", searchPath: "public, app" }],
  ["app.set_request_context(uuid,uuid)", { name: "app.set_request_context", args: "p_identity_id uuid, p_organization_id uuid", searchPath: "public, app" }],
  ["app.set_identity_context(uuid)", { name: "app.set_identity_context", args: "p_identity_id uuid", searchPath: "public, app" }],
  ["app.set_platform_context(uuid)", { name: "app.set_platform_context", args: "p_identity_id uuid", searchPath: "public, app" }],
  ["app.set_authority_context(uuid,text,uuid)", { name: "app.set_authority_context", args: "p_identity_id uuid, p_authority_level text, p_geography_id uuid", searchPath: "public, app" }],
  ["app.is_assigned_approved_verifier(uuid)", { name: "app.is_assigned_approved_verifier", args: "p_credential_id uuid", searchPath: "pg_catalog, public, app" }],
]);

const stripSqlComments = (source) =>
  source
    .replace(/--[^\n]*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

const allMigrationSource = [];
for (const file of files) {
  allMigrationSource.push({
    file,
    source: stripSqlComments(await readFile(path.join(dir, file), "utf8")),
  });
}

const functionBlocksBySignature = new Map();
for (const { file, source } of allMigrationSource) {
  const starts = [...source.matchAll(/create\s+(?:or\s+replace\s+)?function\s+app\.([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/gi)];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index ?? 0;
    const end = starts[i + 1]?.index ?? source.length;
    const name = starts[i][1];
    const args = starts[i][2].replace(/\s+/g, " ").trim();
    const signature = name + "(" + args + ")";
    functionBlocksBySignature.set(signature, { file, block: source.slice(start, end) });
  }
}

for (const [displayName, expected] of requiredRuntimeFunctions) {
  const expectedSignature = expected.name + "(" + expected.args + ")";
  const matching = [...functionBlocksBySignature.entries()]
    .filter(([signature]) => signature.replace(/\s+/g, " ").trim().toLowerCase() === expectedSignature.toLowerCase())
    .at(-1)?.[1];
  const block = matching?.block;
  if (!block) {
    failures.push("required runtime function is not defined in migrations: " + displayName);
    continue;
  }
  if (!/security\s+definer/i.test(block)) {
    failures.push("latest definition of required runtime function is not SECURITY DEFINER: " + displayName);
  }
  const expectedSearchPath = expected.searchPath.replace(/\s+/g, "").toLowerCase();
  const searchPathMatch = block.match(/set\s+search_path\s*=\s*([^\n]+)/i);
  const actualSearchPath = searchPathMatch?.[1]?.replace(/\s+/g, "").replace(/\s+as\s+\$\$.*$/i, "").replace(/\s+as\s+\$shakti\$.*$/i, "").toLowerCase();
  if (actualSearchPath !== expectedSearchPath) {
    failures.push("latest definition of required runtime function has unexpected search_path: " + displayName + " (expected " + expected.searchPath + ")");
  }
}

if (/grant\s+execute\s+on\s+function\s+app\.[^;]+\s+to\s+public/i.test(boundaryMigration)) {
  failures.push("101_security_definer_schema_boundary.sql: SECURITY DEFINER EXECUTE must not be granted to PUBLIC");
}

const runtimeGrantLines = boundaryMigration.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^grant execute on function app\./i.test(line));
const approvedRuntimeGrantSet = new Set(requiredRuntimeExecutes);
for (const grantLine of runtimeGrantLines) {
  if (!approvedRuntimeGrantSet.has(grantLine)) failures.push("101_security_definer_schema_boundary.sql: unapproved runtime EXECUTE grant: " + grantLine);
}

for (const file of files) {
  const source = await readFile(path.join(dir, file), "utf8");
  const functionStarts = [...source.matchAll(/create\s+(?:or\s+replace\s+)?function\b/gi)].map((m) => m.index ?? 0);
  for (let i = 0; i < functionStarts.length; i++) {
    const start = functionStarts[i];
    const end = functionStarts[i + 1] ?? source.length;
    const block = source.slice(start, end);
    if (!/security\s+definer/i.test(block)) continue;
    const searchPathMatch = block.match(/set\s+search_path\s*=\s*([^\n]+)/i);
    const normalizedSearchPath = searchPathMatch?.[1]?.replace(/\s+/g, "").toLowerCase();
    const approvedSearchPaths = new Set(["public,app", "pg_catalog,public,app"]);
    if (!normalizedSearchPath || !approvedSearchPaths.has(normalizedSearchPath)) {
      failures.push(file + ": SECURITY DEFINER function must use an approved fixed search_path (public, app or pg_catalog, public, app)");
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
