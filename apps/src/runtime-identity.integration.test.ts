import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

const enabled =
  process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" &&
  process.env.RUPAYKG_REQUIRE_NON_BYPASSRLS === "1" &&
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.RUPAYKG_TEST_OWNER_DATABASE_URL);

test("Shakti production runtime identity is non-BYPASSRLS and tenant-isolated", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let organizationA = "";
  let organizationB = "";
  let activityA = "";
  let activityB = "";

  try {
    const role = (await runtimePool.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean; rolcreatedb: boolean }>(
      "select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb from pg_roles where rolname=current_user",
    )).rows[0]!;

    assert.equal(role.rolsuper, false, "application runtime must not be SUPERUSER");
    assert.equal(role.rolbypassrls, false, "application runtime must not BYPASSRLS");
    assert.equal(role.rolcreaterole, false, "application runtime must not CREATEROLE");
    assert.equal(role.rolcreatedb, false, "application runtime must not CREATEDB");

    organizationA = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RUNTIME-A-" + suffix],
    )).rows[0]!.id;
    organizationB = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-RUNTIME-B-" + suffix],
    )).rows[0]!.id;

    activityA = (await ownerPool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RUNTIME_IDENTITY_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;
    activityB = (await ownerPool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status,metadata) values($1,'RUNTIME_IDENTITY_TEST','DRAFT','{}'::jsonb) returning id",
      [organizationB],
    )).rows[0]!.id;

    const contextIdentity = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["runtime-identity:" + suffix, "Runtime Identity " + suffix, "runtime-identity-" + suffix + "@example.invalid"],
    )).rows[0]!.id;

    const roleA = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'runtime_test_role','[\"activity:read\"]'::jsonb,'[]'::jsonb) returning id",
      [organizationA],
    )).rows[0]!.id;

    const membershipA = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [contextIdentity, organizationA, roleA],
    )).rows[0]!.id;

    try {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select app.set_request_context($1,$2)", [contextIdentity, organizationA]);

        const visible = await client.query<{ id: string; organization_id: string }>(
          "select id, organization_id from activities where id in ($1,$2) order by id",
          [activityA, activityB],
        );
        assert.equal(visible.rows.length, 1, "runtime role must not see another tenant's activity");
        assert.equal(visible.rows[0]!.id, activityA);
        assert.equal(visible.rows[0]!.organization_id, organizationA);

        await assert.rejects(
          () => client.query(
            "insert into activities(organization_id,activity_type,status,metadata) values($1,'RUNTIME_IDENTITY_TEST','DRAFT','{}'::jsonb)",
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
      await ownerPool.query("delete from organization_memberships where id=$1", [membershipA]);
      await ownerPool.query("delete from roles where id=$1", [roleA]);
      await ownerPool.query("delete from identities where id=$1", [contextIdentity]);
    }
  } finally {
    if (activityA) await ownerPool.query("delete from activities where id=$1", [activityA]);
    if (activityB) await ownerPool.query("delete from activities where id=$1", [activityB]);
    if (organizationA) await ownerPool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await ownerPool.query("delete from organizations where id=$1", [organizationB]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti privileged context rejects unauthorized identities", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationId = "";
  let roleId = "";
  let membershipId = "";

  try {
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["privileged-context:" + suffix, "Privileged Context " + suffix, "privileged-context-" + suffix + "@example.invalid"],
    )).rows[0]!.id;

    organizationId = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-PRIVILEGED-" + suffix],
    )).rows[0]!.id;

    roleId = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'runtime_test_role','[]'::jsonb,'[]'::jsonb) returning id",
      [organizationId],
    )).rows[0]!.id;

    membershipId = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationId, roleId],
    )).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await assert.rejects(
        () => client.query("select app.set_platform_context($1)", [identityId]),
        /not an active Super Admin/i,
      );
      await assert.rejects(
        () => client.query("select app.set_authority_context($1,$2,$3)", [identityId, "PLATFORM", null]),
        /not authorized for the requested authority context/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (membershipId) await ownerPool.query("delete from organization_memberships where id=$1", [membershipId]);
    if (roleId) await ownerPool.query("delete from roles where id=$1", [roleId]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationId) await ownerPool.query("delete from organizations where id=$1", [organizationId]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti authority context rejects out-of-scope geography", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationId = "";
  let roleId = "";
  let membershipId = "";
  let geographyId = "";

  try {
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["authority-geo:" + suffix, "Authority Geo " + suffix, "authority-geo-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    organizationId = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-AUTHORITY-GEO-" + suffix],
    )).rows[0]!.id;
    roleId = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'regulator','[]'::jsonb,'[]'::jsonb) returning id",
      [organizationId],
    )).rows[0]!.id;
    membershipId = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationId, roleId],
    )).rows[0]!.id;
    geographyId = (await ownerPool.query<{ id: string }>(
      "select id from geography where kind='STATE_UT' order by id limit 1",
    )).rows[0]?.id ?? "";
    assert.ok(geographyId, "disposable runtime schema must provide a STATE_UT geography fixture");

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await assert.rejects(
        () => client.query("select app.set_authority_context($1,$2,$3)", [identityId, "STATE", geographyId]),
        /not authorized for the requested authority context/i,
      );
      await client.query("rollback");
    } catch (error) {
      try { await client.query("rollback"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  } finally {
    if (membershipId) await ownerPool.query("delete from organization_memberships where id=$1", [membershipId]);
    if (roleId) await ownerPool.query("delete from roles where id=$1", [roleId]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationId) await ownerPool.query("delete from organizations where id=$1", [organizationId]);
    await runtimePool.end();
    await ownerPool.end();
  }
});


test("Shakti transaction-local context does not leak across pooled transactions", { skip: !enabled }, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL });
  const ownerPool = new Pool({ connectionString: process.env.RUPAYKG_TEST_OWNER_DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  let identityId = "";
  let organizationId = "";
  let roleId = "";
  let membershipId = "";

  try {
    identityId = (await ownerPool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      ["context-leak:" + suffix, "Context Leak " + suffix, "context-leak-" + suffix + "@example.invalid"],
    )).rows[0]!.id;
    organizationId = (await ownerPool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-CONTEXT-LEAK-" + suffix],
    )).rows[0]!.id;
    roleId = (await ownerPool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,'runtime_test_role','[]'::jsonb,'[]'::jsonb) returning id",
      [organizationId],
    )).rows[0]!.id;
    membershipId = (await ownerPool.query<{ id: string }>(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED') returning id",
      [identityId, organizationId, roleId],
    )).rows[0]!.id;

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationId]);
      const scoped = (await client.query<{ identity_id: string; organization_id: string }>(
        "select app.current_identity_id() identity_id, app.current_organization_id() organization_id",
      )).rows[0]!;
      assert.equal(scoped.identity_id, identityId);
      assert.equal(scoped.organization_id, organizationId);
      await client.query("commit");

      const afterCommit = (await client.query<{ identity_id: string | null; organization_id: string | null }>(
        "select app.current_identity_id() identity_id, app.current_organization_id() organization_id",
      )).rows[0]!;
      assert.equal(afterCommit.identity_id, null, "identity context must not survive transaction commit");
      assert.equal(afterCommit.organization_id, null, "tenant context must not survive transaction commit");

      await client.query("begin");
      await client.query("select app.set_request_context($1,$2)", [identityId, organizationId]);
      await client.query("rollback");
      const afterRollback = (await client.query<{ identity_id: string | null; organization_id: string | null }>(
        "select app.current_identity_id() identity_id, app.current_organization_id() organization_id",
      )).rows[0]!;
      assert.equal(afterRollback.identity_id, null, "identity context must not survive transaction rollback");
      assert.equal(afterRollback.organization_id, null, "tenant context must not survive transaction rollback");
    } finally {
      try { await client.query("rollback"); } catch {}
      client.release();
    }
  } finally {
    if (membershipId) await ownerPool.query("delete from organization_memberships where id=$1", [membershipId]);
    if (roleId) await ownerPool.query("delete from roles where id=$1", [roleId]);
    if (identityId) await ownerPool.query("delete from identities where id=$1", [identityId]);
    if (organizationId) await ownerPool.query("delete from organizations where id=$1", [organizationId]);
    await runtimePool.end();
    await ownerPool.end();
  }
});
