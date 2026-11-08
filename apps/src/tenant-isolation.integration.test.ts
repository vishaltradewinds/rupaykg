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

      await assert.rejects(
        () => client.query(
          "insert into measurements(activity_id,value,unit,method,source,measured_at,metadata) values($1,3,'kg','RLS_TEST','fixture',now(),'{}'::jsonb)",
          [activityB],
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
    roleA = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','["activity:write"]'::jsonb,'[]'::jsonb) returning id", [organizationA])).rows[0]!.id;
    membershipA = (await ownerPool.query<{ id: string }>("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id", [identityId, organizationA, roleA])).rows[0]!.id;
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
    roleA = (await ownerPool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'tenant_test_role','["activity:write"]'::jsonb,'[]'::jsonb) returning id", [organizationA])).rows[0]!.id;
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
