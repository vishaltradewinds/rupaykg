import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const actorId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function signedToken(secret: string, keyId: string, issuedAt: number, expiresAt: number): string {
  const payload = [actorId, organizationId, String(issuedAt), String(expiresAt), keyId].join("|");
  const signature = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return payload + "." + signature;
}

test("database signed-context verifier authenticates claims and fails closed", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const suffix = randomBytes(6).toString("hex");
  const roleName = "ctx_verify_test_" + suffix;
  const keyId = "ci_" + suffix;
  const secret = randomBytes(32).toString("hex");
  const now = Math.floor(Date.now() / 1000);
  try {
    const ownership = await pool.query<{
      function_owner: string;
      table_owner: string;
      can_login: boolean;
      is_superuser: boolean;
      bypass_rls: boolean;
      can_create_roles: boolean;
      can_create_databases: boolean;
      inherits_roles: boolean;
      can_replicate: boolean;
      public_execute: boolean;
      public_key_read: boolean;
    }>(`
      select pg_get_userbyid(p.proowner) as function_owner,
             pg_get_userbyid(c.relowner) as table_owner,
             r.rolcanlogin as can_login,
             r.rolsuper as is_superuser,
             r.rolbypassrls as bypass_rls,
             r.rolcreaterole as can_create_roles,
             r.rolcreatedb as can_create_databases,
             r.rolinherit as inherits_roles,
             r.rolreplication as can_replicate,
             exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_execute,
             exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a where a.grantee = 0 and a.privilege_type = 'SELECT') as public_key_read
        from pg_proc p
        join pg_roles r on r.oid = p.proowner
        join pg_class c on c.oid = 'app_security.request_context_keys'::regclass
       where p.oid = 'app_security.current_request_context_claims()'::regprocedure
    `);
    assert.equal(ownership.rows[0]?.function_owner, "rupaykg_security_definer");
    assert.equal(ownership.rows[0]?.table_owner, "rupaykg_security_definer");
    assert.equal(ownership.rows[0]?.can_login, false);
    assert.equal(ownership.rows[0]?.is_superuser, false);
    assert.equal(ownership.rows[0]?.bypass_rls, false);
    assert.equal(ownership.rows[0]?.can_create_roles, false);
    assert.equal(ownership.rows[0]?.can_create_databases, false);
    assert.equal(ownership.rows[0]?.inherits_roles, false);
    assert.equal(ownership.rows[0]?.can_replicate, false);
    assert.equal(ownership.rows[0]?.public_execute, false);
    assert.equal(ownership.rows[0]?.public_key_read, false);

    await pool.query("insert into app_security.request_context_keys(key_id,secret,active) values($1,$2,true)", [keyId, secret]);
    await pool.query("create role " + roleName + " nologin nobypassrls");
    await pool.query("grant usage on schema app_security to " + roleName);
    await pool.query("grant execute on function app_security.current_request_context_claims() to " + roleName);

    const client = await pool.connect();
    try {
      const readClaims = async (token?: string) => {
        await client.query("begin");
        try {
          await client.query("set local role " + roleName);
          if (token !== undefined) {
            await client.query("select set_config('app.request_context',$1,true)", [token]);
          }
          const result = await client.query<{ claims: string[] | null }>(
            "select app_security.current_request_context_claims() as claims",
          );
          await client.query("commit");
          return result.rows[0]?.claims ?? null;
        } catch (error) {
          await client.query("rollback");
          throw error;
        }
      };

      assert.deepEqual(await readClaims(signedToken(secret, keyId, now, now + 60)), [actorId, organizationId]);
      assert.equal(await readClaims(), null, "missing context must return NULL");
      const valid = signedToken(secret, keyId, now, now + 60);
      assert.equal(await readClaims(valid.slice(0, -1) + (valid.endsWith("0") ? "1" : "0")), null, "forged signature must return NULL");
      assert.equal(await readClaims(signedToken(secret, keyId, now - 180, now - 120)), null, "expired context must return NULL");
      assert.equal(await readClaims(signedToken(secret, "unknown_" + suffix, now, now + 60)), null, "unknown key must return NULL");

      await client.query("begin");
      await client.query("set local role " + roleName);
      await assert.rejects(
        client.query("select * from app_security.request_context_keys"),
        (error: unknown) => (error as { code?: string }).code === "42501",
      );
      await client.query("rollback");
    } finally {
      client.release();
    }
  } finally {
    await pool.query("revoke execute on function app_security.current_request_context_claims() from " + roleName);
    await pool.query("revoke usage on schema app_security from " + roleName);
    await pool.query("drop role if exists " + roleName);
    await pool.query("delete from app_security.request_context_keys where key_id=$1", [keyId]);
    await pool.end();
  }
});
