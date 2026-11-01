import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const custodianA = "rupaykg_bootstrap_custodian_a" as const;
const custodianB = "rupaykg_bootstrap_custodian_b" as const;
const capabilityRole = "rupaykg_bootstrap_custodian";
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function withCustodian<T>(
  pool: Pool,
  role: typeof custodianA | typeof custodianB,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    // CI is connected as the disposable PostgreSQL superuser. SET SESSION AUTHORIZATION
    // simulates two separate LOGIN principals without storing or exposing test passwords.
    await client.query(`SET SESSION AUTHORIZATION ${role}`);
    await client.query(`SET ROLE ${capabilityRole}`);
    return await work(client);
  } finally {
    // Do not return a connection with altered session authorization to the admin pool.
    client.release(true);
  }
}

async function run(): Promise<void> {
  if (!enabled) return;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
  try {
    const state = await pool.query<{ status: string }>(
      "select status from bootstrap_private.bootstrap_state where singleton=true",
    );
    assert.equal(state.rows[0]?.status, "IDLE", "CI bootstrap must start from a fresh, unconsumed database");

    const owner = await pool.query<{
      rolcanlogin: boolean; rolsuper: boolean; rolbypassrls: boolean;
      rolcreatedb: boolean; rolcreaterole: boolean; rolinherit: boolean;
      rolreplication: boolean; can_create_database: boolean; outbound_memberships: string;
    }>(`select r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolinherit,r.rolreplication,
              has_database_privilege(r.rolname,current_database(),'CREATE') as can_create_database,
              (select count(*)::text from pg_auth_members m where m.member=r.oid) as outbound_memberships
         from pg_roles r where r.rolname='rupaykg_bootstrap_owner'`);
    assert.equal(owner.rows.length, 1);
    assert.equal(owner.rows[0]?.rolcanlogin, false);
    assert.equal(owner.rows[0]?.rolsuper, false);
    assert.equal(owner.rows[0]?.rolbypassrls, false);
    assert.equal(owner.rows[0]?.rolcreatedb, false);
    assert.equal(owner.rows[0]?.rolcreaterole, false);
    assert.equal(owner.rows[0]?.rolinherit, false);
    assert.equal(owner.rows[0]?.rolreplication, false);
    assert.equal(owner.rows[0]?.can_create_database, false, "temporary database CREATE must be revoked after migration");
    assert.equal(owner.rows[0]?.outbound_memberships, "0");

    const capability = await pool.query<{ can_login: boolean; outbound_memberships: string; table_select: boolean }>(
      `select r.rolcanlogin as can_login,
              (select count(*)::text from pg_auth_members m where m.member=r.oid) as outbound_memberships,
              has_table_privilege(r.rolname,'bootstrap_private.bootstrap_claims','SELECT') as table_select
         from pg_roles r where r.rolname=$1`,
      [capabilityRole],
    );
    assert.equal(capability.rows[0]?.can_login, false);
    assert.equal(capability.rows[0]?.outbound_memberships, "0");
    assert.equal(capability.rows[0]?.table_select, false, "custodian capability must not expose claim tables");

    const loginRoles = await pool.query<{ rolcanlogin: boolean; rolinherit: boolean; rolbypassrls: boolean; memberships: string }>(
      `select r.rolcanlogin,r.rolinherit,r.rolbypassrls,
              (select count(*)::text from pg_auth_members m where m.member=r.oid) as memberships
         from pg_roles r where r.rolname=any($1::text[]) order by r.rolname`,
      [[custodianA, custodianB]],
    );
    assert.equal(loginRoles.rows.length, 2);
    for (const role of loginRoles.rows) {
      assert.equal(role.rolcanlogin, true);
      assert.equal(role.rolinherit, false);
      assert.equal(role.rolbypassrls, false);
      assert.equal(role.memberships, "1");
    }

    const suffix = randomUUID();
    const identityA = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      [`ci-bootstrap:${suffix}:a`, "CI Bootstrap Custodian A", `ci-bootstrap-a-${suffix}@example.invalid`],
    )).rows[0]?.id;
    const identityB = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      [`ci-bootstrap:${suffix}:b`, "CI Bootstrap Custodian B", `ci-bootstrap-b-${suffix}@example.invalid`],
    )).rows[0]?.id;
    const identityC = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      [`ci-bootstrap:${suffix}:c`, "CI Bootstrap Unauthorized Target", `ci-bootstrap-c-${suffix}@example.invalid`],
    )).rows[0]?.id;
    assert.ok(identityA && identityB && identityC);
    assert.notEqual(identityA, identityB);

    const ceremonyId = randomUUID();
    const secretA = randomBytes(32).toString("base64url");
    const secretB = randomBytes(32).toString("base64url");
    await pool.query(
      "insert into bootstrap_private.bootstrap_ceremonies(id,expires_at) values($1,now()+interval '30 minutes')",
      [ceremonyId],
    );
    await pool.query(
      `insert into bootstrap_private.bootstrap_claims(ceremony_id,identity_id,custodian_role_name,secret_hash,expires_at)
       values($1,$2,$3,$4,now()+interval '30 minutes'),($1,$5,$6,$7,now()+interval '30 minutes')`,
      [ceremonyId, identityA, custodianA, sha256(secretA), identityB, custodianB, sha256(secretB)],
    );

    await assert.rejects(
      withCustodian(pool, custodianA, client => client.query(
        "select bootstrap_private.submit_initial_platform_authority_claim($1,$2)",
        [ceremonyId, randomBytes(32).toString("base64url")],
      )),
      /BOOTSTRAP_CLAIM_INVALID/,
      "incorrect secret must fail closed",
    );
    await assert.rejects(
      withCustodian(pool, custodianA, client => client.query(
        "select bootstrap_private.submit_initial_platform_authority_claim($1,$2)",
        [ceremonyId, secretB],
      )),
      /BOOTSTRAP_CLAIM_INVALID/,
      "custodian A must not be able to submit custodian B's claim",
    );

    const acceptedA = await withCustodian(pool, custodianA, client => client.query<{ submit_initial_platform_authority_claim: { status: string } }>(
      "select bootstrap_private.submit_initial_platform_authority_claim($1,$2)",
      [ceremonyId, secretA],
    ));
    assert.equal(acceptedA.rows[0]?.submit_initial_platform_authority_claim?.status, "CLAIM_ACCEPTED");
    await assert.rejects(
      withCustodian(pool, custodianA, client => client.query(
        "select bootstrap_private.submit_initial_platform_authority_claim($1,$2)",
        [ceremonyId, secretA],
      )),
      /BOOTSTRAP_CLAIM_INVALID/,
      "a submitted one-time claim must not be reusable",
    );
    const acceptedB = await withCustodian(pool, custodianB, client => client.query<{ submit_initial_platform_authority_claim: { status: string } }>(
      "select bootstrap_private.submit_initial_platform_authority_claim($1,$2)",
      [ceremonyId, secretB],
    ));
    assert.equal(acceptedB.rows[0]?.submit_initial_platform_authority_claim?.status, "CLAIM_ACCEPTED");

    const finalizers = await Promise.allSettled([
      withCustodian(pool, custodianA, client => client.query<{ finalize_initial_platform_authority_bootstrap: { status: string; organizationId: string; auditEventHash: string } }>(
        "select bootstrap_private.finalize_initial_platform_authority_bootstrap($1)",
        [ceremonyId],
      )),
      withCustodian(pool, custodianB, client => client.query(
        "select bootstrap_private.finalize_initial_platform_authority_bootstrap($1)",
        [ceremonyId],
      )),
    ]);
    assert.equal(finalizers.filter(result => result.status === "fulfilled").length, 1,
      "concurrent finalizers must serialize to exactly one successful bootstrap");
    assert.equal(finalizers.filter(result => result.status === "rejected").length, 1);
    const successful = finalizers.find(result => result.status === "fulfilled");
    assert.ok(successful && successful.status === "fulfilled");
    const result = successful.value.rows[0]?.finalize_initial_platform_authority_bootstrap;
    assert.equal(result?.status, "BOOTSTRAPPED");
    assert.ok(result?.organizationId);
    assert.ok(result?.auditEventHash);

    const organization = await pool.query<{ organization_type: string; status: string; verification_status: string }>(
      "select organization_type,status,verification_status from organizations where id=$1",
      [result.organizationId],
    );
    assert.equal(organization.rows[0]?.organization_type, "PLATFORM_AUTHORITY");
    assert.equal(organization.rows[0]?.status, "VERIFIED");
    assert.equal(organization.rows[0]?.verification_status, "VERIFIED");

    const memberships = await pool.query<{ identity_id: string; role_name: string; status: string }>(
      `select om.identity_id,r.name as role_name,om.status
         from organization_memberships om join roles r on r.id=om.role_id
        where om.organization_id=$1 and r.name='super_admin'
        order by om.identity_id`,
      [result.organizationId],
    );
    assert.equal(memberships.rows.length, 2);
    assert.deepEqual(memberships.rows.map(row => row.identity_id).sort(), [identityA, identityB].sort());
    assert.ok(memberships.rows.every(row => row.role_name === "super_admin" && row.status === "VERIFIED"));

    const audit = await pool.query<{ event_hash: string; previous_hash: string | null; payload: unknown }>(
      "select event_hash,previous_hash,payload from bootstrap_private.bootstrap_audit_events where ceremony_id=$1",
      [ceremonyId],
    );
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0]?.event_hash, result.auditEventHash);
    const computedHash = await pool.query<{ event_hash: string }>(
      "select encode(public.digest(coalesce(previous_hash,'') || '|' || payload::text,'sha256'),'hex') as event_hash from bootstrap_private.bootstrap_audit_events where ceremony_id=$1",
      [ceremonyId],
    );
    assert.equal(audit.rows[0]?.event_hash, computedHash.rows[0]?.event_hash, "bootstrap audit event hash must be verifiable");
    await assert.rejects(
      pool.query("update bootstrap_private.bootstrap_audit_events set payload=payload where ceremony_id=$1", [ceremonyId]),
      /BOOTSTRAP_AUDIT_IMMUTABLE/,
      "bootstrap audit events must be append-only",
    );

    const privileges = await pool.query<{ runtime_execute: boolean; custodian_table_select: boolean; public_execute: boolean }>(
      `select
        has_function_privilege('rupaykg_auth_runtime','bootstrap_private.submit_initial_platform_authority_claim(uuid,text)','EXECUTE') as runtime_execute,
        has_table_privilege('rupaykg_bootstrap_custodian','bootstrap_private.bootstrap_claims','SELECT') as custodian_table_select,
        exists(
          select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
               lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
           where n.nspname='bootstrap_private'
             and p.proname='submit_initial_platform_authority_claim'
             and acl.grantee=0 and acl.privilege_type='EXECUTE'
        ) as public_execute`,
    );
    assert.equal(privileges.rows[0]?.runtime_execute, false);
    assert.equal(privileges.rows[0]?.custodian_table_select, false);
    assert.equal(privileges.rows[0]?.public_execute, false);

    const roleId = (await pool.query<{ id: string }>(
      "select r.id from roles r where r.organization_id=$1 and r.name='super_admin'",
      [result.organizationId],
    )).rows[0]?.id;
    assert.ok(roleId);
    await assert.rejects(
      pool.query(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
        [identityC, result.organizationId, roleId],
      ),
      /RESERVED_ROLE_REQUIRES_DUAL_CONTROL/,
      "the one-time bootstrap exception must not weaken subsequent reserved-role grants",
    );

    const secondCeremonyId = randomUUID();
    const secondSecret = randomBytes(32).toString("base64url");
    await pool.query(
      "insert into bootstrap_private.bootstrap_ceremonies(id,expires_at) values($1,now()+interval '30 minutes')",
      [secondCeremonyId],
    );
    await pool.query(
      "insert into bootstrap_private.bootstrap_claims(ceremony_id,identity_id,custodian_role_name,secret_hash,expires_at) values($1,$2,$3,$4,now()+interval '30 minutes')",
      [secondCeremonyId, identityA, custodianA, sha256(secondSecret)],
    );
    await assert.rejects(
      withCustodian(pool, custodianA, client => client.query(
        "select bootstrap_private.submit_initial_platform_authority_claim($1,$2)",
        [secondCeremonyId, secondSecret],
      )),
      /BOOTSTRAP_ALREADY_CONSUMED/,
      "global bootstrap must be one-time across all ceremonies",
    );

    process.stdout.write("CI two-custodian platform-authority bootstrap: PASS (synthetic identities/secrets only)\n");
  } finally {
    await pool.end();
  }
}

void run().catch(error => {
  process.stderr.write(`CI platform-authority bootstrap failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
