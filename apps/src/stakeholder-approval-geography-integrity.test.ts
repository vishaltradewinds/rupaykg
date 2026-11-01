import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

test("stakeholder approvals cannot drift from application geography, including null scope", async () => {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const suffix = randomUUID();
  try {
    await client.query("begin");
    const org = (await client.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`stakeholder-approval-geo-${suffix}`],
    )).rows[0]!.id;
    const identity = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`stakeholder-approval-geo-${suffix}`, "Stakeholder Approval Geography Test"],
    )).rows[0]!.id;
    const role = (await client.query<{ id: string }>(
      "insert into roles(organization_id,name) values($1,$2) returning id",
      [org, `stakeholder-approval-geo-${suffix}`],
    )).rows[0]!.id;
    const geography = (await client.query<{ id: string }>(
      "insert into geography(kind,name) values('STATE_UT',$1) returning id",
      [`Stakeholder geography ${suffix}`],
    )).rows[0]!.id;

    const scopedApplication = (await client.query<{ id: string }>(
      "insert into stakeholder_applications(identity_id,organization_id,role_id,requested_role_key,requested_organization_type,geography_id) values($1,$2,$3,'TEST','COLLECTOR',$4) returning id",
      [identity, org, role, geography],
    )).rows[0]!.id;
    const seeded = await client.query<{ id: string }>(
      "select id from stakeholder_application_approvals where application_id=$1",
      [scopedApplication],
    );
    assert.ok(seeded.rowCount && seeded.rowCount > 0, "approval chain should be seeded");
    await assert.rejects(
      client.query(
        "insert into stakeholder_application_approvals(application_id,step_order,approval_level,geography_id) values($1,99,'PLATFORM',null)",
        [scopedApplication],
      ),
      (error: { message?: string }) => error.message?.includes("STAKEHOLDER_APPROVAL_GEOGRAPHY_MISMATCH") === true,
    );
    await assert.rejects(
      client.query(
        "update stakeholder_applications set geography_id=null where id=$1",
        [scopedApplication],
      ),
      (error: { message?: string }) => error.message?.includes("STAKEHOLDER_APPLICATION_GEOGRAPHY_IMMUTABLE_AFTER_APPROVAL_CHAIN") === true,
    );

    const globalApplication = (await client.query<{ id: string }>(
      "insert into stakeholder_applications(identity_id,organization_id,role_id,requested_role_key,requested_organization_type,geography_id) values($1,$2,$3,'TEST_GLOBAL','COLLECTOR',null) returning id",
      [identity, org, role],
    )).rows[0]!.id;
    const globalApproval = await client.query<{ id: string }>(
      "select id from stakeholder_application_approvals where application_id=$1 limit 1",
      [globalApplication],
    );
    assert.ok(globalApproval.rows[0]?.id, "global application should receive a platform approval step");
    await assert.rejects(
      client.query(
        "update stakeholder_application_approvals set geography_id=$2 where id=$1",
        [globalApproval.rows[0]!.id, geography],
      ),
      (error: { message?: string }) => error.message?.includes("STAKEHOLDER_APPROVAL_GEOGRAPHY_MISMATCH") === true,
    );
    await client.query("rollback");
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
