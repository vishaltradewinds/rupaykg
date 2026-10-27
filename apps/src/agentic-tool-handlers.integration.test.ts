import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { executeAgenticReadTools } from "./agentic-tool-handlers.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("agentic read tools enforce PostgreSQL tenant and exact geography isolation", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let organizationId = "";
  let otherOrganizationId = "";
  const geographyIds: string[] = [];
  const activityIds: string[] = [];
  try {
    organizationId = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-AGENTIC-OWNER-" + suffix],
    )).rows[0]!.id;
    otherOrganizationId = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-AGENTIC-OTHER-" + suffix],
    )).rows[0]!.id;

    const root = (await pool.query<{ id: string }>(
      "insert into geography(kind,name,source,source_version) values('STATE_UT',$1,'agentic-integration-test','fixture-v1') returning id",
      ["TEST-AGENTIC-ROOT-" + suffix],
    )).rows[0]!.id;
    geographyIds.push(root);
    const child = (await pool.query<{ id: string }>(
      "insert into geography(parent_id,kind,name,source,source_version) values($1,'DISTRICT',$2,'agentic-integration-test','fixture-v1') returning id",
      [root, "TEST-AGENTIC-CHILD-" + suffix],
    )).rows[0]!.id;
    geographyIds.push(child);

    await pool.query(
      "insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [organizationId, root],
    );

    const ownRootActivity = (await pool.query<{ id: string }>(
      "insert into activities(organization_id,geography_id,activity_type,status) values($1,$2,'AGENTIC_TEST_ROOT','COMPLETED') returning id",
      [organizationId, root],
    )).rows[0]!.id;
    activityIds.push(ownRootActivity);
    const ownChildActivity = (await pool.query<{ id: string }>(
      "insert into activities(organization_id,geography_id,activity_type,status) values($1,$2,'AGENTIC_TEST_CHILD','COMPLETED') returning id",
      [organizationId, child],
    )).rows[0]!.id;
    activityIds.push(ownChildActivity);
    const otherTenantActivity = (await pool.query<{ id: string }>(
      "insert into activities(organization_id,geography_id,activity_type,status) values($1,$2,'AGENTIC_TEST_OTHER_TENANT','COMPLETED') returning id",
      [otherOrganizationId, root],
    )).rows[0]!.id;
    activityIds.push(otherTenantActivity);

    const result = await executeAgenticReadTools(pool, {
      goal: "trace_resource_flow",
      organizationId,
      geographyId: root,
    });
    assert.deepEqual(result.sourceRecordIds, [ownRootActivity]);
    assert.ok(!result.sourceRecordIds.includes(ownChildActivity), "an exact geography request must not include a child geography");
    assert.ok(!result.sourceRecordIds.includes(otherTenantActivity), "a tenant query must never include another organization's activity");
  } finally {
    if (activityIds.length) {
      await pool.query("delete from verifications where activity_id=any($1::uuid[])", [activityIds]);
      await pool.query("delete from evidence where activity_id=any($1::uuid[])", [activityIds]);
      await pool.query("delete from measurements where activity_id=any($1::uuid[])", [activityIds]);
      await pool.query("delete from activities where id=any($1::uuid[])", [activityIds]);
    }
    if (organizationId) {
      await pool.query("delete from organization_geography_scopes where organization_id=$1", [organizationId]);
    }
    if (organizationId) await pool.query("delete from organizations where id=$1", [organizationId]);
    if (otherOrganizationId) await pool.query("delete from organizations where id=$1", [otherOrganizationId]);
    if (geographyIds.length) await pool.query("delete from geography where id=any($1::uuid[])", [geographyIds.reverse()]);
    await pool.end();
  }
});
