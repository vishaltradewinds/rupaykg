import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const sourcePath = [
  "../src/sync-routes.ts",
  "../../src/sync-routes.ts",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!sourcePath) throw new Error("Field-sync route source not found");
const routeSource = readFileSync(sourcePath, "utf8");

test("field sync write contract requires explicit geography scope and a resource-flow endpoint", () => {
  assert.match(routeSource, /organization_has_explicit_geography_scope\(om\.organization_id, \$2\)/);
  assert.match(routeSource, /if \(!sourceGeographyId && !destinationGeographyId\)/);
});

test("resource-flow database guard fails closed for missing, unscoped and out-of-scope geography", {
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
  const insertFlow = (source: string | null, destination: string | null) => pool.query(
    "insert into resource_flows(organization_id,origin_type,resource_form,material_code,declared_quantity,unit,source_geography_id,destination_geography_id) values($1,'COLLECTION','SOLID','MIXED_MSW',1,'kg',$2,$3)",
    [organizationId, source, destination],
  );
  try {
    await pool.query("insert into organizations(id,name,organization_type) values($1,$2,'TEST_FIXTURE')", [organizationId, "Resource flow strict geography " + suffix]);
    await pool.query(
      "insert into geography(id,kind,code,name,source,source_version) values($1,'CLUSTER',$2,$3,'synthetic-test-fixture','v1'),($4,'CLUSTER',$5,$6,'synthetic-test-fixture','v1')",
      [inScopeId, "RF-IN-" + suffix, "Resource flow in-scope " + suffix,
        outsideId, "RF-OUT-" + suffix, "Resource flow out-of-scope " + suffix],
    );

    await assert.rejects(insertFlow(null, null), /RESOURCE_FLOW_GEOGRAPHY_REQUIRED/);
    await assert.rejects(insertFlow(inScopeId, null), /RESOURCE_FLOW_SOURCE_GEOGRAPHY_FORBIDDEN/);

    await pool.query(
      "insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [organizationId, inScopeId],
    );
    await insertFlow(inScopeId, null);
    await assert.rejects(insertFlow(inScopeId, outsideId), /RESOURCE_FLOW_DESTINATION_GEOGRAPHY_FORBIDDEN/);
  } finally {
    await pool.query("delete from resource_flows where organization_id=$1", [organizationId]).catch(() => undefined);
    await pool.query("delete from organization_geography_scopes where organization_id=$1", [organizationId]).catch(() => undefined);
    await pool.query("delete from organizations where id=$1", [organizationId]).catch(() => undefined);
    await pool.query("delete from geography where id=any($1::uuid[])", [[inScopeId, outsideId]]).catch(() => undefined);
    await pool.end();
  }
});
