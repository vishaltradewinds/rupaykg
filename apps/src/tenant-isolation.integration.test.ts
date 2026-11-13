import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
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
  let contextToken = "";
  let sessionId = "";
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

    const tokenHash = createHash("sha256").update(`tenant-isolation-test:${suffix}`).digest("hex");
    sessionId = (await pool.query<{ id: string }>(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '5 minutes',$2) returning id",
      [identityId, tokenHash],
    )).rows[0]!.id;
    const grant = await pool.query<{ context_token: string }>(
      "select context_token from app.authenticate_bearer_session($1) where organization_id=$2",
      [tokenHash, organizationA],
    );
    contextToken = grant.rows[0]?.context_token ?? "";
    assert.ok(contextToken, "bearer-session bootstrap must issue a tenant context grant");

    const authA: AuthContext = {
      identityId,
      contextToken,
      memberships: [{ organization_id: organizationA, role_id: roleA, status: "VERIFIED" }],
      activeOrganizationId: organizationA,
    };

    // Emulate the production non-BYPASSRLS connection role on every tenant
    // transaction. SET ROLE occurs immediately after BEGIN, before the
    // authenticated context setter and before any tenant-scoped query.
    const runtimePool = {
      connect: async () => {
        const client = await pool.connect();
        return {
          query: async (sql: string, values?: unknown[]) => {
            const result = await client.query(sql, values);
            if (sql.trim().toLowerCase() === "begin") await client.query("set local role rupaykg_app_runtime");
            return result;
          },
          release: () => client.release(),
        };
      },
    } as unknown as Pool;

    const context = await withTenantTransaction(runtimePool, authA, async client => {
      const row = (await client.query<{ identity_id: string; organization_id: string }>(
        "select app.current_identity_id() as identity_id, app.current_organization_id() as organization_id",
      )).rows[0]!;
      assert.equal(row.identity_id, identityId);
      assert.equal(row.organization_id, organizationA);
      return row;
    });
    assert.equal(context.organization_id, organizationA);

    // Directly setting the identity and organization GUCs is not sufficient:
    // the opaque bearer-session context token is also required by RLS.
    const spoofClient = await pool.connect();
    try {
      await spoofClient.query("begin");
      await spoofClient.query("set local role rupaykg_app_runtime");
      await spoofClient.query("select set_config('app.identity_id',$1,true), set_config('app.organization_id',$2,true), set_config('app.context_token','',true)", [identityId, organizationA]);
      const spoof = await spoofClient.query<{ count: string }>("select count(*)::text as count from organizations where id=$1", [organizationA]);
      assert.equal(spoof.rows[0]?.count, "0", "direct identity/organization GUC spoof must not reveal tenant rows");
      await spoofClient.query("rollback");
    } catch (error) {
      try { await spoofClient.query("rollback"); } catch {}
      throw error;
    } finally {
      spoofClient.release();
    }

    const crossTenantClient = await pool.connect();
    try {
      await crossTenantClient.query("begin");
      await crossTenantClient.query("set local role rupaykg_app_runtime");
      await assert.rejects(
        () => crossTenantClient.query("select app.set_request_context($1,$2,$3)", [identityId, organizationB, contextToken]),
        /context grant is invalid|not a verified member/i,
      );
      await crossTenantClient.query("rollback");
    } catch (error) {
      try { await crossTenantClient.query("rollback"); } catch {}
      throw error;
    } finally {
      crossTenantClient.release();
    }

    const reset = await withTenantTransaction(runtimePool, authA, async client => {
      const row = (await client.query<{ organization_id: string }>(
        "select app.current_organization_id() as organization_id",
      )).rows[0]!;
      return row.organization_id;
    });
    assert.equal(reset, organizationA);
  } finally {
    if (sessionId) await pool.query("delete from identity_sessions where id=$1", [sessionId]);
    if (membershipA) await pool.query("delete from organization_memberships where id=$1", [membershipA]);
    if (roleA) await pool.query("delete from roles where id=$1", [roleA]);
    if (identityId) await pool.query("delete from identities where id=$1", [identityId]);
    if (organizationA) await pool.query("delete from organizations where id=$1", [organizationA]);
    if (organizationB) await pool.query("delete from organizations where id=$1", [organizationB]);
    await pool.end();
  }
});
