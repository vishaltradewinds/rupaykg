import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("auth session verifier owner and capability grants are least privilege", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const result = await pool.query<{
      function_owner: string;
      can_login: boolean;
      is_superuser: boolean;
      can_create_db: boolean;
      can_create_role: boolean;
      can_replicate: boolean;
      bypasses_rls: boolean;
      inherits: boolean;
      outbound_membership: boolean;
      owner_schema_usage: boolean;
      owner_schema_create: boolean;
      owner_sessions_read: boolean;
      owner_identities_read: boolean;
      owner_organizations_read: boolean;
      capability_sessions_read: boolean;
      capability_identities_read: boolean;
      capability_execute: boolean;
      public_execute: boolean;
    }>(`
      select pg_catalog.pg_get_userbyid(p.proowner) as function_owner,
             r.rolcanlogin as can_login,
             r.rolsuper as is_superuser,
             r.rolcreatedb as can_create_db,
             r.rolcreaterole as can_create_role,
             r.rolreplication as can_replicate,
             r.rolbypassrls as bypasses_rls,
             r.rolinherit as inherits,
             exists (select 1 from pg_catalog.pg_auth_members m where m.member = r.oid) as outbound_membership,
             pg_catalog.has_schema_privilege(r.oid, 'public', 'USAGE') as owner_schema_usage,
             pg_catalog.has_schema_privilege(r.oid, 'public', 'CREATE') as owner_schema_create,
             pg_catalog.has_table_privilege(r.oid, 'public.identity_sessions', 'SELECT') as owner_sessions_read,
             pg_catalog.has_table_privilege(r.oid, 'public.identities', 'SELECT') as owner_identities_read,
             pg_catalog.has_table_privilege(r.oid, 'public.organizations', 'SELECT') as owner_organizations_read,
             pg_catalog.has_table_privilege('rupaykg_auth', 'public.identity_sessions', 'SELECT') as capability_sessions_read,
             pg_catalog.has_table_privilege('rupaykg_auth', 'public.identities', 'SELECT') as capability_identities_read,
             pg_catalog.has_function_privilege('rupaykg_auth', p.oid, 'EXECUTE') as capability_execute,
             exists (
               select 1
                 from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
                where a.grantee = 0 and a.privilege_type = 'EXECUTE'
             ) as public_execute
        from pg_catalog.pg_proc p
        join pg_catalog.pg_roles r on r.oid = p.proowner
       where p.oid = 'public.verify_identity_session(text)'::regprocedure
    `);

    const role = result.rows[0];
    assert.ok(role, "session verifier function must exist");
    assert.equal(role.function_owner, "rupaykg_auth_verifier_owner");
    assert.equal(role.can_login, false);
    assert.equal(role.is_superuser, false);
    assert.equal(role.can_create_db, false);
    assert.equal(role.can_create_role, false);
    assert.equal(role.can_replicate, false);
    assert.equal(role.bypasses_rls, true, "only the restricted session verifier owner may bypass auth-table RLS");
    assert.equal(role.outbound_membership, false, "verifier owner must not inherit another role");
    assert.equal(role.owner_schema_usage, true);
    assert.equal(role.owner_schema_create, false);
    assert.equal(role.owner_sessions_read, true);
    assert.equal(role.owner_identities_read, true);
    assert.equal(role.owner_organizations_read, false);
    assert.equal(role.capability_sessions_read, false);
    assert.equal(role.capability_identities_read, false);
    assert.equal(role.capability_execute, true);
    assert.equal(role.public_execute, false);

    const verifier = await pool.query<{ identity_id: string | null }>(
      "select public.verify_identity_session(repeat('0', 64)) as identity_id",
    );
    assert.equal(verifier.rows[0]?.identity_id, null);
  } finally {
    await pool.end();
  }
});
