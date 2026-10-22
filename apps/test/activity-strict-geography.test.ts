import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migrationPath = [
  "../../migrations/20261114_strict_activity_geography.sql",
  "../../../migrations/20261114_strict_activity_geography.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("Strict activity geography migration not found");
const migrationSql = readFileSync(migrationPath, "utf8");

test("activity database guard requires geography and explicit verified organization scope", () => {
  assert.match(migrationSql, /create or replace function enforce_activity_geography_scope/i);
  assert.match(migrationSql, /new\.geography_id is null/i);
  assert.match(migrationSql, /ACTIVITY_GEOGRAPHY_REQUIRED/);
  assert.match(migrationSql, /organization_has_explicit_geography_scope\(new\.organization_id, new\.geography_id\)/);
  assert.match(migrationSql, /ACTIVITY_GEOGRAPHY_FORBIDDEN/);
  assert.match(migrationSql, /before insert or update on activities/i);
  assert.match(migrationSql, /existing rows are not rewritten/i);
});
