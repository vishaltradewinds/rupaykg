import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const migrationPath = [
  "../../migrations/20261030_explicit_geography_scope.sql",
  "../../../migrations/20261030_explicit_geography_scope.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("Explicit geography scope migration not found");
const migrationSql = readFileSync(migrationPath, "utf8");

test("strict geography scope contract requires a verified root and requested geography containment", () => {
  assert.match(migrationSql, /create or replace function organization_has_explicit_geography_scope/i);
  assert.match(migrationSql, /p_geography_id is not null/i);
  assert.match(migrationSql, /s\.status = 'VERIFIED'/i);
  assert.match(migrationSql, /organization_has_geography_scope\(p_organization_id, p_geography_id\)/i);
  assert.match(migrationSql, /Does not change legacy helper semantics/i);
});

test("strict geography helper denies unscoped and out-of-scope organizations in PostgreSQL", {
  skip: !(process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && process.env.DATABASE_URL)
    ? "requires CI disposable PostgreSQL and applied migrations"
    : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 2,
  });
  const organizationId = randomUUID();
  const inScopeId = randomUUID();
  const outOfScopeId = randomUUID();
  const suffix = randomUUID();
  try {
    await pool.query(
      "insert into organizations(id,name,organization_type) values($1,$2,'TEST_FIXTURE')",
      [organizationId, "Strict geography scope test " + suffix],
    );
    await pool.query(
      "insert into geography(id,kind,code,name,source,source_version) values($1,'CLUSTER',$2,$3,'synthetic-test-fixture','v1'),($4,'CLUSTER',$5,$6,'synthetic-test-fixture','v1')",
      [inScopeId, "STRICT-IN-" + suffix, "Strict in-scope geography " + suffix,
        outOfScopeId, "STRICT-OUT-" + suffix, "Strict out-of-scope geography " + suffix],
    );

    const unscoped = await pool.query<{ allowed: boolean }>(
      "select organization_has_explicit_geography_scope($1,$2) as allowed",
      [organizationId, inScopeId],
    );
    assert.equal(unscoped.rows[0]?.allowed, false, "unscoped tenant must fail closed for strict paths");

    await pool.query(
      "insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [organizationId, inScopeId],
    );
    const inside = await pool.query<{ allowed: boolean }>(
      "select organization_has_explicit_geography_scope($1,$2) as allowed",
      [organizationId, inScopeId],
    );
    assert.equal(inside.rows[0]?.allowed, true, "verified in-scope geography must be accepted");

    const outside = await pool.query<{ allowed: boolean }>(
      "select organization_has_explicit_geography_scope($1,$2) as allowed",
      [organizationId, outOfScopeId],
    );
    assert.equal(outside.rows[0]?.allowed, false, "geography outside the verified root must be rejected");
  } finally {
    await pool.query("delete from organization_geography_scopes where organization_id=$1", [organizationId]).catch(() => undefined);
    await pool.query("delete from organizations where id=$1", [organizationId]).catch(() => undefined);
    await pool.query("delete from geography where id=any($1::uuid[])", [[inScopeId, outOfScopeId]]).catch(() => undefined);
    await pool.end();
  }
});
