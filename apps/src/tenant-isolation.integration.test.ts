import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { withIdentityTransaction, withTenantTransaction } from "./tenant-db.js";
import type { AuthContext } from "./auth.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL) && Boolean(process.env.RUPAYKG_TEST_OWNER_DATABASE_URL);

test("Shakti identity context rejects inactive identity and does not establish tenant scope", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  try {
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["identity-context:" + suffix, "Identity Context " + suffix, "identity-context-" + suffix + "@example.invalid"],
    )).rows[0]!.id;

    const context = await withIdentityTransaction(runtimePool, identityId, async client => {
      await client.query("set local role rupaykg_app_runtime");
      const row = (await client.query<{ identity_id: string; execution_scope: string; organization_id: string | null }>(
        "select app.current_identity_id() as identity_id, current_setting('app.execution_scope', true) as execution_scope, app.current_organization_id() as organization_id",
      )).rows[0]!;
      assert.equal(row.identity_id, identityId);
      assert.equal(row.execution_scope, "IDENTITY");
      assert.equal(row.organization_id, null);
      return row;
    });
    assert.equal(context.identity_id, identityId);

    await ownerPool.query("update identities set status='SUSPENDED' where id=$1", [identityId]);
    await assert.rejects(
      () => withIdentityTransaction(runtimePool, identityId, async () => "must-not-run"),
      /Identity is not active/i,
    );
  } finally {
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    await runtimePool.end();
    await ownerPool.end();
  }
});

test("Shakti tenant context rejects cross-organization context switching", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationA = "";
  let organizationB = "";
  let roleA = "";
  let membershipA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      [`TEST-TENANT-A-${suffix}`],
    )).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      [`TEST-TENANT-B-${suffix}`],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      [`tenant-negative:${suffix}`, `Tenant Negative ${suffix}`, `tenant-negative-${suffix}@example.invalid`],
    )).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"dashboard:read\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;

    const fixtureClient = await ownerPool.connect();
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

    const context = await withTenantTransaction(runtimePool, authA, async client => {
      await client.query("set local role rupaykg_app_runtime");
      const row = (await client.query<{ identity_id: string; organization_id: string }>(
        "select app.current_identity_id() as identity_id, app.current_organization_id() as organization_id",
      )).rows[0]!;
      assert.equal(row.identity_id, identityId);
      assert.equal(row.organization_id, organizationA);
      return row;
    });
    assert.equal(context.organization_id, organizationA);

    const crossTenantClient = await runtimePool.connect();
    try {
      await crossTenantClient.query("begin");
      await crossTenantClient.query("set local role rupaykg_app_runtime");
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

    const reset = await withTenantTransaction(runtimePool, authA, async client => {
      await client.query("set local role rupaykg_app_runtime");
      const row = (await client.query<{ organization_id: string }>(
        "select app.current_organization_id() as organization_id",
      )).rows[0]!;
      return row.organization_id;
    });
    assert.equal(reset, organizationA);
  } finally {
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});

test("Shakti tenant transaction rejects stale verified membership after authoritative revocation", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationId = "";
  let roleId = "";
  let membershipId = "";
  try {
    organizationId = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-STALE-MEMBERSHIP-" + suffix],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["stale-membership:" + suffix, "Stale Membership " + suffix, "stale-membership-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleId = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"dashboard:read\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationId],
    )).rows[0]!.id;
    membershipId = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationId, roleId],
    )).rows[0]!.id;

    const staleAuth: AuthContext = {
      identityId,
      memberships: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }],
      activeOrganizationId: organizationId,
    };

    await ownerPool.query("update organization_memberships set status='REVOKED' where id=$1", [membershipId]);

    await assert.rejects(
      () => withTenantTransaction(runtimePool, staleAuth, async () => "must-not-run"),
      /authoritative database/i,
    );
  } finally {
    if (membershipId) await ownerPool.query("delete from organization_memberships where id=$1", [membershipId]);
    if (roleId) await ownerPool.query("delete from roles where id=$1", [roleId]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationId) await ownerPool.query("delete from organizations where id=$1", [organizationId]);
    await runtimePool.end();
    await ownerPool.end();
  }
});

test("Shakti business-route contract rejects a cross-tenant organization context", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationA = "";
  let organizationB = "";
  let roleA = "";
  let membershipA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-BUSINESS-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-BUSINESS-B-" + suffix],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["business-negative:" + suffix, "Business Negative " + suffix, "business-negative-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"activity:write\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;

    const fixtureClient = await ownerPool.connect();
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
      () => withTenantTransaction(runtimePool, { ...authA, activeOrganizationId: organizationB }, async client => {
        await client.query("set local role rupaykg_app_runtime");
        return client.query("insert into activities(organization_id,status) values($1,'DRAFT')", [organizationB]);
      }),
      /not a verified member of the requested organization/i,
    );

    const context = await withTenantTransaction(runtimePool, authA, async client => {
      await client.query("set local role rupaykg_app_runtime");
      return client.query<{ organization_id: string }>("select app.current_organization_id() as organization_id");
    });
    assert.equal(context.rows[0]!.organization_id, organizationA);
  } finally {
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});

test("Shakti RLS runtime role isolates core tenant rows", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationA = "";
  let organizationB = "";
  let roleA = "";
  let membershipA = "";
  let activityA = "";
  let activityB = "";
  try {
    const runtimeRole = (await ownerPool.query<{ exists: boolean }>(
      "select exists(select 1 from pg_roles where rolname='rupaykg_app_runtime') as exists",
    )).rows[0]!.exists;
    if (!runtimeRole) throw new Error("RLS runtime role is not provisioned in the test database");

    organizationA = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-B-" + suffix],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["rls-negative:" + suffix, "RLS Negative " + suffix, "rls-negative-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"activity:write\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationA, roleA],
    )).rows[0]!.id;

    activityA = (await ownerPool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    activityB = (await ownerPool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationB],
    )).rows[0]!.id;

    const client = await runtimePool.connect();
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
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityBId, organizationB]);
      const payeeVisible = await client.query<{ id: string }>("select id from settlements where id in ($1,$2) order by id", [settlementA, settlementB]);
      assert.equal(payeeVisible.rows.length, 1);
      assert.equal(payeeVisible.rows[0]!.id, settlementA);
      await assert.rejects(() => client.query("update settlements set amount=12 where id=$1", [settlementA]), /row-level security|policy/i);
      const payeeEvents = await client.query<{ id: string }>("select id from settlement_events where settlement_id=$1", [settlementA]);
      assert.equal(payeeEvents.rows.length, 1);
      assert.equal(payeeEvents.rows[0]!.id, eventA);
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (activityA) await ownerPool.query("delete from activities where id=$1", [activityA]);
    if (activityB) await ownerPool.query("delete from activities where id=$1", [activityB]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti RLS child-row scope follows the parent activity tenant", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationA = "";
  let organizationB = "";
  let roleA = "";
  let membershipA = "";
  let activityA = "";
  let activityB = "";
  let measurementA = "";
  let measurementB = "";
  try {
    const runtimeRole = (await ownerPool.query<{ exists: boolean }>(
      "select exists(select 1 from pg_roles where rolname='rupaykg_app_runtime') as exists",
    )).rows[0]!.exists;
    if (!runtimeRole) throw new Error("RLS runtime role is not provisioned in the test database");

    organizationA = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-CHILD-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-CHILD-B-" + suffix],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["rls-child-negative:" + suffix, "RLS Child Negative " + suffix, "rls-child-negative-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"activity:write\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationA, roleA],
    )).rows[0]!.id;

    activityA = (await ownerPool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_CHILD_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    activityB = (await ownerPool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_CHILD_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationB],
    )).rows[0]!.id;

    measurementA = (await ownerPool.query<{ id: string }>(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,metadata) values($1,1,'kg','RLS_TEST','fixture',now(),'{}'::jsonb) returning id",
      [activityA],
    )).rows[0]!.id;
    measurementB = (await ownerPool.query<{ id: string }>(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,metadata) values($1,2,'kg','RLS_TEST','fixture',now(),'{}'::jsonb) returning id",
      [activityB],
    )).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);

      const visible = await client.query<{ id: string; activity_id: string }>(
        "select id, activity_id from measurements where id in ($1,$2) order by id",
        [measurementA, measurementB],
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.id, measurementA);
      assert.equal(visible.rows[0]!.activity_id, activityA);

      const sameTenantUpdate = await client.query<{ id: string; value: string }>(
        "update measurements set value=1.5 where id=$1 returning id,value",
        [measurementA],
      );
      assert.equal(sameTenantUpdate.rows[0]!.id, measurementA);
      assert.equal(sameTenantUpdate.rows[0]!.value, "1.5");

      await assert.rejects(
        () => client.query(
          "insert into measurements(activity_id,value,unit,method,source,measured_at,metadata) values($1,3,'kg','RLS_TEST','fixture',now(),'{}'::jsonb)",
          [activityB],
        ),
        /row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query(
          "update measurements set value=4 where id=$1",
          [measurementB],
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
    if (measurementA) await ownerPool.query("delete from measurements where id=$1", [measurementA]);
    if (measurementB) await ownerPool.query("delete from measurements where id=$1", [measurementB]);
    if (activityA) await ownerPool.query("delete from activities where id=$1", [activityA]);
    if (activityB) await ownerPool.query("delete from activities where id=$1", [activityB]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti RLS evidence rows are tenant-isolated for insert and read", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", organizationA = "", organizationB = "", roleA = "", membershipA = "", activityA = "", activityB = "", evidenceA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-EVIDENCE-A-" + suffix])).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-EVIDENCE-B-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-evidence:" + suffix, "RLS Evidence " + suffix, "rls-evidence-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(`insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','["activity:write"]'::jsonb,'[]'::jsonb) returning id`, [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    identityBId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-settlement-payee:" + suffix, "RLS Settlement Payee " + suffix, "rls-settlement-payee-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleB = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role_payee','[]'::jsonb,'[]'::jsonb) returning id", [organizationB])).rows[0]!.id;
    membershipB = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityBId, organizationB, roleB])).rows[0]!.id;
    activityA = (await ownerPool.query<{ id: string }>("insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_EVIDENCE','DRAFT','{}'::jsonb) returning id", [organizationA])).rows[0]!.id;
    activityB = (await ownerPool.query<{ id: string }>("insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_EVIDENCE','DRAFT','{}'::jsonb) returning id", [organizationB])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);
      evidenceA = (await client.query<{ id: string }>(
        "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,'RLS_TEST','CAPTURED',now(),'db://rls-test/$2',$3,'{}'::jsonb) returning id",
        [activityA, suffix, "hash-" + suffix],
      )).rows[0]!.id;
      const visible = await client.query<{ id: string; activity_id: string }>(
        "select id,activity_id from evidence where activity_id in ($1,$2)",
        [activityA, activityB],
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.id, evidenceA);
      const sameTenantUpdate = await client.query<{ id: string; status: string }>(
        "update evidence set status='VERIFIED' where id=$1 returning id,status",
        [evidenceA],
      );
      assert.equal(sameTenantUpdate.rows[0]!.id, evidenceA);
      assert.equal(sameTenantUpdate.rows[0]!.status, "VERIFIED");

      await assert.rejects(
        () => client.query(
          "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,'RLS_TEST','CAPTURED',now(),'db://rls-test/cross-tenant',$2,'{}'::jsonb)",
          [activityB, "cross-" + suffix],
        ),
        /row-level security|policy/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally { client.release(); }
  } finally {
    if (evidenceA) await ownerPool.query("delete from evidence where id=$1", [evidenceA]);
    if (activityA) await ownerPool.query("delete from activities where id=$1", [activityA]);
    if (activityB) await ownerPool.query("delete from activities where id=$1", [activityB]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end(); await ownerPool.end();
  }
});

test("Shakti RLS carbon calculations are tenant-isolated on parent activity scope", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", organizationA = "", organizationB = "", roleA = "", membershipA = "", activityA = "", activityB = "", calculationA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-CARBON-A-" + suffix])).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-CARBON-B-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-carbon:" + suffix, "RLS Carbon " + suffix, "rls-carbon-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(`insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','["activity:write"]'::jsonb,'[]'::jsonb) returning id`, [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    activityA = (await ownerPool.query<{ id: string }>("insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_CARBON','DRAFT','{}'::jsonb) returning id", [organizationA])).rows[0]!.id;
    activityB = (await ownerPool.query<{ id: string }>("insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_CARBON','DRAFT','{}'::jsonb) returning id", [organizationB])).rows[0]!.id;
    const methodology = (await ownerPool.query<{ id: string }>("select id from methodology_versions order by id limit 1")).rows[0];
    if (!methodology) throw new Error("RLS carbon runtime fixture requires at least one methodology_versions row");

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);
      calculationA = (await client.query<{ id: string }>(
        "insert into carbon_calculations(activity_id,methodology_version_id,inputs,result,unit,status,calculated_at,baseline_result,uncertainty,dataset_hash,formula_hash,calculation_trace,provenance_version,calculation_hash) values($1,$2,'{}'::jsonb,'1','tCO2e','CALCULATED',now(),0,0,'dataset-$3','formula-$3','[]'::jsonb,'1','calculation-$3') returning id",
        [activityA, methodology.id, suffix],
      )).rows[0]!.id;
      const visible = await client.query<{ id: string; activity_id: string }>("select id,activity_id from carbon_calculations where activity_id in ($1,$2)", [activityA, activityB]);
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.id, calculationA);
      const sameTenantUpdate = await client.query<{ id: string; result: string }>(
        "update carbon_calculations set result='2' where id=$1 returning id,result",
        [calculationA],
      );
      assert.equal(sameTenantUpdate.rows[0]!.id, calculationA);
      assert.equal(sameTenantUpdate.rows[0]!.result, "2");

      await assert.rejects(
        () => client.query(
          "insert into carbon_calculations(activity_id,methodology_version_id,inputs,result,unit,status,calculated_at,baseline_result,uncertainty,dataset_hash,formula_hash,calculation_trace,provenance_version,calculation_hash) values($1,$2,'{}'::jsonb,'1','tCO2e','CALCULATED',now(),0,0,'dataset-cross-$3','formula-cross-$3','[]'::jsonb,'1','calculation-cross-$3')",
          [activityB, methodology.id, suffix],
        ),
        /row-level security|policy/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally { client.release(); }
  } finally {
    if (calculationA) await ownerPool.query("delete from carbon_calculations where id=$1", [calculationA]);
    if (activityA) await ownerPool.query("delete from activities where id=$1", [activityA]);
    if (activityB) await ownerPool.query("delete from activities where id=$1", [activityB]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end(); await ownerPool.end();
  }
});


test("Shakti RLS EPR obligations are tenant-isolated for insert, read and update", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", organizationA = "", organizationB = "", roleA = "", membershipA = "", obligationA = "", obligationB = "", schemeId = "", eprObligationA = "", eprObligationB = "";
  try {
    const runtimeRole = (await ownerPool.query<{ exists: boolean }>(
      "select exists(select 1 from pg_roles where rolname='rupaykg_app_runtime') as exists",
    )).rows[0]!.exists;
    if (!runtimeRole) throw new Error("RLS runtime role is not provisioned in the test database");

    organizationA = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-EPR-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-EPR-B-" + suffix],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["rls-epr:" + suffix, "RLS EPR " + suffix, "rls-epr-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"activity:write\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationA, roleA],
    )).rows[0]!.id;

    schemeId = (await ownerPool.query<{ id: string }>(
      "insert into epr_schemes(code,name,authority,status,metadata) values($1,'RLS EPR Test Scheme','TEST_AUTHORITY','VERIFIED','{}'::jsonb) returning id",
      ["RLS-EPR-" + suffix],
    )).rows[0]!.id;
    obligationA = (await ownerPool.query<{ id: string }>(
      "insert into obligations(organization_id,obligation_type,period_start,period_end,required_quantity,status) values($1,'RLS_EPR','2026-01-01','2026-12-31',10,'OPEN') returning id",
      [organizationA],
    )).rows[0]!.id;
    obligationB = (await ownerPool.query<{ id: string }>(
      "insert into obligations(organization_id,obligation_type,period_start,period_end,required_quantity,status) values($1,'RLS_EPR','2026-01-01','2026-12-31',20,'OPEN') returning id",
      [organizationB],
    )).rows[0]!.id;
    eprObligationA = (await ownerPool.query<{ id: string }>(
      "insert into epr_obligations(obligation_id,scheme_id,obligated_organization_id,category_code,target_quantity,fulfilled_quantity,status) values($1,$2,$3,'RLS',10,0,'OPEN') returning id",
      [obligationA, schemeId, organizationA],
    )).rows[0]!.id;
    eprObligationB = (await ownerPool.query<{ id: string }>(
      "insert into epr_obligations(obligation_id,scheme_id,obligated_organization_id,category_code,target_quantity,fulfilled_quantity,status) values($1,$2,$3,'RLS',20,0,'OPEN') returning id",
      [obligationB, schemeId, organizationB],
    )).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);

      const visible = await client.query<{ id: string; obligated_organization_id: string }>(
        "select id, obligated_organization_id from epr_obligations where id in ($1,$2) order by id",
        [eprObligationA, eprObligationB],
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.id, eprObligationA);
      assert.equal(visible.rows[0]!.obligated_organization_id, organizationA);

      const updated = await client.query<{ id: string; fulfilled_quantity: string }>(
        "update epr_obligations set fulfilled_quantity=3 where id=$1 returning id, fulfilled_quantity",
        [eprObligationA],
      );
      assert.equal(updated.rows[0]!.id, eprObligationA);
      assert.equal(updated.rows[0]!.fulfilled_quantity, "3");

      const sameTenantInserted = await client.query<{ id: string; obligated_organization_id: string }>(
        "insert into epr_obligations(obligation_id,scheme_id,obligated_organization_id,category_code,target_quantity,fulfilled_quantity,status) values($1,$2,$3,'RLS_SAME',5,0,'OPEN') returning id, obligated_organization_id",
        [obligationA, schemeId, organizationA],
      );
      assert.equal(sameTenantInserted.rows[0]!.obligated_organization_id, organizationA);

      await assert.rejects(
        () => client.query(
          "insert into epr_obligations(obligation_id,scheme_id,obligated_organization_id,category_code,target_quantity,fulfilled_quantity,status) values($1,$2,$3,'RLS_CROSS',20,0,'OPEN')",
          [obligationB, schemeId, organizationB],
        ),
        /row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query(
          "update epr_obligations set fulfilled_quantity=4 where id=$1",
          [eprObligationB],
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
    if (eprObligationA) await ownerPool.query("delete from epr_obligations where id=$1", [eprObligationA]);
    if (eprObligationB) await ownerPool.query("delete from epr_obligations where id=$1", [eprObligationB]);
    if (obligationA) await ownerPool.query("delete from obligations where id=$1", [obligationA]);
    if (obligationB) await ownerPool.query("delete from obligations where id=$1", [obligationB]);
    if (schemeId) await ownerPool.query("delete from epr_schemes where id=$1", [schemeId]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti RLS settlement rows are bilateral-readable but payer-mutation-only", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", identityBId = "", organizationA = "", organizationB = "", organizationC = "", roleA = "", roleB = "", membershipA = "", membershipB = "", settlementA = "", settlementB = "", eventA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-SETTLEMENT-A-" + suffix])).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-SETTLEMENT-B-" + suffix])).rows[0]!.id;
    organizationC = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-SETTLEMENT-C-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-settlement:" + suffix, "RLS Settlement " + suffix, "rls-settlement-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"settlement:authorize\"]'::jsonb,'[]'::jsonb) returning id", [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    settlementA = (await ownerPool.query<{ id: string }>("insert into settlements(payer_id,payee_id,amount,currency,status) values($1,$2,10,'INR','CREATED') returning id", [organizationA, organizationB])).rows[0]!.id;
    settlementB = (await ownerPool.query<{ id: string }>("insert into settlements(payer_id,payee_id,amount,currency,status) values($1,$2,20,'INR','CREATED') returning id", [organizationB, organizationC])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);

      const visible = await client.query<{ id: string; payer_id: string; payee_id: string }>(
        "select id,payer_id,payee_id from settlements where id in ($1,$2) order by id",
        [settlementA, settlementB],
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.id, settlementA);

      const payerUpdate = await client.query<{ id: string; amount: string }>(
        "update settlements set amount=11 where id=$1 returning id,amount",
        [settlementA],
      );
      assert.equal(payerUpdate.rows[0]!.id, settlementA);
      assert.equal(payerUpdate.rows[0]!.amount, "11");

      await assert.rejects(
        () => client.query("update settlements set amount=21 where id=$1", [settlementB]),
        /row-level security|policy/i,
      );

      eventA = (await client.query<{ id: string }>(
        "insert into settlement_events(settlement_id,event_type,event_hash) values($1,'RLS_TEST',$2) returning id",
        [settlementA, suffix],
      )).rows[0]!.id;
      const events = await client.query<{ id: string }>(
        "select id from settlement_events where settlement_id in ($1,$2)",
        [settlementA, settlementB],
      );
      assert.equal(events.rows.length, 1);
      assert.equal(events.rows[0]!.id, eventA);

      await assert.rejects(
        () => client.query("insert into settlement_events(settlement_id,event_type,event_hash) values($1,'RLS_CROSS',$2)", [settlementB, suffix]),
        /row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query("update settlement_events set event_type='MUTATED' where id=$1", [eventA]),
        /permission denied|row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query("delete from settlement_events where id=$1", [eventA]),
        /permission denied|row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query("delete from settlements where id=$1", [settlementA]),
        /permission denied|row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query("update settlements set status='SETTLED' where id=$1", [settlementA]),
        /invalid settlement lifecycle transition|check constraint|policy/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (eventA) await ownerPool.query("delete from settlement_events where id=$1", [eventA]);
    if (settlementA) await ownerPool.query("delete from settlements where id=$1", [settlementA]);
    if (settlementB) await ownerPool.query("delete from settlements where id=$1", [settlementB]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    if (organizationC) await ownerPool.query("delete from organizations where id=$1", [organizationC]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti RLS credential rows are current-owner-readable and owner-mutation-only", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", identityBId = "", organizationA = "", organizationB = "", roleA = "", membershipA = "", credentialA = "", registryEventA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-CREDENTIAL-A-" + suffix])).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-CREDENTIAL-B-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-credential:" + suffix, "RLS Credential " + suffix, "rls-credential-" + suffix + "@example.invalid"])).rows[0]!.id;
    identityBId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-credential-other:" + suffix, "RLS Credential Other " + suffix, "rls-credential-other-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[]'::jsonb,'[]'::jsonb) returning id", [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    credentialA = (await ownerPool.query<{ id: string }>("insert into credentials(issuer_organization_id,trust_root_id,status) values($1,$2,'ELIGIBLE') returning id", [organizationA, "RLS-TRUST-" + suffix])).rows[0]!.id;
    registryEventA = (await ownerPool.query<{ id: string }>("insert into registry_events(credential_id,event_type,to_owner_id,recorded_by_identity_id,event_hash) values($1,'ISSUED',$2,$3,$4) returning id", [credentialA, organizationA, identityId, "RLS-EVENT-" + suffix])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);

      const visible = await client.query<{ id: string; issuer_organization_id: string }>("select id,issuer_organization_id from credentials where id=$1", [credentialA]);
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.issuer_organization_id, organizationA);

      await assert.rejects(
        () => client.query("update credentials set trust_root_id=$1 where id=$2", ["RLS-IMMUTABLE-" + suffix, credentialA]),
        /credential authority fields are immutable/i,
      );

      const updated = await client.query<{ id: string; status: string }>("update credentials set status='ACTIVE' where id=$1 returning id,status", [credentialA]);
      assert.equal(updated.rows[0]!.id, credentialA);
      assert.equal(updated.rows[0]!.status, "ACTIVE");

      await assert.rejects(
        () => client.query("insert into registry_events(credential_id,event_type,to_owner_id,recorded_by_identity_id,event_hash) values($1,'IDENTITY_MISMATCH',$2,$3,$4)", [credentialA, organizationA, identityBId, "RLS-MISMATCH-" + suffix]),
        /row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query("insert into registry_events(credential_id,event_type,to_owner_id,recorded_by_identity_id,event_hash) values($1,'CROSS_TENANT',$2,$3,$4)", [credentialA, organizationB, identityId, "RLS-CROSS-" + suffix]),
        /row-level security|policy/i,
      );

      await assert.rejects(
        () => client.query("delete from credentials where id=$1", [credentialA]),
        /permission denied|row-level security|policy/i,
      );

      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }

    const crossClient = await runtimePool.connect();
    try {
      await crossClient.query("begin");
      await crossClient.query("set local role rupaykg_app_runtime");
      await assert.rejects(
        () => crossClient.query("select id from credentials where id=$1", [credentialA]),
        /row-level security|policy/i,
      );
      await crossClient.query("rollback");
    } catch (error) {
      try { await crossClient.query("rollback"); } catch {}
      throw error;
    } finally {
      crossClient.release();
    }
  } finally {
    if (registryEventA) await ownerPool.query("delete from registry_events where id=$1", [registryEventA]);
    if (credentialA) await ownerPool.query("delete from credentials where id=$1", [credentialA]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti RLS field-sync evidence is identity/device/tenant isolated", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", identityBId = "", organizationA = "", organizationB = "", roleA = "", membershipA = "", deviceA = "", envelopeA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-SYNC-A-" + suffix])).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-SYNC-B-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-sync:" + suffix, "RLS Sync " + suffix, "rls-sync-" + suffix + "@example.invalid"])).rows[0]!.id;
    identityBId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-sync-other:" + suffix, "RLS Sync Other " + suffix, "rls-sync-other-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[]'::jsonb,'[]'::jsonb) returning id", [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    deviceA = (await ownerPool.query<{ id: string }>("insert into field_devices(device_id,identity_id,organization_id,status,registered_by_identity_id,registered_at) values($1,$2,$3,'VERIFIED',$2,now()) returning id", ["RLS-SYNC-DEVICE-" + suffix, identityId, organizationA])).rows[0]!.id;
    envelopeA = (await ownerPool.query<{ id: string }>("insert into field_sync_envelopes(device_id,identity_id,idempotency_key,client_sequence,captured_at,payload,payload_hash) values($1,$2,$3,1,now(),'{}'::jsonb,'RLS-SYNC-HASH') returning id", [deviceA, identityId, "RLS-SYNC-" + suffix])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);

      const visible = await client.query<{ id: string }>("select id from field_sync_envelopes where id=$1", [envelopeA]);
      assert.equal(visible.rows.length, 1);

      await assert.rejects(
        () => client.query("insert into field_sync_envelopes(device_id,identity_id,idempotency_key,client_sequence,captured_at,payload,payload_hash) values($1,$2,$3,2,now(),'{}'::jsonb,'RLS-CROSS')", [deviceA, identityBId, "RLS-SYNC-MISMATCH-" + suffix]),
        /row-level security|policy|identity must match/i,
      );
      await assert.rejects(
        () => client.query("delete from field_sync_envelopes where id=$1", [envelopeA]),
        /permission denied|row-level security|policy/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }

    const otherClient = await runtimePool.connect();
    try {
      await otherClient.query("begin");
      await otherClient.query("set local role rupaykg_app_runtime");
      await otherClient.query("select app.set_request_context($1,$2)", [identityBId, organizationB]);
      const hidden = await otherClient.query<{ id: string }>("select id from field_sync_envelopes where id=$1", [envelopeA]);
      assert.equal(hidden.rows.length, 0);
      await otherClient.query("rollback");
    } catch (error) {
      try { await otherClient.query("rollback"); } catch {}
      throw error;
    } finally {
      otherClient.release();
    }
  } finally {
    if (envelopeA) await ownerPool.query("delete from field_sync_envelopes where id=$1", [envelopeA]);
    if (deviceA) await ownerPool.query("delete from field_devices where id=$1", [deviceA]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});



test("Shakti credential runtime privilege is status-only", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let organizationA = "", identityId = "", roleA = "", membershipA = "", credentialA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-CRED-PRIV-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["cred-priv:" + suffix, "Credential Privilege " + suffix, "cred-priv-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'operator','[]'::jsonb,'[]'::jsonb) returning id", [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    credentialA = (await ownerPool.query<{ id: string }>("insert into credentials(issuer_organization_id,trust_root_id,status) values($1,$2,'ELIGIBLE') returning id", [organizationA, "PRIV-TRUST-" + suffix])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);
      await client.query("update credentials set status='ACTIVE' where id=$1", [credentialA]);
      await client.query("rollback");
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);
      await assert.rejects(
        () => client.query("update credentials set trust_root_id=$2 where id=$1", [credentialA, "PRIV-CHANGED-" + suffix]),
        /permission denied|not permitted/i,
      );
      await assert.rejects(
        () => client.query("update credentials set status='ACTIVE', trust_root_id=$2 where id=$1", [credentialA, "PRIV-COMBINED-" + suffix]),
        /permission denied|not permitted/i,
      );
      await assert.rejects(
        () => client.query("delete from credentials where id=$1", [credentialA]),
        /permission denied|not permitted/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (credentialA) await ownerPool.query("delete from credentials where id=$1", [credentialA]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    await runtimePool.end();
    await ownerPool.end();
  }
});

test("Shakti assigned verifier registry read is scoped to approved active verifier", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let orgA = "", orgB = "", verifierId = "", otherVerifierId = "", issuerId = "", roleA = "", roleOther = "", roleIssuer = "", membershipA = "", membershipOther = "", membershipIssuer = "";
  let credentialA = "", verificationA = "", eventA = "";
  try {
    orgA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-VERIFIER-A-" + suffix])).rows[0]!.id;
    orgB = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-VERIFIER-B-" + suffix])).rows[0]!.id;
    verifierId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["verifier:" + suffix, "Verifier " + suffix, "verifier-" + suffix + "@example.invalid"])).rows[0]!.id;
    otherVerifierId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["other-verifier:" + suffix, "Other Verifier " + suffix, "other-verifier-" + suffix + "@example.invalid"])).rows[0]!.id;
    issuerId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["issuer:" + suffix, "Issuer " + suffix, "issuer-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'verifier','["verification:approve"]'::jsonb,'[]'::jsonb) returning id", [orgA])).rows[0]!.id;
    roleOther = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'verifier','["verification:approve"]'::jsonb,'[]'::jsonb) returning id", [orgB])).rows[0]!.id;
    roleIssuer = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'operator','[]'::jsonb,'[]'::jsonb) returning id", [orgA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [verifierId, orgA, roleA])).rows[0]!.id;
    membershipOther = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [otherVerifierId, orgB, roleOther])).rows[0]!.id;
    membershipIssuer = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [issuerId, orgA, roleIssuer])).rows[0]!.id;

    credentialA = (await ownerPool.query<{ id: string }>("insert into credentials(issuer_organization_id,trust_root_id,status) values($1,$2,'ELIGIBLE') returning id", [orgA, "VERIFIER-TRUST-" + suffix])).rows[0]!.id;
    verificationA = (await ownerPool.query<{ id: string }>("insert into verifications(credential_id,verifier_identity_id,decision) values($1,$2,'APPROVED') returning id", [credentialA, verifierId])).rows[0]!.id;
    eventA = (await ownerPool.query<{ id: string }>("insert into registry_events(credential_id,event_type,to_owner_id,recorded_by_identity_id,event_hash) values($1,'ISSUED',$2,$3,$4) returning id", [credentialA, orgA, issuerId, "VERIFIER-EVENT-" + suffix])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [verifierId, orgA]);
      const visible = await client.query<{ id: string }>("select id from registry_events where id=$1", [eventA]);
      assert.equal(visible.rows.length, 1);
      await ownerPool.query("update verifications set decision='REJECTED' where id=$1", [verificationA]);
      const hiddenAfterDecisionRevocation = await client.query<{ id: string }>("select id from registry_events where id=$1", [eventA]);
      assert.equal(hiddenAfterDecisionRevocation.rows.length, 0);
      await ownerPool.query("update verifications set decision='APPROVED' where id=$1", [verificationA]);
      await assert.rejects(() => client.query("insert into registry_events(credential_id,event_type,to_owner_id,recorded_by_identity_id,event_hash) values($1,'VERIFIER_WRITE',$2,$3,$4)", [credentialA, orgA, verifierId, "VERIFIER-WRITE-" + suffix]), /permission denied|row-level security|policy/i);
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }

    await ownerPool.query("update identities set status='SUSPENDED' where id=$1", [verifierId]);
    const suspendedClient = await runtimePool.connect();
    try {
      await suspendedClient.query("begin");
      await suspendedClient.query("set local role rupaykg_app_runtime");
      await assert.rejects(() => suspendedClient.query("select app.set_identity_context($1)", [verifierId]), /Identity is not active/i);
      await suspendedClient.query("rollback");
    } catch (error) {
      try { await suspendedClient.query("rollback"); } catch {}
      throw error;
    } finally {
      suspendedClient.release();
    }

    await ownerPool.query("update identities set status='VERIFIED' where id=$1", [verifierId]);
    await ownerPool.query("update organization_memberships set status='REVOKED' where id=$1", [membershipA]);
    const revokedMembershipClient = await runtimePool.connect();
    try {
      await revokedMembershipClient.query("begin");
      await revokedMembershipClient.query("set local role rupaykg_app_runtime");
      await assert.rejects(
        () => revokedMembershipClient.query("select app.set_request_context($1,$2)", [verifierId, orgA]),
        /not a verified member of the requested organization/i,
      );
      await revokedMembershipClient.query("rollback");
    } catch (error) {
      try { await revokedMembershipClient.query("rollback"); } catch {}
      throw error;
    } finally {
      revokedMembershipClient.release();
    }
    await ownerPool.query("update organization_memberships set status='VERIFIED' where id=$1", [membershipA]);
    const suspendedReadClient = await runtimePool.connect();
    try {
      await suspendedReadClient.query("begin");
      await suspendedReadClient.query("set local role rupaykg_app_runtime");
      await suspendedReadClient.query("select app.set_request_context($1,$2)", [verifierId, orgA]);
      await ownerPool.query("update organizations set status='SUSPENDED' where id=$1", [orgA]);
      const hiddenAfterOrgSuspension = await suspendedReadClient.query<{ id: string }>("select id from registry_events where id=$1", [eventA]);
      assert.equal(hiddenAfterOrgSuspension.rows.length, 0);
      await suspendedReadClient.query("rollback");
    } catch (error) {
      try { await suspendedReadClient.query("rollback"); } catch {}
      throw error;
    } finally {
      suspendedReadClient.release();
      await ownerPool.query("update organizations set status='VERIFIED' where id=$1", [orgA]);
    }
    const suspendedOrgClient = await runtimePool.connect();
    try {
      await suspendedOrgClient.query("begin");
      await suspendedOrgClient.query("set local role rupaykg_app_runtime");
      await assert.rejects(
        () => suspendedOrgClient.query("select app.set_request_context($1,$2)", [verifierId, orgA]),
        /organization|not.*verified|active/i,
      );
      await suspendedOrgClient.query("rollback");
    } catch (error) {
      try { await suspendedOrgClient.query("rollback"); } catch {}
      throw error;
    } finally {
      suspendedOrgClient.release();
    }
    await ownerPool.query("update organizations set status='VERIFIED' where id=$1", [orgA]);
    const otherClient = await runtimePool.connect();
    try {
      await otherClient.query("begin");
      await otherClient.query("set local role rupaykg_app_runtime");
      await otherClient.query("select app.set_request_context($1,$2)", [otherVerifierId, orgB]);
      const hidden = await otherClient.query<{ id: string }>("select id from registry_events where id=$1", [eventA]);
      assert.equal(hidden.rows.length, 0);
      await otherClient.query("rollback");
    } catch (error) {
      try { await otherClient.query("rollback"); } catch {}
      throw error;
    } finally {
      otherClient.release();
    }
  } finally {
    if (eventA) await ownerPool.query("delete from registry_events where id=$1", [eventA]);
    if (verificationA) await ownerPool.query("delete from verifications where id=$1", [verificationA]);
    if (credentialA) await ownerPool.query("delete from credentials where id=$1", [credentialA]);
    if (membershipIssuer) await ownerPool.query("delete from organization_memberships where id=$1", [membershipIssuer]);
    if (membershipOther) await ownerPool.query("delete from organization_memberships where id=$1", [membershipOther]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleIssuer) await ownerPool.query("delete from roles where id=$1", [roleIssuer]);
    if (roleOther) await ownerPool.query("delete from roles where id=$1", [roleOther]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (issuerId) await ownerPool.query("delete from identities where id=$1", [issuerId]);
    if (otherVerifierId) await ownerPool.query("delete from identities where id=$1", [otherVerifierId]);
    if (verifierId) await ownerPool.query("delete from identities where id=$1", [verifierId]);
    if (orgB) await ownerPool.query("delete from organizations where id=$1", [orgB]);
    if (orgA) await ownerPool.query("delete from organizations where id=$1", [orgA]);
    await runtimePool.end();
    await ownerPool.end();
  }
});

test("Shakti credential lifecycle cannot commit without matching registry provenance", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", organizationA = "", roleA = "", membershipA = "", credentialA = "", credentialB = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-CRED-ATOMICITY-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["cred-atomicity:" + suffix, "Credential Atomicity " + suffix, "cred-atomicity-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[]'::jsonb,'[]'::jsonb) returning id", [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    credentialA = (await ownerPool.query<{ id: string }>("insert into credentials(issuer_organization_id,trust_root_id,status) values($1,$2,'ELIGIBLE') returning id", [organizationA, "ATOMICITY-TRUST-A-" + suffix])).rows[0]!.id;
    credentialB = (await ownerPool.query<{ id: string }>("insert into credentials(issuer_organization_id,trust_root_id,status) values($1,$2,'ELIGIBLE') returning id", [organizationA, "ATOMICITY-TRUST-B-" + suffix])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);
      await client.query("update credentials set status='ACTIVE' where id=$1", [credentialA]);
      await assert.rejects(() => client.query("commit"), /credential lifecycle state requires matching registry event: ACTIVATED/i);
      try { await client.query("rollback"); } catch {}
    } finally {
      client.release();
    }

    await ownerPool.query("insert into registry_events(credential_id,event_type,to_owner_id,recorded_by_identity_id,event_hash) values($1,'ISSUED',$2,$3,$4)", [credentialB, organizationA, identityId, "ATOMICITY-ISSUED-" + suffix]);
    const ownerClient = await ownerPool.connect();
    try {
      await ownerClient.query("begin");
      await ownerClient.query("update credentials set status='ACTIVE' where id=$1", [credentialB]);
      await ownerClient.query("insert into registry_events(credential_id,event_type,to_owner_id,recorded_by_identity_id,event_hash) values($1,'ACTIVATED',$2,$3,$4)", [credentialB, organizationA, identityId, "ATOMICITY-ACTIVATED-" + suffix]);
      await ownerClient.query("commit");
    } finally {
      ownerClient.release();
    }
    const final = await ownerPool.query<{ status: string }>("select status from credentials where id=$1", [credentialB]);
    assert.equal(final.rows[0]?.status, "ACTIVE");
  } finally {
    if (credentialA) await ownerPool.query("delete from credentials where id=$1", [credentialA]);
    if (credentialB) {
      await ownerPool.query("delete from registry_events where credential_id=$1", [credentialB]);
      await ownerPool.query("delete from credentials where id=$1", [credentialB]);
    }
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    await runtimePool.end();
    await ownerPool.end();
  }
});ort test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { withIdentityTransaction, withTenantTransaction } from "./tenant-db.js";
import type { AuthContext } from "./auth.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL) && Boolean(process.env.RUPAYKG_TEST_OWNER_DATABASE_URL);

test("Shakti identity context rejects inactive identity and does not establish tenant scope", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  try {
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["identity-context:" + suffix, "Identity Context " + suffix, "identity-context-" + suffix + "@example.invalid"],
    )).rows[0]!.id;

    const context = await withIdentityTransaction(runtimePool, identityId, async client => {
      await client.query("set local role rupaykg_app_runtime");
      const row = (await client.query<{ identity_id: string; execution_scope: string; organization_id: string | null }>(
        "select app.current_identity_id() as identity_id, current_setting('app.execution_scope', true) as execution_scope, app.current_organization_id() as organization_id",
      )).rows[0]!;
      assert.equal(row.identity_id, identityId);
      assert.equal(row.execution_scope, "IDENTITY");
      assert.equal(row.organization_id, null);
      return row;
    });
    assert.equal(context.identity_id, identityId);

    await ownerPool.query("update identities set status='SUSPENDED' where id=$1", [identityId]);
    await assert.rejects(
      () => withIdentityTransaction(runtimePool, identityId, async () => "must-not-run"),
      /Identity is not active/i,
    );
  } finally {
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    await runtimePool.end();
    await ownerPool.end();
  }
});

test("Shakti tenant context rejects cross-organization context switching", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationA = "";
  let organizationB = "";
  let roleA = "";
  let membershipA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      [`TEST-TENANT-A-${suffix}`],
    )).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      [`TEST-TENANT-B-${suffix}`],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      [`tenant-negative:${suffix}`, `Tenant Negative ${suffix}`, `tenant-negative-${suffix}@example.invalid`],
    )).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"dashboard:read\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;

    const fixtureClient = await ownerPool.connect();
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

    const context = await withTenantTransaction(runtimePool, authA, async client => {
      await client.query("set local role rupaykg_app_runtime");
      const row = (await client.query<{ identity_id: string; organization_id: string }>(
        "select app.current_identity_id() as identity_id, app.current_organization_id() as organization_id",
      )).rows[0]!;
      assert.equal(row.identity_id, identityId);
      assert.equal(row.organization_id, organizationA);
      return row;
    });
    assert.equal(context.organization_id, organizationA);

    const crossTenantClient = await runtimePool.connect();
    try {
      await crossTenantClient.query("begin");
      await crossTenantClient.query("set local role rupaykg_app_runtime");
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

    const reset = await withTenantTransaction(runtimePool, authA, async client => {
      await client.query("set local role rupaykg_app_runtime");
      const row = (await client.query<{ organization_id: string }>(
        "select app.current_organization_id() as organization_id",
      )).rows[0]!;
      return row.organization_id;
    });
    assert.equal(reset, organizationA);
  } finally {
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});

test("Shakti tenant transaction rejects stale verified membership after authoritative revocation", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationId = "";
  let roleId = "";
  let membershipId = "";
  try {
    organizationId = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-STALE-MEMBERSHIP-" + suffix],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["stale-membership:" + suffix, "Stale Membership " + suffix, "stale-membership-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleId = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"dashboard:read\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationId],
    )).rows[0]!.id;
    membershipId = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationId, roleId],
    )).rows[0]!.id;

    const staleAuth: AuthContext = {
      identityId,
      memberships: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }],
      activeOrganizationId: organizationId,
    };

    await ownerPool.query("update organization_memberships set status='REVOKED' where id=$1", [membershipId]);

    await assert.rejects(
      () => withTenantTransaction(runtimePool, staleAuth, async () => "must-not-run"),
      /authoritative database/i,
    );
  } finally {
    if (membershipId) await ownerPool.query("delete from organization_memberships where id=$1", [membershipId]);
    if (roleId) await ownerPool.query("delete from roles where id=$1", [roleId]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationId) await ownerPool.query("delete from organizations where id=$1", [organizationId]);
    await runtimePool.end();
    await ownerPool.end();
  }
});

test("Shakti business-route contract rejects a cross-tenant organization context", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationA = "";
  let organizationB = "";
  let roleA = "";
  let membershipA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-BUSINESS-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-BUSINESS-B-" + suffix],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["business-negative:" + suffix, "Business Negative " + suffix, "business-negative-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"activity:write\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;

    const fixtureClient = await ownerPool.connect();
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
      () => withTenantTransaction(runtimePool, { ...authA, activeOrganizationId: organizationB }, async client => {
        await client.query("set local role rupaykg_app_runtime");
        return client.query("insert into activities(organization_id,status) values($1,'DRAFT')", [organizationB]);
      }),
      /not a verified member of the requested organization/i,
    );

    const context = await withTenantTransaction(runtimePool, authA, async client => {
      await client.query("set local role rupaykg_app_runtime");
      return client.query<{ organization_id: string }>("select app.current_organization_id() as organization_id");
    });
    assert.equal(context.rows[0]!.organization_id, organizationA);
  } finally {
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});

test("Shakti RLS runtime role isolates core tenant rows", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationA = "";
  let organizationB = "";
  let roleA = "";
  let membershipA = "";
  let activityA = "";
  let activityB = "";
  try {
    const runtimeRole = (await ownerPool.query<{ exists: boolean }>(
      "select exists(select 1 from pg_roles where rolname='rupaykg_app_runtime') as exists",
    )).rows[0]!.exists;
    if (!runtimeRole) throw new Error("RLS runtime role is not provisioned in the test database");

    organizationA = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-B-" + suffix],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["rls-negative:" + suffix, "RLS Negative " + suffix, "rls-negative-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"activity:write\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationA, roleA],
    )).rows[0]!.id;

    activityA = (await ownerPool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    activityB = (await ownerPool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationB],
    )).rows[0]!.id;

    const client = await runtimePool.connect();
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
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityBId, organizationB]);
      const payeeVisible = await client.query<{ id: string }>("select id from settlements where id in ($1,$2) order by id", [settlementA, settlementB]);
      assert.equal(payeeVisible.rows.length, 1);
      assert.equal(payeeVisible.rows[0]!.id, settlementA);
      await assert.rejects(() => client.query("update settlements set amount=12 where id=$1", [settlementA]), /row-level security|policy/i);
      const payeeEvents = await client.query<{ id: string }>("select id from settlement_events where settlement_id=$1", [settlementA]);
      assert.equal(payeeEvents.rows.length, 1);
      assert.equal(payeeEvents.rows[0]!.id, eventA);
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (activityA) await ownerPool.query("delete from activities where id=$1", [activityA]);
    if (activityB) await ownerPool.query("delete from activities where id=$1", [activityB]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti RLS child-row scope follows the parent activity tenant", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationA = "";
  let organizationB = "";
  let roleA = "";
  let membershipA = "";
  let activityA = "";
  let activityB = "";
  let measurementA = "";
  let measurementB = "";
  try {
    const runtimeRole = (await ownerPool.query<{ exists: boolean }>(
      "select exists(select 1 from pg_roles where rolname='rupaykg_app_runtime') as exists",
    )).rows[0]!.exists;
    if (!runtimeRole) throw new Error("RLS runtime role is not provisioned in the test database");

    organizationA = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-CHILD-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-CHILD-B-" + suffix],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["rls-child-negative:" + suffix, "RLS Child Negative " + suffix, "rls-child-negative-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"activity:write\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationA, roleA],
    )).rows[0]!.id;

    activityA = (await ownerPool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_CHILD_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    activityB = (await ownerPool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_CHILD_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationB],
    )).rows[0]!.id;

    measurementA = (await ownerPool.query<{ id: string }>(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,metadata) values($1,1,'kg','RLS_TEST','fixture',now(),'{}'::jsonb) returning id",
      [activityA],
    )).rows[0]!.id;
    measurementB = (await ownerPool.query<{ id: string }>(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,metadata) values($1,2,'kg','RLS_TEST','fixture',now(),'{}'::jsonb) returning id",
      [activityB],
    )).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);

      const visible = await client.query<{ id: string; activity_id: string }>(
        "select id, activity_id from measurements where id in ($1,$2) order by id",
        [measurementA, measurementB],
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.id, measurementA);
      assert.equal(visible.rows[0]!.activity_id, activityA);

      const sameTenantUpdate = await client.query<{ id: string; value: string }>(
        "update measurements set value=1.5 where id=$1 returning id,value",
        [measurementA],
      );
      assert.equal(sameTenantUpdate.rows[0]!.id, measurementA);
      assert.equal(sameTenantUpdate.rows[0]!.value, "1.5");

      await assert.rejects(
        () => client.query(
          "insert into measurements(activity_id,value,unit,method,source,measured_at,metadata) values($1,3,'kg','RLS_TEST','fixture',now(),'{}'::jsonb)",
          [activityB],
        ),
        /row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query(
          "update measurements set value=4 where id=$1",
          [measurementB],
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
    if (measurementA) await ownerPool.query("delete from measurements where id=$1", [measurementA]);
    if (measurementB) await ownerPool.query("delete from measurements where id=$1", [measurementB]);
    if (activityA) await ownerPool.query("delete from activities where id=$1", [activityA]);
    if (activityB) await ownerPool.query("delete from activities where id=$1", [activityB]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti RLS evidence rows are tenant-isolated for insert and read", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", organizationA = "", organizationB = "", roleA = "", membershipA = "", activityA = "", activityB = "", evidenceA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-EVIDENCE-A-" + suffix])).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-EVIDENCE-B-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-evidence:" + suffix, "RLS Evidence " + suffix, "rls-evidence-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(`insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','["activity:write"]'::jsonb,'[]'::jsonb) returning id`, [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    identityBId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-settlement-payee:" + suffix, "RLS Settlement Payee " + suffix, "rls-settlement-payee-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleB = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role_payee','[]'::jsonb,'[]'::jsonb) returning id", [organizationB])).rows[0]!.id;
    membershipB = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityBId, organizationB, roleB])).rows[0]!.id;
    activityA = (await ownerPool.query<{ id: string }>("insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_EVIDENCE','DRAFT','{}'::jsonb) returning id", [organizationA])).rows[0]!.id;
    activityB = (await ownerPool.query<{ id: string }>("insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_EVIDENCE','DRAFT','{}'::jsonb) returning id", [organizationB])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);
      evidenceA = (await client.query<{ id: string }>(
        "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,'RLS_TEST','CAPTURED',now(),'db://rls-test/$2',$3,'{}'::jsonb) returning id",
        [activityA, suffix, "hash-" + suffix],
      )).rows[0]!.id;
      const visible = await client.query<{ id: string; activity_id: string }>(
        "select id,activity_id from evidence where activity_id in ($1,$2)",
        [activityA, activityB],
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.id, evidenceA);
      const sameTenantUpdate = await client.query<{ id: string; status: string }>(
        "update evidence set status='VERIFIED' where id=$1 returning id,status",
        [evidenceA],
      );
      assert.equal(sameTenantUpdate.rows[0]!.id, evidenceA);
      assert.equal(sameTenantUpdate.rows[0]!.status, "VERIFIED");

      await assert.rejects(
        () => client.query(
          "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,'RLS_TEST','CAPTURED',now(),'db://rls-test/cross-tenant',$2,'{}'::jsonb)",
          [activityB, "cross-" + suffix],
        ),
        /row-level security|policy/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally { client.release(); }
  } finally {
    if (evidenceA) await ownerPool.query("delete from evidence where id=$1", [evidenceA]);
    if (activityA) await ownerPool.query("delete from activities where id=$1", [activityA]);
    if (activityB) await ownerPool.query("delete from activities where id=$1", [activityB]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end(); await ownerPool.end();
  }
});

test("Shakti RLS carbon calculations are tenant-isolated on parent activity scope", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", organizationA = "", organizationB = "", roleA = "", membershipA = "", activityA = "", activityB = "", calculationA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-CARBON-A-" + suffix])).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-CARBON-B-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-carbon:" + suffix, "RLS Carbon " + suffix, "rls-carbon-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(`insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','["activity:write"]'::jsonb,'[]'::jsonb) returning id`, [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    activityA = (await ownerPool.query<{ id: string }>("insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_CARBON','DRAFT','{}'::jsonb) returning id", [organizationA])).rows[0]!.id;
    activityB = (await ownerPool.query<{ id: string }>("insert into activities(organization_id,activity_type,status,metadata) values($1,'RLS_CARBON','DRAFT','{}'::jsonb) returning id", [organizationB])).rows[0]!.id;
    const methodology = (await ownerPool.query<{ id: string }>("select id from methodology_versions order by id limit 1")).rows[0];
    if (!methodology) throw new Error("RLS carbon runtime fixture requires at least one methodology_versions row");

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);
      calculationA = (await client.query<{ id: string }>(
        "insert into carbon_calculations(activity_id,methodology_version_id,inputs,result,unit,status,calculated_at,baseline_result,uncertainty,dataset_hash,formula_hash,calculation_trace,provenance_version,calculation_hash) values($1,$2,'{}'::jsonb,'1','tCO2e','CALCULATED',now(),0,0,'dataset-$3','formula-$3','[]'::jsonb,'1','calculation-$3') returning id",
        [activityA, methodology.id, suffix],
      )).rows[0]!.id;
      const visible = await client.query<{ id: string; activity_id: string }>("select id,activity_id from carbon_calculations where activity_id in ($1,$2)", [activityA, activityB]);
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.id, calculationA);
      const sameTenantUpdate = await client.query<{ id: string; result: string }>(
        "update carbon_calculations set result='2' where id=$1 returning id,result",
        [calculationA],
      );
      assert.equal(sameTenantUpdate.rows[0]!.id, calculationA);
      assert.equal(sameTenantUpdate.rows[0]!.result, "2");

      await assert.rejects(
        () => client.query(
          "insert into carbon_calculations(activity_id,methodology_version_id,inputs,result,unit,status,calculated_at,baseline_result,uncertainty,dataset_hash,formula_hash,calculation_trace,provenance_version,calculation_hash) values($1,$2,'{}'::jsonb,'1','tCO2e','CALCULATED',now(),0,0,'dataset-cross-$3','formula-cross-$3','[]'::jsonb,'1','calculation-cross-$3')",
          [activityB, methodology.id, suffix],
        ),
        /row-level security|policy/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally { client.release(); }
  } finally {
    if (calculationA) await ownerPool.query("delete from carbon_calculations where id=$1", [calculationA]);
    if (activityA) await ownerPool.query("delete from activities where id=$1", [activityA]);
    if (activityB) await ownerPool.query("delete from activities where id=$1", [activityB]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end(); await ownerPool.end();
  }
});


test("Shakti RLS EPR obligations are tenant-isolated for insert, read and update", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", organizationA = "", organizationB = "", roleA = "", membershipA = "", obligationA = "", obligationB = "", schemeId = "", eprObligationA = "", eprObligationB = "";
  try {
    const runtimeRole = (await ownerPool.query<{ exists: boolean }>(
      "select exists(select 1 from pg_roles where rolname='rupaykg_app_runtime') as exists",
    )).rows[0]!.exists;
    if (!runtimeRole) throw new Error("RLS runtime role is not provisioned in the test database");

    organizationA = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-EPR-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RLS-EPR-B-" + suffix],
    )).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["rls-epr:" + suffix, "RLS EPR " + suffix, "rls-epr-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"activity:write\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationA, roleA],
    )).rows[0]!.id;

    schemeId = (await ownerPool.query<{ id: string }>(
      "insert into epr_schemes(code,name,authority,status,metadata) values($1,'RLS EPR Test Scheme','TEST_AUTHORITY','VERIFIED','{}'::jsonb) returning id",
      ["RLS-EPR-" + suffix],
    )).rows[0]!.id;
    obligationA = (await ownerPool.query<{ id: string }>(
      "insert into obligations(organization_id,obligation_type,period_start,period_end,required_quantity,status) values($1,'RLS_EPR','2026-01-01','2026-12-31',10,'OPEN') returning id",
      [organizationA],
    )).rows[0]!.id;
    obligationB = (await ownerPool.query<{ id: string }>(
      "insert into obligations(organization_id,obligation_type,period_start,period_end,required_quantity,status) values($1,'RLS_EPR','2026-01-01','2026-12-31',20,'OPEN') returning id",
      [organizationB],
    )).rows[0]!.id;
    eprObligationA = (await ownerPool.query<{ id: string }>(
      "insert into epr_obligations(obligation_id,scheme_id,obligated_organization_id,category_code,target_quantity,fulfilled_quantity,status) values($1,$2,$3,'RLS',10,0,'OPEN') returning id",
      [obligationA, schemeId, organizationA],
    )).rows[0]!.id;
    eprObligationB = (await ownerPool.query<{ id: string }>(
      "insert into epr_obligations(obligation_id,scheme_id,obligated_organization_id,category_code,target_quantity,fulfilled_quantity,status) values($1,$2,$3,'RLS',20,0,'OPEN') returning id",
      [obligationB, schemeId, organizationB],
    )).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);

      const visible = await client.query<{ id: string; obligated_organization_id: string }>(
        "select id, obligated_organization_id from epr_obligations where id in ($1,$2) order by id",
        [eprObligationA, eprObligationB],
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.id, eprObligationA);
      assert.equal(visible.rows[0]!.obligated_organization_id, organizationA);

      const updated = await client.query<{ id: string; fulfilled_quantity: string }>(
        "update epr_obligations set fulfilled_quantity=3 where id=$1 returning id, fulfilled_quantity",
        [eprObligationA],
      );
      assert.equal(updated.rows[0]!.id, eprObligationA);
      assert.equal(updated.rows[0]!.fulfilled_quantity, "3");

      const sameTenantInserted = await client.query<{ id: string; obligated_organization_id: string }>(
        "insert into epr_obligations(obligation_id,scheme_id,obligated_organization_id,category_code,target_quantity,fulfilled_quantity,status) values($1,$2,$3,'RLS_SAME',5,0,'OPEN') returning id, obligated_organization_id",
        [obligationA, schemeId, organizationA],
      );
      assert.equal(sameTenantInserted.rows[0]!.obligated_organization_id, organizationA);

      await assert.rejects(
        () => client.query(
          "insert into epr_obligations(obligation_id,scheme_id,obligated_organization_id,category_code,target_quantity,fulfilled_quantity,status) values($1,$2,$3,'RLS_CROSS',20,0,'OPEN')",
          [obligationB, schemeId, organizationB],
        ),
        /row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query(
          "update epr_obligations set fulfilled_quantity=4 where id=$1",
          [eprObligationB],
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
    if (eprObligationA) await ownerPool.query("delete from epr_obligations where id=$1", [eprObligationA]);
    if (eprObligationB) await ownerPool.query("delete from epr_obligations where id=$1", [eprObligationB]);
    if (obligationA) await ownerPool.query("delete from obligations where id=$1", [obligationA]);
    if (obligationB) await ownerPool.query("delete from obligations where id=$1", [obligationB]);
    if (schemeId) await ownerPool.query("delete from epr_schemes where id=$1", [schemeId]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti RLS settlement rows are bilateral-readable but payer-mutation-only", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", identityBId = "", organizationA = "", organizationB = "", organizationC = "", roleA = "", roleB = "", membershipA = "", membershipB = "", settlementA = "", settlementB = "", eventA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-SETTLEMENT-A-" + suffix])).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-SETTLEMENT-B-" + suffix])).rows[0]!.id;
    organizationC = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-SETTLEMENT-C-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-settlement:" + suffix, "RLS Settlement " + suffix, "rls-settlement-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[\"settlement:authorize\"]'::jsonb,'[]'::jsonb) returning id", [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    settlementA = (await ownerPool.query<{ id: string }>("insert into settlements(payer_id,payee_id,amount,currency,status) values($1,$2,10,'INR','CREATED') returning id", [organizationA, organizationB])).rows[0]!.id;
    settlementB = (await ownerPool.query<{ id: string }>("insert into settlements(payer_id,payee_id,amount,currency,status) values($1,$2,20,'INR','CREATED') returning id", [organizationB, organizationC])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);

      const visible = await client.query<{ id: string; payer_id: string; payee_id: string }>(
        "select id,payer_id,payee_id from settlements where id in ($1,$2) order by id",
        [settlementA, settlementB],
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.id, settlementA);

      const payerUpdate = await client.query<{ id: string; amount: string }>(
        "update settlements set amount=11 where id=$1 returning id,amount",
        [settlementA],
      );
      assert.equal(payerUpdate.rows[0]!.id, settlementA);
      assert.equal(payerUpdate.rows[0]!.amount, "11");

      await assert.rejects(
        () => client.query("update settlements set amount=21 where id=$1", [settlementB]),
        /row-level security|policy/i,
      );

      eventA = (await client.query<{ id: string }>(
        "insert into settlement_events(settlement_id,event_type,event_hash) values($1,'RLS_TEST',$2) returning id",
        [settlementA, suffix],
      )).rows[0]!.id;
      const events = await client.query<{ id: string }>(
        "select id from settlement_events where settlement_id in ($1,$2)",
        [settlementA, settlementB],
      );
      assert.equal(events.rows.length, 1);
      assert.equal(events.rows[0]!.id, eventA);

      await assert.rejects(
        () => client.query("insert into settlement_events(settlement_id,event_type,event_hash) values($1,'RLS_CROSS',$2)", [settlementB, suffix]),
        /row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query("update settlement_events set event_type='MUTATED' where id=$1", [eventA]),
        /permission denied|row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query("delete from settlement_events where id=$1", [eventA]),
        /permission denied|row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query("delete from settlements where id=$1", [settlementA]),
        /permission denied|row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query("update settlements set status='SETTLED' where id=$1", [settlementA]),
        /invalid settlement lifecycle transition|check constraint|policy/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (eventA) await ownerPool.query("delete from settlement_events where id=$1", [eventA]);
    if (settlementA) await ownerPool.query("delete from settlements where id=$1", [settlementA]);
    if (settlementB) await ownerPool.query("delete from settlements where id=$1", [settlementB]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    if (organizationC) await ownerPool.query("delete from organizations where id=$1", [organizationC]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti RLS credential rows are current-owner-readable and owner-mutation-only", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", identityBId = "", organizationA = "", organizationB = "", roleA = "", membershipA = "", credentialA = "", registryEventA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-CREDENTIAL-A-" + suffix])).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-CREDENTIAL-B-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-credential:" + suffix, "RLS Credential " + suffix, "rls-credential-" + suffix + "@example.invalid"])).rows[0]!.id;
    identityBId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-credential-other:" + suffix, "RLS Credential Other " + suffix, "rls-credential-other-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[]'::jsonb,'[]'::jsonb) returning id", [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    credentialA = (await ownerPool.query<{ id: string }>("insert into credentials(issuer_organization_id,trust_root_id,status) values($1,$2,'ELIGIBLE') returning id", [organizationA, "RLS-TRUST-" + suffix])).rows[0]!.id;
    registryEventA = (await ownerPool.query<{ id: string }>("insert into registry_events(credential_id,event_type,to_owner_id,recorded_by_identity_id,event_hash) values($1,'ISSUED',$2,$3,$4) returning id", [credentialA, organizationA, identityId, "RLS-EVENT-" + suffix])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);

      const visible = await client.query<{ id: string; issuer_organization_id: string }>("select id,issuer_organization_id from credentials where id=$1", [credentialA]);
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0]!.issuer_organization_id, organizationA);

      await assert.rejects(
        () => client.query("update credentials set trust_root_id=$1 where id=$2", ["RLS-IMMUTABLE-" + suffix, credentialA]),
        /credential authority fields are immutable/i,
      );

      const updated = await client.query<{ id: string; status: string }>("update credentials set status='ACTIVE' where id=$1 returning id,status", [credentialA]);
      assert.equal(updated.rows[0]!.id, credentialA);
      assert.equal(updated.rows[0]!.status, "ACTIVE");

      await assert.rejects(
        () => client.query("insert into registry_events(credential_id,event_type,to_owner_id,recorded_by_identity_id,event_hash) values($1,'IDENTITY_MISMATCH',$2,$3,$4)", [credentialA, organizationA, identityBId, "RLS-MISMATCH-" + suffix]),
        /row-level security|policy/i,
      );
      await assert.rejects(
        () => client.query("insert into registry_events(credential_id,event_type,to_owner_id,recorded_by_identity_id,event_hash) values($1,'CROSS_TENANT',$2,$3,$4)", [credentialA, organizationB, identityId, "RLS-CROSS-" + suffix]),
        /row-level security|policy/i,
      );

      await assert.rejects(
        () => client.query("delete from credentials where id=$1", [credentialA]),
        /permission denied|row-level security|policy/i,
      );

      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }

    const crossClient = await runtimePool.connect();
    try {
      await crossClient.query("begin");
      await crossClient.query("set local role rupaykg_app_runtime");
      await assert.rejects(
        () => crossClient.query("select id from credentials where id=$1", [credentialA]),
        /row-level security|policy/i,
      );
      await crossClient.query("rollback");
    } catch (error) {
      try { await crossClient.query("rollback"); } catch {}
      throw error;
    } finally {
      crossClient.release();
    }
  } finally {
    if (registryEventA) await ownerPool.query("delete from registry_events where id=$1", [registryEventA]);
    if (credentialA) await ownerPool.query("delete from credentials where id=$1", [credentialA]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti RLS field-sync evidence is identity/device/tenant isolated", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "", identityBId = "", organizationA = "", organizationB = "", roleA = "", membershipA = "", deviceA = "", envelopeA = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-SYNC-A-" + suffix])).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-RLS-SYNC-B-" + suffix])).rows[0]!.id;
    identityId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-sync:" + suffix, "RLS Sync " + suffix, "rls-sync-" + suffix + "@example.invalid"])).rows[0]!.id;
    identityBId = (await ownerPool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["rls-sync-other:" + suffix, "RLS Sync Other " + suffix, "rls-sync-other-" + suffix + "@example.invalid"])).rows[0]!.id;
    roleA = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','[]'::jsonb,'[]'::jsonb) returning id", [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
    deviceA = (await ownerPool.query<{ id: string }>("insert into field_devices(device_id,identity_id,organization_id,status,registered_by_identity_id,registered_at) values($1,$2,$3,'VERIFIED',$2,now()) returning id", ["RLS-SYNC-DEVICE-" + suffix, identityId, organizationA])).rows[0]!.id;
    envelopeA = (await ownerPool.query<{ id: string }>("insert into field_sync_envelopes(device_id,identity_id,idempotency_key,client_sequence,captured_at,payload,payload_hash) values($1,$2,$3,1,now(),'{}'::jsonb,'RLS-SYNC-HASH') returning id", [deviceA, identityId, "RLS-SYNC-" + suffix])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationA]);

      const visible = await client.query<{ id: string }>("select id from field_sync_envelopes where id=$1", [envelopeA]);
      assert.equal(visible.rows.length, 1);

      await assert.rejects(
        () => client.query("insert into field_sync_envelopes(device_id,identity_id,idempotency_key,client_sequence,captured_at,payload,payload_hash) values($1,$2,$3,2,now(),'{}'::jsonb,'RLS-CROSS')", [deviceA, identityBId, "RLS-SYNC-MISMATCH-" + suffix]),
        /row-level security|policy|identity must match/i,
      );
      await assert.rejects(
        () => client.query("delete from field_sync_envelopes where id=$1", [envelopeA]),
        /permission denied|row-level security|policy/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }

    const otherClient = await runtimePool.connect();
    try {
      await otherClient.query("begin");
      await otherClient.query("set local role rupaykg_app_runtime");
      await otherClient.query("select app.set_request_context($1,$2)", [identityBId, organizationB]);
      const hidden = await otherClient.query<{ id: string }>("select id from field_sync_envelopes where id=$1", [envelopeA]);
      assert.equal(hidden.rows.length, 0);
      await otherClient.query("rollback");
    } catch (error) {
      try { await otherClient.query("rollback"); } catch {}
      throw error;
    } finally {
      otherClient.release();
    }
  } finally {
    if (envelopeA) await ownerPool.query("delete from field_sync_envelopes where id=$1", [envelopeA]);
    if (deviceA) await ownerPool.query("delete from field_devices where id=$1", [deviceA]);
    if (membershipA) await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await ownerPool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti credential lifecycle cannot commit without matching registry provenance", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let organizationA = "", credentialA = "", credentialB = "";
  try {
    organizationA = (await ownerPool.query<{ id: string }>("insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id", ["TEST-CRED-ATOMICITY-" + suffix])).rows[0]!.id;
    credentialA = (await ownerPool.query<{ id: string }>("insert into credentials(issuer_organization_id,trust_root_id,status) values($1,$2,'ELIGIBLE') returning id", [organizationA, "ATOMICITY-TRUST-A-" + suffix])).rows[0]!.id;
    credentialB = (await ownerPool.query<{ id: string }>("insert into credentials(issuer_organization_id,trust_root_id,status) values($1,$2,'ELIGIBLE') returning id", [organizationA, "ATOMICITY-TRUST-B-" + suffix])).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("set local role rupaykg_app_runtime");
      await client.query("select app.set_request_context($1,$2)", [crypto.randomUUID(), organizationA]);
      await assert.rejects(
        async () => {
          await client.query("update credentials set status='ACTIVE' where id=$1", [credentialA]);
          await client.query("commit");
        },
        /credential lifecycle state requires matching registry event: ACTIVATED/i,
      );
      try { await client.query("rollback"); } catch {}
    } finally {
      client.release();
    }

    await ownerPool.query("insert into registry_events(credential_id,event_type,to_owner_id,event_hash) values($1,'ISSUED',$2,$3)", [credentialB, organizationA, "ATOMICITY-ISSUED-" + suffix]);
    const ownerClient = await ownerPool.connect();
    try {
      await ownerClient.query("begin");
      await ownerClient.query("update credentials set status='ACTIVE' where id=$1", [credentialB]);
      await ownerClient.query("insert into registry_events(credential_id,event_type,to_owner_id,event_hash) values($1,'ACTIVATED',$2,$3)", [credentialB, organizationA, "ATOMICITY-ACTIVATED-" + suffix]);
      await ownerClient.query("commit");
    } finally {
      ownerClient.release();
    }
    const final = await ownerPool.query<{ status: string }>("select status from credentials where id=$1", [credentialB]);
    assert.equal(final.rows[0]?.status, "ACTIVE");
  } finally {
    if (credentialA) await ownerPool.query("delete from credentials where id=$1", [credentialA]);
    if (credentialB) {
      await ownerPool.query("delete from registry_events where credential_id=$1", [credentialB]);
      await ownerPool.query("delete from credentials where id=$1", [credentialB]);
    }
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    await runtimePool.end();
    await ownerPool.end();
  }
});
