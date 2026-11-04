import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

test("stakeholder application cannot request another organization's role", async () => {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const suffix = randomUUID();
  try {
    await client.query("begin");
    const orgA = (await client.query<{id:string}>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      ["stakeholder-role-org-a-" + suffix],
    )).rows[0]!.id;
    const orgB = (await client.query<{id:string}>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      ["stakeholder-role-org-b-" + suffix],
    )).rows[0]!.id;
    const identity = (await client.query<{id:string}>(
      "insert into identities(external_subject,display_name) values($1,'Stakeholder Role Test') returning id",
      ["stakeholder-role-identity-" + suffix],
    )).rows[0]!.id;
    const identity2 = (await client.query<{id:string}>(
      "insert into identities(external_subject,display_name) values($1,'Stakeholder Role Test 2') returning id",
      ["stakeholder-role-identity-2-" + suffix],
    )).rows[0]!.id;
    const roleA = (await client.query<{id:string}>(
      "insert into roles(organization_id,name,permissions) values($1,$2,'[]'::jsonb) returning id",
      [orgA,"requested-role-a-" + suffix],
    )).rows[0]!.id;
    const roleB = (await client.query<{id:string}>(
      "insert into roles(organization_id,name,permissions) values($1,$2,'[]'::jsonb) returning id",
      [orgB,"requested-role-b-" + suffix],
    )).rows[0]!.id;

    await client.query(
      "insert into stakeholder_applications(identity_id,organization_id,role_id,requested_role_key,requested_organization_type) values($1,$2,$3,'COLLECTOR_MEMBER','COLLECTOR')",
      [identity,orgA,roleA],
    );

    await client.query("savepoint cross_org_role");
    await assert.rejects(
      client.query(
        "insert into stakeholder_applications(identity_id,organization_id,role_id,requested_role_key,requested_organization_type) values($1,$2,$3,'COLLECTOR_MEMBER','COLLECTOR')",
        [identity2,orgA,roleB],
      ),
      (error: {code?:string; constraint?:string}) =>
        error.code === "23503" && error.constraint === "stakeholder_applications_role_organization_fk",
    );
    await client.query("rollback to savepoint cross_org_role");
    await client.query("release savepoint cross_org_role");
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback").catch(()=>undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
