import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

/**
 * Exercises the real PostgreSQL constraints and trigger installed by the ICVCM
 * migration. Every fixture is created inside one transaction and rolled back,
 * so the test is safe for the explicitly disposable CI database.
 */
test("PostgreSQL enforces append-only ICVCM assessment history and unique revisions", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const suffix = randomBytes(8).toString("hex");
  try {
    await client.query("begin");

    const organization = await client.query<{ id: string }>(
      "insert into organizations(name, organization_type, status) values($1, 'test_fixture', 'VERIFIED') returning id",
      ["TEST-ICVCM-" + suffix],
    );
    const organizationId = organization.rows[0]!.id;
    const identity = await client.query<{ id: string }>(
      "insert into identities(external_subject, display_name, status) values($1, $2, 'VERIFIED') returning id",
      ["test-icvcm:" + suffix, "ICVCM Integration Test"],
    );
    const identityId = identity.rows[0]!.id;
    const activity = await client.query<{ id: string }>(
      "insert into activities(organization_id, actor_identity_id, activity_type, status, metadata) values($1, $2, 'ICVCM_TEST_FIXTURE', 'DRAFT', '{}'::jsonb) returning id",
      [organizationId, identityId],
    );
    const activityId = activity.rows[0]!.id;

    const otherOrganization = await client.query<{ id: string }>(
      "insert into organizations(name, organization_type, status) values($1, 'test_fixture', 'VERIFIED') returning id",
      ["TEST-ICVCM-OTHER-" + suffix],
    );
    await client.query("savepoint before_cross_organization_insert");
    await assert.rejects(
      client.query(
        `insert into icvcm_ccp_assessments
          (organization_id, activity_id, assessed_by_identity_id, revision_number, assessment, summary, status)
         values ($1, $2, $3, 1, '[]'::jsonb, '{"status":"GAPS_IDENTIFIED"}'::jsonb, 'INTERNAL_DRAFT')`,
        [otherOrganization.rows[0]!.id, activityId, identityId],
      ),
      /organization must match the activity organization/i,
      "database must reject an assessment that claims an activity owned by another organization",
    );
    await client.query("rollback to savepoint before_cross_organization_insert");

    const insertAssessment = () => client.query(
      `insert into icvcm_ccp_assessments
        (organization_id, activity_id, assessed_by_identity_id, revision_number, assessment, summary, status)
       values ($1, $2, $3, 1, $4::jsonb, $5::jsonb, 'INTERNAL_DRAFT') returning id`,
      [organizationId, activityId, identityId, JSON.stringify([]), JSON.stringify({ status: "GAPS_IDENTIFIED" })],
    );
    const inserted = await insertAssessment();
    const assessmentId = inserted.rows[0]?.id as string | undefined;
    assert.ok(assessmentId, "first internal draft should persist");

    await client.query("savepoint before_activity_owner_rewrite");
    await assert.rejects(
      client.query("update activities set organization_id=$2 where id=$1",[activityId,otherOrganization.rows[0]!.id]),
      /activity organization\/geography backing ICVCM assessment history is immutable/i,
      "ICVCM assessment history must retain the activity's assessed organization"
    );
    await client.query("rollback to savepoint before_activity_owner_rewrite");

    await client.query("savepoint before_update_attempt");
    await assert.rejects(
      client.query("update icvcm_ccp_assessments set summary = '{}'::jsonb where id = $1", [assessmentId]),
      /append-only/i,
      "database trigger must reject updates to assessment history",
    );
    await client.query("rollback to savepoint before_update_attempt");

    await client.query("savepoint before_delete_attempt");
    await assert.rejects(
      client.query("delete from icvcm_ccp_assessments where id = $1", [assessmentId]),
      /append-only/i,
      "database trigger must reject deletes from assessment history",
    );
    await client.query("rollback to savepoint before_delete_attempt");

    await client.query("savepoint before_duplicate_revision");
    await assert.rejects(
      insertAssessment(),
      /unique constraint|duplicate key/i,
      "the same organization/activity revision number must not be inserted twice",
    );
    await client.query("rollback to savepoint before_duplicate_revision");

    const history = await client.query<{ count: string; revision_number: number; status: string }>(
      "select count(*)::text as count, min(revision_number) as revision_number, min(status) as status from icvcm_ccp_assessments where organization_id=$1 and activity_id=$2",
      [organizationId, activityId],
    );
    assert.equal(history.rows[0]?.count, "1", "failed mutation attempts must leave the original history intact");
    assert.equal(history.rows[0]?.revision_number, 1);
    assert.equal(history.rows[0]?.status, "INTERNAL_DRAFT");
  } finally {
    // Includes all fixture rows and the assessment because no test data is committed.
    try { await client.query("rollback"); } catch {}
    client.release();
    await pool.end();
  }
});
