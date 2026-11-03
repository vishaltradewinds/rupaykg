import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { createSignedRequestContextToken } from "./signed-request-context-token.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("restricted app runtime can use only signed-context-bound boolean permission helpers", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const suffix = randomBytes(6).toString("hex");
  const keyId = "auth_ci_" + suffix;
  const secret = randomBytes(32).toString("base64url");
  try {
    await client.query("BEGIN");
    const orgA = (await client.query<{ id: string }>(
      "insert into public.organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["Auth Helper Tenant A " + suffix],
    )).rows[0]!.id;
    const orgB = (await client.query<{ id: string }>(
      "insert into public.organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["Auth Helper Tenant B " + suffix],
    )).rows[0]!.id;

    const identityA = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["auth-helper-a:" + suffix, "Auth Helper A"],
    )).rows[0]!.id;
    const identityB = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["auth-helper-b:" + suffix, "Auth Helper B"],
    )).rows[0]!.id;
    const identityPending = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["auth-helper-pending:" + suffix, "Auth Helper Pending"],
    )).rows[0]!.id;
    const identityNameOnly = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["auth-helper-name-only:" + suffix, "Auth Helper Name Only"],
    )).rows[0]!.id;
    const identityRevoked = (await client.query<{ id: string }>(
      "insert into public.identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["auth-helper-revoked:" + suffix, "Auth Helper Revoked"],
    )).rows[0]!.id;

    const roleA = (await client.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions,geography_scope) values($1,'tenant_reader','[\"epr:read\"]'::jsonb,'[]'::jsonb) returning id",
      [orgA],
    )).rows[0]!.id;
    const roleB = (await client.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions,geography_scope) values($1,'tenant_reader','[\"epr:read\"]'::jsonb,'[]'::jsonb) returning id",
      [orgB],
    )).rows[0]!.id;
    const rolePending = (await client.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions,geography_scope) values($1,'tenant_reader_pending','[\"epr:read\"]'::jsonb,'[]'::jsonb) returning id",
      [orgA],
    )).rows[0]!.id;
    const roleNameOnly = (await client.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions,geography_scope) values($1,'epr_admin','[\"dashboard:read\"]'::jsonb,'[]'::jsonb) returning id",
      [orgA],
    )).rows[0]!.id;
    const roleRevoked = (await client.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions,geography_scope) values($1,'tenant_reader_revoked','[\"epr:read\"]'::jsonb,'[]'::jsonb) returning id",
      [orgA],
    )).rows[0]!.id;

    await client.query("ALTER TABLE public.organization_memberships DISABLE TRIGGER stakeholder_membership_application_guard");
    await client.query(
      "insert into public.organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$5,$6,'VERIFIED'),($7,$8,$9,'PENDING'),($10,$11,$12,'VERIFIED'),($13,$14,$15,'REVOKED')",
      [identityA, orgA, roleA, identityB, orgB, roleB, identityPending, orgA, rolePending, identityNameOnly, orgA, roleNameOnly, identityRevoked, orgA, roleRevoked],
    );
    await client.query("ALTER TABLE public.organization_memberships ENABLE TRIGGER stakeholder_membership_application_guard");

    await client.query(
      "insert into app_security.request_context_keys(key_id,secret,active) values($1,$2,true)",
      [keyId, secret],
    );
    const bearerToken = "ci-auth-session-" + suffix;
    const tokenHash = createHash("sha256").update(bearerToken).digest("hex");
    await client.query(
      "insert into public.identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '5 minutes',$2)",
      [identityA, tokenHash],
    );

    await client.query("SET LOCAL ROLE rupaykg_app_runtime");
    const privileges = await client.query<{
      can_read_memberships: boolean;
      can_read_roles: boolean;
      can_execute_helper: boolean;
      can_use_schema: boolean;
    }>(
      `select
         has_table_privilege(current_user,'public.organization_memberships','SELECT') as can_read_memberships,
         has_table_privilege(current_user,'public.roles','SELECT') as can_read_roles,
         has_function_privilege(current_user,'auth_private.has_organization_permission(uuid,uuid,text[])','EXECUTE') as can_execute_helper,
         has_schema_privilege(current_user,'auth_private','USAGE') as can_use_schema`,
    );
    assert.deepEqual(privileges.rows[0], {
      can_read_memberships: false,
      can_read_roles: false,
      can_execute_helper: true,
      can_use_schema: true,
    });

    const resolvedSession = await client.query<{
      identity_id: string;
      organization_id: string;
      role_id: string;
      membership_status: string;
    }>(
      "select identity_id,organization_id,role_id,membership_status from auth_private.resolve_session($1)",
      [tokenHash],
    );
    assert.deepEqual(resolvedSession.rows, [{
      identity_id: identityA,
      organization_id: orgA,
      role_id: roleA,
      membership_status: "VERIFIED",
    }], "restricted runtime must resolve only the active identity's verified organization membership");

    const authorize = async (actorId: string, organizationId: string, token?: string) => {
      await client.query("select set_config('app.request_context',$1,true)", [token ?? ""]);
      const result = await client.query<{ allowed: boolean }>(
        "select auth_private.has_organization_permission($1,$2,$3::text[]) as allowed",
        [actorId, organizationId, ["epr:read"]],
      );
      return result.rows[0]?.allowed === true;
    };

    const tokenA = createSignedRequestContextToken(
      { actorIdentityId: identityA, organizationId: orgA },
      { secret, keyId, ttlSeconds: 60 },
    );
    assert.equal(await authorize(identityA, orgA, tokenA), true, "verified same-organization explicit permission is allowed");
    assert.equal(await authorize(identityA, orgB, tokenA), false, "the signed organization claim cannot be substituted");
    assert.equal(await authorize(identityB, orgB, tokenA), false, "the signed actor claim cannot be substituted");

    const tokenB = createSignedRequestContextToken(
      { actorIdentityId: identityB, organizationId: orgB },
      { secret, keyId, ttlSeconds: 60 },
    );
    assert.equal(await authorize(identityB, orgB, tokenB), true, "a second tenant is independently authorized only under its own signed context");

    const pendingToken = createSignedRequestContextToken(
      { actorIdentityId: identityPending, organizationId: orgA },
      { secret, keyId, ttlSeconds: 60 },
    );
    assert.equal(await authorize(identityPending, orgA, pendingToken), false, "pending membership is denied");

    const nameOnlyToken = createSignedRequestContextToken(
      { actorIdentityId: identityNameOnly, organizationId: orgA },
      { secret, keyId, ttlSeconds: 60 },
    );
    assert.equal(await authorize(identityNameOnly, orgA, nameOnlyToken), false, "a privileged-looking role name without an explicit permission is denied");
    const revokedToken = createSignedRequestContextToken(
      { actorIdentityId: identityRevoked, organizationId: orgA },
      { secret, keyId, ttlSeconds: 60 },
    );
    assert.equal(await authorize(identityRevoked, orgA, revokedToken), false, "revoked membership is denied even when its role contains the explicit permission");

    assert.equal(await authorize(identityA, orgA, "forged.context"), false, "forged signed context is denied");
    assert.equal(await authorize(identityA, orgA), false, "missing signed context is denied");

    await assert.rejects(
      client.query("select * from public.organization_memberships limit 1"),
      (error: unknown) => (error as { code?: string }).code === "42501",
      "the runtime cannot read membership rows directly",
    );
    await client.query("ROLLBACK");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
