import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

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
  assert.match(migrationSql, /before insert or update of organization_id, geography_id on activities/i);
  assert.match(migrationSql, /existing rows are not rewritten/i);
});

test("activity database guard rejects missing, unscoped and out-of-scope geography", {
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
  const outsideId = randomUUID();
  const suffix = randomUUID();
  const insertedActivityIds: string[] = [];
  const insertActivity = (geographyId: string | null) => pool.query<{ id: string }>(
    "insert into activities(organization_id,geography_id,activity_type,status) values($1,$2,'WASTE_WEIGHT_MEASUREMENT','COMPLETED') returning id",
    [organizationId, geographyId],
  );

  try {
    await pool.query(
      "insert into organizations(id,name,organization_type) values($1,$2,'TEST_FIXTURE')",
      [organizationId, "Activity strict geography " + suffix],
    );
    await pool.query(
      "insert into geography(id,kind,code,name,source,source_version) values($1,'CLUSTER',$2,$3,'synthetic-test-fixture','v1'),($4,'CLUSTER',$5,$6,'synthetic-test-fixture','v1')",
      [inScopeId, "ACT-IN-" + suffix, "Activity in-scope " + suffix,
        outsideId, "ACT-OUT-" + suffix, "Activity out-of-scope " + suffix],
    );

    await assert.rejects(insertActivity(null), /ACTIVITY_GEOGRAPHY_REQUIRED/);
    await assert.rejects(insertActivity(inScopeId), /ACTIVITY_GEOGRAPHY_FORBIDDEN/);

    await pool.query(
      "insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [organizationId, inScopeId],
    );
    const accepted = await insertActivity(inScopeId);
    insertedActivityIds.push(accepted.rows[0]!.id);

    await assert.rejects(insertActivity(outsideId), /ACTIVITY_GEOGRAPHY_FORBIDDEN/);
  } finally {
    if (insertedActivityIds.length) {
      await pool.query("delete from activities where id=any($1::uuid[])", [insertedActivityIds]).catch(() => undefined);
    }
    await pool.query("delete from organization_geography_scopes where organization_id=$1", [organizationId]).catch(() => undefined);
    await pool.query("delete from organizations where id=$1", [organizationId]).catch(() => undefined);
    await pool.query("delete from geography where id=any($1::uuid[])", [[inScopeId, outsideId]]).catch(() => undefined);
    await pool.end();
  }
});
