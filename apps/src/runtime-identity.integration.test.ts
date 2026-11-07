import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

const enabled =
  process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" &&
  process.env.RUPAYKG_REQUIRE_NON_BYPASSRLS === "1" &&
  Boolean(process.env.DATABASE_URL);

test("Shakti production runtime identity is non-BYPASSRLS and tenant-isolated", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let organizationA = "";
  let organizationB = "";
  let activityA = "";
  let activityB = "";

  try {
    const role = (await pool.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean; rolcreatedb: boolean }>(
      "select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb from pg_roles where rolname=current_user",
    )).rows[0]!;

    assert.equal(role.rolsuper, false, "application runtime must not be SUPERUSER");
    assert.equal(role.rolbypassrls, false, "application runtime must not BYPASSRLS");
    assert.equal(role.rolcreaterole, false, "application runtime must not CREATEROLE");
    assert.equal(role.rolcreatedb, false, "application runtime must not CREATEDB");

    organizationA = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RUNTIME-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RUNTIME-B-" + suffix],
    )).rows[0]!.id;

    activityA = (await pool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RUNTIME_IDENTITY_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    activityB = (await pool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RUNTIME_IDENTITY_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationB],
    )).rows[0]!.id;

    const contextIdentity = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["runtime-identity:" + suffix, "Runtime Identity " + suffix, "runtime-identity-" + suffix + "@example.invalid"],
    )).rows[0]!.id;

    const roleA = (await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'runtime_test_role','[\"activity:read\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;

    const membershipA = (await pool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [contextIdentity, organizationA, roleA],
    )).rows[0]!.id;

    try {
      await pool.query("select app.set_request_context($1,$2)", [contextIdentity, organizationA]);

      const visible = await pool.query<{ id: string; organization_id: string }>(
        "select id, organization_id from activities where id in ($1,$2) order by id",
        [activityA, activityB],
      );
      assert.equal(visible.rows.length, 1, "runtime role must not see another tenant's activity");
      assert.equal(visible.rows[0]!.id, activityA);
      assert.equal(visible.rows[0]!.organization_id, organizationA);

      await assert.rejects(
        () => pool.query(
          "insert into activities(organization_id,activity_type,status,metadata) values($1,'RUNTIME_IDENTITY_TEST','DRAFT','{}'::jsonb)",
          [organizationB],
        ),
        /row-level security|policy/i,
      );
    } finally {
      await pool.query("delete from organization_memberships where id=$1", [membershipA]);
      await pool.query("delete from roles where id=$1", [roleA]);
      await pool.query("delete from identities where id=$1", [contextIdentity]);
    }
  } finally {
    if (activityA) await pool.query("delete from activities where id=$1", [activityA]);
    if (activityB) await pool.query("delete from activities where id=$1", [activityB]);
    if (organizationA) await pool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await pool.query("delete from organizations where id=$1", [organizationB]);
    await pool.end();
  }
});
