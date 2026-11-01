import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

test("stakeholder approval geography must match its application, including NULL scope", async () => {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const suffix = randomUUID();
  const ids: Record<string, string> = {};
  const expectRejected = async (name: string, sql: string, values: unknown[], expectedMessage: string) => {
    await client.query("savepoint " + name);
    await assert.rejects(
      client.query(sql, values),
      (error: { message?: string }) => (error.message ?? "").includes(expectedMessage),
    );
    await client.query("rollback to savepoint " + name);
    await client.query("release savepoint " + name);
  };

  try {
    await client.query("begin");
    ids.org = (await client.query<{id:string}>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`onboarding-geo-org-${suffix}`],
    )).rows[0]!.id;
    ids.actor = (await client.query<{id:string}>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`onboarding-geo-actor-${suffix}`, "Onboarding Geography Test"],
    )).rows[0]!.id;
    ids.role = (await client.query<{id:string}>(
      "insert into roles(organization_id,name,permissions) values($1,$2,'[]'::jsonb) returning id",
      [ids.org, `onboarding_geo_test_${suffix}`],
    )).rows[0]!.id;
    ids.geoA = (await client.query<{id:string}>(
      "insert into geography(kind,name,code) values('DISTRICT',$1,$2) returning id",
      [`Test District A ${suffix}`, `TDA-${suffix}`],
    )).rows[0]!.id;
    ids.geoB = (await client.query<{id:string}>(
      "insert into geography(kind,name,code) values('DISTRICT',$1,$2) returning id",
      [`Test District B ${suffix}`, `TDB-${suffix}`],
    )).rows[0]!.id;

    ids.application = (await client.query<{id:string}>(
      `insert into stakeholder_applications
       (identity_id,organization_id,role_id,requested_role_key,requested_organization_type,geography_id)
       values($1,$2,$3,'collector','COLLECTOR',$4) returning id`,
      [ids.actor, ids.org, ids.role, ids.geoA],
    )).rows[0]!.id;
    ids.approval = (await client.query<{id:string}>(
      "select id from stakeholder_application_approvals where application_id=$1 order by step_order limit 1",
      [ids.application],
    )).rows[0]!.id;

    await client.query(
      "update stakeholder_application_approvals set geography_id=$1 where id=$2",
      [ids.geoA, ids.approval],
    );
    await expectRejected(
      "approval_insert_wrong_geography",
      "insert into stakeholder_application_approvals(application_id,step_order,approval_level,geography_id) values($1,99,'PLATFORM',$2)",
      [ids.application, ids.geoB],
      "STAKEHOLDER_APPROVAL_GEOGRAPHY_MISMATCH",
    );
    await expectRejected(
      "approval_update_wrong_geography",
      "update stakeholder_application_approvals set geography_id=$1 where id=$2",
      [ids.geoB, ids.approval],
      "STAKEHOLDER_APPROVAL_GEOGRAPHY_MISMATCH",
    );
    await expectRejected(
      "application_geography_drift",
      "update stakeholder_applications set geography_id=$1 where id=$2",
      [ids.geoB, ids.application],
      "STAKEHOLDER_APPLICATION_GEOGRAPHY_IMMUTABLE_AFTER_APPROVAL_CHAIN",
    );

    // A separate identity is required: the schema intentionally allows only
    // one application per identity/organization/role tuple.
    ids.nullActor = (await client.query<{id:string}>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`onboarding-geo-null-actor-${suffix}`, "Onboarding Geography NULL Test"],
    )).rows[0]!.id;
    ids.nullApplication = (await client.query<{id:string}>(
      `insert into stakeholder_applications
       (identity_id,organization_id,role_id,requested_role_key,requested_organization_type,geography_id)
       values($1,$2,$3,'collector','COLLECTOR',null) returning id`,
      [ids.nullActor, ids.org, ids.role],
    )).rows[0]!.id;
    ids.nullApproval = (await client.query<{id:string}>(
      "select id from stakeholder_application_approvals where application_id=$1 order by step_order limit 1",
      [ids.nullApplication],
    )).rows[0]!.id;
    await client.query(
      "update stakeholder_application_approvals set geography_id=null where id=$1",
      [ids.nullApproval],
    );
    await expectRejected(
      "null_application_non_null_approval",
      "update stakeholder_application_approvals set geography_id=$1 where id=$2",
      [ids.geoA, ids.nullApproval],
      "STAKEHOLDER_APPROVAL_GEOGRAPHY_MISMATCH",
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
