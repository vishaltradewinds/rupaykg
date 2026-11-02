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

    const expiredCeremonyId = randomUUID();
    const expiredSecret = randomBytes(32).toString("base64url");
    await pool.query(
      "insert into bootstrap_private.bootstrap_ceremonies(id,expires_at) values($1,now()-interval '1 minute')",
      [expiredCeremonyId],
    );
    await pool.query(
      "insert into bootstrap_private.bootstrap_claims(ceremony_id,identity_id,custodian_role_name,secret_hash,expires_at) values($1,$2,$3,$4,now()+interval '30 minutes')",
      [expiredCeremonyId, identityA, custodianA, sha256(expiredSecret)],
    );
    await assert.rejects(
      withCustodian(pool, custodianA, client => client.query(
        "select bootstrap_private.submit_initial_platform_authority_claim($1,$2)",
        [expiredCeremonyId, expiredSecret],
      )),
      /BOOTSTRAP_CLAIM_INVALID/,
      "an expired ceremony must not accept a valid secret",
    );

    const suspendedCeremonyId = randomUUID();
    const suspendedSecret = randomBytes(32).toString("base64url");
    await pool.query("update public.identities set suspended_at=now() where id=$1", [identityC]);
    await pool.query(
      "insert into bootstrap_private.bootstrap_ceremonies(id,expires_at) values($1,now()+interval '30 minutes')",
      [suspendedCeremonyId],
    );
    await pool.query(
      "insert into bootstrap_private.bootstrap_claims(ceremony_id,identity_id,custodian_role_name,secret_hash,expires_at) values($1,$2,$3,$4,now()+interval '30 minutes')",
      [suspendedCeremonyId, identityC, custodianA, sha256(suspendedSecret)],
    );
    await assert.rejects(
      withCustodian(pool, custodianA, client => client.query(
        "select bootstrap_private.submit_initial_platform_authority_claim($1,$2)",
        [suspendedCeremonyId, suspendedSecret],
      )),
      /BOOTSTRAP_IDENTITY_NOT_VERIFIED/,
      "a suspended identity must not submit a bootstrap claim",
    );
    await pool.query("update public.identities set suspended_at=null where id=$1", [identityC]);

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
    await assert.rejects(
      withCustodian(pool, custodianA, client => client.query(
        "select bootstrap_private.finalize_initial_platform_authority_bootstrap($1)",
        [ceremonyId],
      )),
      /BOOTSTRAP_REQUIRES_TWO_DISTINCT_CUSTODIANS/,
      "finalization must fail until both distinct custodian claims are submitted",
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

    // Exercise the identity-bound onboarding review functions against the same
    // disposable PostgreSQL database, after the synthetic authority bootstrap.
    const authorityToken = randomBytes(32).toString("base64url");
    const authorityTokenHash = sha256(authorityToken);
    await pool.query(
      "insert into public.identity_sessions(identity_id,token_hash,expires_at,request_context) values($1,$2,now()+interval '8 hours',$3::jsonb)",
      [identityA, authorityTokenHash, JSON.stringify({ provider: "ci-onboarding-review" })],
    );
    const unauthorizedToken = randomBytes(32).toString("base64url");
    const unauthorizedTokenHash = sha256(unauthorizedToken);
    await pool.query(
      "insert into public.identity_sessions(identity_id,token_hash,expires_at,request_context) values($1,$2,now()+interval '8 hours',$3::jsonb)",
      [identityC, unauthorizedTokenHash, JSON.stringify({ provider: "ci-onboarding-review" })],
    );

    const onboardingOwnerPrivileges = await pool.query<{ statutory_profile_insert: boolean; statutory_profile_conflict_select: boolean; approval_update: boolean; evidence_update: boolean }>(
      `select
         has_table_privilege('rupaykg_auth_owner','public.organization_statutory_profiles','INSERT') as statutory_profile_insert,
         has_column_privilege('rupaykg_auth_owner','public.organization_statutory_profiles','organization_id','SELECT') as statutory_profile_conflict_select,
         has_table_privilege('rupaykg_auth_owner','public.stakeholder_application_approvals','UPDATE') as approval_update,
         has_table_privilege('rupaykg_auth_owner','public.organization_verification_evidence','UPDATE') as evidence_update`,
    );
    assert.equal(onboardingOwnerPrivileges.rows[0]?.statutory_profile_insert, true,
      "auth function owner must be able to seed the organization governance profile trigger");
    assert.equal(onboardingOwnerPrivileges.rows[0]?.statutory_profile_conflict_select, true,
      "auth function owner must be able to resolve the governance-profile conflict key");
    assert.equal(onboardingOwnerPrivileges.rows[0]?.approval_update, true);
    assert.equal(onboardingOwnerPrivileges.rows[0]?.evidence_update, true);

    const onboardingFunctionOwners = await pool.query<{ function_name: string; owner_name: string; security_definer: boolean; governance_trigger_definer: boolean; governance_trigger_owner: string }>(
      `select p.proname as function_name,pg_get_userbyid(p.proowner) as owner_name,
              p.prosecdef as security_definer,
              (select gp.prosecdef from pg_proc gp join pg_namespace gn on gn.oid=gp.pronamespace
                where gn.nspname='public' and gp.proname='ensure_organization_governance_profile'
                limit 1) as governance_trigger_definer,
              (select pg_get_userbyid(gp.proowner) from pg_proc gp join pg_namespace gn on gn.oid=gp.pronamespace
                where gn.nspname='public' and gp.proname='ensure_organization_governance_profile'
                limit 1) as governance_trigger_owner
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='auth_private' and p.proname='create_stakeholder_application'`,
    );
    assert.equal(onboardingFunctionOwners.rows[0]?.owner_name, "rupaykg_auth_owner");
    assert.equal(onboardingFunctionOwners.rows[0]?.security_definer, true);
    assert.equal(onboardingFunctionOwners.rows[0]?.governance_trigger_definer, true);
    assert.equal(onboardingFunctionOwners.rows[0]?.governance_trigger_owner, "rupaykg_auth_owner",
      "governance trigger must execute only with the least-privilege auth function owner");

    const applicantIdentity = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
      [`ci-onboarding-applicant:${suffix}`, "CI Onboarding Applicant", `ci-onboarding-applicant-${suffix}@example.invalid`],
    )).rows[0]?.id;
    assert.ok(applicantIdentity);
    const applicantToken = randomBytes(32).toString("base64url");
    const applicantTokenHash = sha256(applicantToken);
    await pool.query(
      "insert into public.identity_sessions(identity_id,token_hash,expires_at,request_context) values($1,$2,now()+interval '8 hours',$3::jsonb)",
      [applicantIdentity, applicantTokenHash, JSON.stringify({ provider: "ci-onboarding-review" })],
    );
    const createdApplication = await pool.query<{ application_result: { application: { id: string }; organization_id: string } }>(
      `select auth_private.create_stakeholder_application(
        $1,$2,$3,$4,$5,$6,$7,$8::uuid,$9,$10,$11,$12,$13,$14::timestamptz,$15::timestamptz
      ) as application_result`,
      [
        applicantTokenHash, "CI Synthetic Recycler", "processor",
        "CI Synthetic Recycler Private Limited", "Private Limited",
        `CIN-CI-${suffix}`, "MCA", null, "Synthetic integration fixture",
        "INCORPORATION_CERTIFICATE", `evidence://ci/${suffix}`, "a".repeat(64),
        "CI Test Issuer", null, null,
      ],
    );
    const applicationId = createdApplication.rows[0]?.application_result.application.id;
    const applicantOrganizationId = createdApplication.rows[0]?.application_result.organization_id;
    assert.ok(applicationId && applicantOrganizationId);

    const queue = await pool.query<{ queue_result: { applications: Array<{ id: string; canReview: boolean; canVerifyLegal: boolean }> } }>(
      "select auth_private.get_onboarding_review_queue($1) as queue_result",
      [authorityTokenHash],
    );
    const queuedApplication = queue.rows[0]?.queue_result.applications.find(row => row.id === applicationId);
    assert.ok(queuedApplication, "verified platform authority must see its pending legal-review application");
    assert.equal(queuedApplication.canReview, true);
    assert.equal(queuedApplication.canVerifyLegal, true);

    await assert.rejects(
      pool.query(
        "select auth_private.verify_stakeholder_legal($1,$2,$3,$4)",
        [unauthorizedTokenHash, applicationId, "VERIFIED", "Unauthorized test attempt"],
      ),
      /ONBOARDING_AUTHORITY_FORBIDDEN/,
      "an identity without platform authority must not verify legal evidence",
    );
    await assert.rejects(
      pool.query("select auth_private.get_onboarding_review_queue($1)", ["f".repeat(64)]),
      /AUTH_REQUIRED/,
      "an unknown session token must not read the review queue",
    );

    const legalResult = await pool.query<{ verification_result: { status: string; organizationId: string } }>(
      "select auth_private.verify_stakeholder_legal($1,$2,$3,$4) as verification_result",
      [authorityTokenHash, applicationId, "VERIFIED", "CI evidence hash and reference verified"],
    );
    assert.equal(legalResult.rows[0]?.verification_result.status, "VERIFIED");
    assert.equal(legalResult.rows[0]?.verification_result.organizationId, applicantOrganizationId);

    const approvalResult = await pool.query<{ decision_result: { status: string; approvalLevel: string } }>(
      "select auth_private.review_stakeholder_application($1,$2,$3,$4) as decision_result",
      [authorityTokenHash, applicationId, "approve", "CI platform approval"],
    );
    assert.equal(approvalResult.rows[0]?.decision_result.status, "APPROVED");
    assert.equal(approvalResult.rows[0]?.decision_result.approvalLevel, "PLATFORM");
    const activated = await pool.query<{ application_status: string; membership_status: string; organization_status: string }>(
      `select sa.status as application_status,om.status as membership_status,o.status as organization_status
         from stakeholder_applications sa
         join organization_memberships om on om.organization_id=sa.organization_id and om.identity_id=sa.identity_id
         join organizations o on o.id=sa.organization_id
        where sa.id=$1`,
      [applicationId],
    );
    assert.equal(activated.rows[0]?.application_status, "APPROVED");
    assert.equal(activated.rows[0]?.membership_status, "VERIFIED");
    assert.equal(activated.rows[0]?.organization_status, "VERIFIED");

    const selfApplication = await pool.query<{ application_result: { application: { id: string } } }>(
      `select auth_private.create_stakeholder_application(
        $1,$2,$3,$4,$5,$6,$7,$8::uuid,$9,$10,$11,$12,$13,$14::timestamptz,$15::timestamptz
      ) as application_result`,
      [
        authorityTokenHash, "CI Authority Self-Approval Attempt", "processor",
        "CI Authority Self-Approval Attempt Ltd", "Private Limited",
        `CIN-SELF-${suffix}`, "MCA", null, "Self-approval negative test",
        "INCORPORATION_CERTIFICATE", `evidence://ci/self/${suffix}`, "b".repeat(64),
        "CI Test Issuer", null, null,
      ],
    );
    await assert.rejects(
      pool.query(
        "select auth_private.review_stakeholder_application($1,$2,$3,$4)",
        [authorityTokenHash, selfApplication.rows[0]?.application_result.application.id, "approve", "Must not self approve"],
      ),
      /STAKEHOLDER_SELF_APPROVAL_FORBIDDEN/,
      "an applicant must not approve their own application even with platform authority",
    );

    const deniedApplication = await pool.query<{ application_result: { application: { id: string } } }>(
      `select auth_private.create_stakeholder_application(
        $1,$2,$3,$4,$5,$6,$7,$8::uuid,$9,$10,$11,$12,$13,$14::timestamptz,$15::timestamptz
      ) as application_result`,
      [
        applicantTokenHash, "CI Unauthorized Review Attempt", "processor",
        "CI Unauthorized Review Attempt Ltd", "Private Limited",
        `CIN-DENIED-${suffix}`, "MCA", null, "Unauthorized reviewer negative test",
        "INCORPORATION_CERTIFICATE", `evidence://ci/denied/${suffix}`, "c".repeat(64),
        "CI Test Issuer", null, null,
      ],
    );
    await assert.rejects(
      pool.query(
        "select auth_private.review_stakeholder_application($1,$2,$3,$4)",
        [unauthorizedTokenHash, deniedApplication.rows[0]?.application_result.application.id, "approve", "Unauthorized review"],
      ),
      /ONBOARDING_AUTHORITY_FORBIDDEN/,
      "an identity without the required hierarchy role must not approve an application",
    );

    const revokedToken = randomBytes(32).toString("base64url");
    const revokedHash = sha256(revokedToken);
    await pool.query(
      "insert into public.identity_sessions(identity_id,token_hash,expires_at,request_context) values($1,$2,now()+interval '8 hours',$3::jsonb)",
      [identityC, revokedHash, JSON.stringify({ provider: "ci-onboarding-review" })],
    );
    await pool.query("select auth_private.revoke_session($1)", [revokedHash]);
    await assert.rejects(
      pool.query("select auth_private.get_onboarding_review_queue($1)", [revokedHash]),
      /AUTH_REQUIRED/,
      "a revoked session must not read the review queue",
    );

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
