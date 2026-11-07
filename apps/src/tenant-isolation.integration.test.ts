import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { withTenantTransaction } from "./tenant-db.js";
import type { AuthContext } from "./auth.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("Shakti tenant context rejects cross-organization context switching", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationA = "";
  let organizationB = "";
  let roleA = "";
  let membershipA = "";
  try {
    organizationA = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      [`TEST-TENANT-A-${suffix}`],
    )).rows[0]!.id;
    organizationB = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      [`TEST-TENANT-B-${suffix}`],
    )).rows[0]!.id;
    identityId = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      [`tenant-negative:${suffix}`, `Tenant Negative ${suffix}`, `tenant-negative-${suffix}@example.invalid`],
    )).rows[0]!.id;
    roleA = (await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"dashboard:read\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;

    const fixtureClient = await pool.connect();
    try {
      await fixtureClient.query("begin");
      await fixtureClient.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
      membershipA = (await fixtureClient.query<{ id: string }>(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
        [identityId, organizationA, roleA],
      )).rows[0]!.id;
      await fixtureClient.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
      await fixtureClient.query("commit");
    } catch (error) {
      await fixtureClient.query("rollback");
      throw error;
    } finally {
      fixtureClient.release();
    }

    const authA: AuthContext = {
      identityId,
      memberships: [{ organization_id: organizationA, role_id: roleA, status: "VERIFIED" }],
      activeOrganizationId: organizationA,
    };

    const context = await withTenantTransaction(pool, authA, async client => {
      const row = (await client.query<{ identity_id: string; organization_id: string }>(
        "select app.current_identity_id() as identity_id, app.current_organization_id() as organization_id",
      )).rows[0]!;
      assert.equal(row.identity_id, identityId);
      assert.equal(row.organization_id, organizationA);
      return row;
    });
    assert.equal(context.organization_id, organizationA);

    const crossTenantClient = await pool.connect();
    try {
      await crossTenantClient.query("begin");
      await assert.rejects(
        () => crossTenantClient.query("select app.set_request_context($1,$2)", [identityId, organizationB]),
        /not a verified member of the requested organization/i,
      );
      await crossTenantClient.query("rollback");
    } catch (error) {
      try { await crossTenantClient.query("rollback"); } catch {}
      throw error;
    } finally {
      crossTenantClient.release();
    }

    const reset = await withTenantTransaction(pool, authA, async client => {
      const row = (await client.query<{ organization_id: string }>(
        "select app.current_organization_id() as organization_id",
      )).rows[0]!;
      return row.organization_id;
    });
    assert.equal(reset, organizationA);
  } finally {
    if (membershipA) await pool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await pool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await pool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await pool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await pool.query("delete from organizations where id=$1", [organizationB]);
    await pool.end();
  }
});

test("Shakti business-route contract rejects a cross-tenant organization context", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationA = "";
  let organizationB = "";
  let roleA = "";
  let membershipA = "";
  try {
    organizationA = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-BUSINESS-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-BUSINESS-B-" + suffix],
    )).rows[0]!.id;
    identityId = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["business-negative:" + suffix, "Business Negative " + suffix, "business-negative-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleA = (await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"activity:write\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;

    const fixtureClient = await pool.connect();
    try {
      await fixtureClient.query("begin");
      await fixtureClient.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
      membershipA = (await fixtureClient.query<{ id: string }>(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
        [identityId, organizationA, roleA],
      )).rows[0]!.id;
      await fixtureClient.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
      await fixtureClient.query("commit");
    } catch (error) {
      await fixtureClient.query("rollback");
      throw error;
    } finally {
      fixtureClient.release();
    }

    const authA: AuthContext = {
      identityId,
      memberships: [{ organization_id: organizationA, role_id: roleA, status: "VERIFIED" }],
      activeOrganizationId: organizationA,
    };

    await assert.rejects(
      () => withTenantTransaction(pool, { ...authA, activeOrganizationId: organizationB }, async client =>
        client.query("insert into activities(organization_id,status) values($1,'DRAFT')", [organizationB]),
      ),
      /not a verified member of the requested organization/i,
    );

    const context = await withTenantTransaction(pool, authA, async client =>
      client.query<{ organization_id: string }>("select app.current_organization_id() as organization_id"),
    );
    assert.equal(context.rows[0]!.organization_id, organizationA);
  } finally {
    if (membershipA) await pool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await pool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await pool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await pool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await pool.query("delete from organizations where id=$1", [organizationB]);
    await pool.end();
  }
});

test("Shakti RLS runtime role isolates core tenant rows", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationA = "";
  let organizationB = "";
  let roleA = "";
  let membershipA = "";
  let activityA = "";
  let activityB = "";
  try {
    const runtimeRole = (await pool.query<{ exists: boolean }>(
      "select exists(select 1 from pg_roles where rolname='rupaykg_app_runtime') as exists",
    )).rows[0]!.exists;
    if (!runtimeRole) throw new Error("RLS runtime role is not provisioned in the test database");

    organizationA = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-B-" + suffix],
    )).rows[0]!.id;
    identityId = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["rls-negative:" + suffix, "RLS Negative " + suffix, "rls-negative-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleA = (await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"activity:write\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    membershipA = (await pool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationA, roleA],
    )).rows[0]!.id;

    activityA = (await pool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    activityB = (await pool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationB],
    )).rows[0]!.id;

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);
      const visible = await client.query<{ id: string; organization_id: string }>(
        "select id, organization_id from activities where id in ($1,$2) order by id",
        [activityA, activityB],
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.id, activityA);
      assert.equal(visible.rows[0]!.organization_id, organizationA);

      await assert.rejects(
        () => client.query(
          "insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_TEST','DRAFT','{}'::jsonb)",
          [organizationB],
        ),
        /row-level security|policy/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (activityA) await pool.query("delete from activities where id=$1", [activityA]);
    if (activityB) await pool.query("delete from activities where id=$1", [activityB]);
    if (membershipA) await pool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await pool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await pool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await pool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await pool.query("delete from organizations where id=$1", [organizationB]);
    await pool.end();
  }
});
