import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function migrationRunnerSource(): string {
  const path = [
    "../../src/migrate.ts",
    "../src/migrate.ts",
  ].map((relative) => fileURLToPath(new URL(relative, import.meta.url))).find(existsSync);
  if (!path) throw new Error("Migration runner source not found");
  return readFileSync(path, "utf8");
}

test("production migration runner validates configuration before database connection", () => {
  const source = migrationRunnerSource();
  const validation = source.indexOf("const config = readProductionConfig()");
  const poolCreation = source.indexOf("const pool = new Pool");
  assert.notEqual(validation, -1, "production config preflight must exist");
  assert.ok(poolCreation > validation, "database connection must not happen before production config validation");
});

test("migration runner serializes concurrent starts with a session advisory lock", () => {
  const source = migrationRunnerSource();
  assert.match(source, /pg_advisory_lock/);
  assert.match(source, /pg_advisory_unlock/);
  assert.match(source, /await client\.query\("begin"\)/);
  assert.match(source, /await client\.query\("commit"\)/);
});

test("migration filename filter recognizes numbered SQL migration files", () => {
  const source = migrationRunnerSource();
  const line = source.split("\n").find((entry) => entry.includes(".filter((name) =>"));
  assert.ok(line, "migration runner must expose its numbered SQL filename filter");
  const start = line.indexOf("/") + 1;
  const end = line.lastIndexOf("/.test(name)");
  assert.ok(start > 0 && end > start, "migration filename filter must be a regex literal");
  const pattern = new RegExp(line.slice(start, end));
  assert.equal(pattern.test("001_initial_schema.sql"), true);
  assert.equal(pattern.test("20261129_credential_descendant_scope.sql"), true);
  assert.equal(pattern.test("README.md"), false);
});
