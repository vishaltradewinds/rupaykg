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

test("identity suspension kill-switch column is present in the migrated PostgreSQL schema", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const result = await pool.query<{ data_type: string; is_nullable: string }>(`
      select data_type, is_nullable
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'identities'
         and column_name = 'suspended_at'
    `);
    assert.equal(result.rowCount, 1, "migrations must create identities.suspended_at");
    assert.equal(result.rows[0]?.data_type, "timestamp with time zone");
    assert.equal(result.rows[0]?.is_nullable, "YES", "existing identities remain unsuspended by default");
  } finally {
    await pool.end();
  }
});

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
      function_config: string;
      has_outbound_role_membership: boolean;
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
             exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a where a.grantee = 0 and a.privilege_type = 'SELECT') as public_key_read,
             array_to_string(p.proconfig, ',') as function_config,
             exists (select 1 from pg_auth_members m where m.member = r.oid) as has_outbound_role_membership
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
    assert.equal(ownership.rows[0]?.function_config, "search_path=pg_catalog, app_security");
    assert.equal(ownership.rows[0]?.has_outbound_role_membership, false);

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


test("PostgreSQL verifier trigger enforces tenant authority, independence, geography and approval immutability", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const expectRejected = async (sql: string, values: unknown[] = []) => {
    await client.query("SAVEPOINT verifier_negative_case");
    try {
      await assert.rejects(client.query(sql, values));
    } finally {
      await client.query("ROLLBACK TO SAVEPOINT verifier_negative_case");
      await client.query("RELEASE SAVEPOINT verifier_negative_case");
    }
  };
  try {
    await client.query("BEGIN");

    const orgA = (await client.query<{ id: string }>(
      "insert into public.organizations(name,organization_type,status) values('Verifier test A','TEST','VERIFIED') returning id",
    )).rows[0]!.id;
    const orgB = (await client.query<{ id: string }>(
      "insert into public.organizations(name,organization_type,status) values('Verifier test B','TEST','VERIFIED') returning id",
    )).rows[0]!.id;

    const makeIdentity = async (name: string, suspended = false) => (await client.query<{ id: string }>(
      "insert into public.identities(display_name,status,suspended_at) values($1,'VERIFIED',$2) returning id",
      [name, suspended ? new Date() : null],
    )).rows[0]!.id;
    const actor = await makeIdentity("Verifier test activity actor");
    const validVerifier = await makeIdentity("Verifier test authorized verifier");
    const roleOnlyVerifier = await makeIdentity("Verifier test role-name-only verifier");
    const foreignVerifier = await makeIdentity("Verifier test foreign tenant verifier");
    const suspendedVerifier = await makeIdentity("Verifier test suspended verifier", true);

    const makeRole = async (organizationId: string, name: string, permissions: string[]) => (await client.query<{ id: string }>(
      "insert into public.roles(organization_id,name,permissions) values($1,$2,$3::jsonb) returning id",
      [organizationId, name, JSON.stringify(permissions)],
    )).rows[0]!.id;
    const roleA = await makeRole(orgA, "VERIFIER", ["VERIFY_EVIDENCE"]);
    const roleNameOnly = await makeRole(orgA, "AUDITOR", []);
    const roleB = await makeRole(orgB, "VERIFIER", ["VERIFY_EVIDENCE"]);

    const membership = async (identityId: string, organizationId: string, roleId: string) => {
      await client.query(
        "insert into public.organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
        [identityId, organizationId, roleId],
      );
    };
    await membership(validVerifier, orgA, roleA);
    await membership(roleOnlyVerifier, orgA, roleNameOnly);
    await membership(foreignVerifier, orgB, roleB);
    await membership(suspendedVerifier, orgA, roleA);
    await membership(actor, orgA, roleA);

    const geographyId = (await client.query<{ id: string }>(
      "insert into public.geography(kind,name) values('DISTRICT','Verifier test district') returning id",
    )).rows[0]!.id;
    const activityId = (await client.query<{ id: string }>(
      "insert into public.activities(organization_id,actor_identity_id,geography_id,activity_type) values($1,$2,$3,'VERIFIER_TEST') returning id",
      [orgA, actor, geographyId],
    )).rows[0]!.id;
    const evidenceId = (await client.query<{ id: string }>(
      "insert into public.evidence(activity_id,evidence_type,captured_at) values($1,'VERIFIER_TEST',now()) returning id",
      [activityId],
    )).rows[0]!.id;

    const insertVerification = (verifierId: string, decision: "APPROVED" | "REJECTED") =>
      client.query(
        "insert into public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,$4,'TEST')",
        [evidenceId, activityId, verifierId, decision],
      );

    // Both decisions require explicit authority in the subject organization's tenant.
    await expectRejected(
      "insert into public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'REJECTED','TEST')",
      [evidenceId, activityId, roleOnlyVerifier],
    );
    await expectRejected(
      "insert into public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'REJECTED','TEST')",
      [evidenceId, activityId, foreignVerifier],
    );
    await expectRejected(
      "insert into public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'REJECTED','TEST')",
      [evidenceId, activityId, suspendedVerifier],
    );
    await expectRejected(
      "insert into public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'REJECTED','TEST')",
      [evidenceId, activityId, actor],
    );

    // A valid verifier may reject, but cannot approve until the subject organization
    // has a verified geography scope covering the activity.
    await insertVerification(validVerifier, "REJECTED");
    const rejectedSnapshot = await client.query<{ authorization_snapshot: Record<string, unknown>; authorization_snapshot_hash: string }>(
      "select authorization_snapshot, authorization_snapshot_hash from public.verifications where evidence_id=$1 and verifier_identity_id=$2 and decision='REJECTED' order by decided_at desc limit 1",
      [evidenceId, validVerifier],
    );
    assert.equal(rejectedSnapshot.rowCount, 1);
    assert.equal(rejectedSnapshot.rows[0]?.authorization_snapshot.subject_organization_id, orgA);
    assert.equal(rejectedSnapshot.rows[0]?.authorization_snapshot.verifier_identity_id, validVerifier);
    assert.match(rejectedSnapshot.rows[0]?.authorization_snapshot_hash ?? "", /^[a-f0-9]{64}$/);
    await expectRejected(
      "insert into public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,authorization_snapshot) values($1,$2,$3,'REJECTED','TEST','{}'::jsonb)",
      [evidenceId, activityId, validVerifier],
    );
    await expectRejected(
      "insert into public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'APPROVED','TEST')",
      [evidenceId, activityId, validVerifier],
    );
    await client.query(
      "insert into public.organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [orgA, geographyId],
    );
    const approved = await client.query<{ id: string; authorization_snapshot: Record<string, unknown>; authorization_snapshot_hash: string }>(
      "insert into public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'APPROVED','TEST') returning id, authorization_snapshot, authorization_snapshot_hash",
      [evidenceId, activityId, validVerifier],
    );
    assert.equal(approved.rows[0]?.authorization_snapshot.subject_organization_id, orgA);
    assert.equal(approved.rows[0]?.authorization_snapshot.verifier_identity_id, validVerifier);
    assert.equal(approved.rows[0]?.authorization_snapshot.decision, "APPROVED");
    assert.match(approved.rows[0]?.authorization_snapshot_hash ?? "", /^[a-f0-9]{64}$/);
    await expectRejected(
      "update public.verifications set rationale='attempted rewrite' where id=$1",
      [approved.rows[0]!.id],
    );
    await expectRejected(
      "delete from public.verifications where id=$1",
      [approved.rows[0]!.id],
    );

    // A verified geography assignment is insufficient when the subject
    // organization itself has not passed legal/organizational verification.
    const pendingOrg = (await client.query<{ id: string }>(
      "insert into public.organizations(name,organization_type,status) values('Verifier test pending organization','TEST','PENDING') returning id",
    )).rows[0]!.id;
    const pendingVerifier = await makeIdentity("Verifier test pending-organization verifier");
    const pendingRole = await makeRole(pendingOrg, "VERIFIER", ["VERIFY_EVIDENCE"]);
    await membership(pendingVerifier, pendingOrg, pendingRole);
    const pendingActivity = (await client.query<{ id: string }>(
      "insert into public.activities(organization_id,actor_identity_id,geography_id,activity_type) values($1,$2,$3,'VERIFIER_TEST') returning id",
      [pendingOrg, actor, geographyId],
    )).rows[0]!.id;
    const pendingEvidence = (await client.query<{ id: string }>(
      "insert into public.evidence(activity_id,evidence_type,captured_at) values($1,'VERIFIER_TEST',now()) returning id",
      [pendingActivity],
    )).rows[0]!.id;
    await client.query(
      "insert into public.organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [pendingOrg, geographyId],
    );
    await expectRejected(
      "insert into public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'APPROVED','TEST')",
      [pendingEvidence, pendingActivity, pendingVerifier],
    );

    // Even a verified scope attached to a node inside a malformed cycle must
    // not authorize the activity: cycle detection invalidates the hierarchy.
    const cycleA = (await client.query<{ id: string }>(
      "insert into public.geography(kind,name) values('DISTRICT','Verifier cycle A') returning id",
    )).rows[0]!.id;
    const cycleB = (await client.query<{ id: string }>(
      "insert into public.geography(kind,name) values('DISTRICT','Verifier cycle B') returning id",
    )).rows[0]!.id;
    await client.query("update public.geography set parent_id=$2 where id=$1", [cycleA, cycleB]);
    await client.query("update public.geography set parent_id=$2 where id=$1", [cycleB, cycleA]);
    await client.query(
      "insert into public.organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [orgB, cycleB],
    );
    const cycleResult = await client.query<{ allowed: boolean }>(
      "select public.organization_has_geography_scope($1,$2) as allowed",
      [orgB, cycleA],
    );
    assert.equal(cycleResult.rows[0]?.allowed, false, "a verified scope inside a cyclic hierarchy must fail closed");
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
  }
});
