import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import { Pool, type PoolClient } from "pg";
import { registerEvidenceVaultRoutes } from "./evidence-vault-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("evidence vault enforces tenant scope, versioned storage, integrity and independent review", { skip: !enabled }, async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = Fastify({ logger: false });
  let apiProofClient: PoolClient | null = null;
  let apiProofRoleCreated = false;
  await registerEvidenceVaultRoutes(app, pool);
  // Rehearse the forward-only migration against a production-like catalog:
  // snapshot columns already exist and both historical trigger names are present.
  const migrationCandidates = [
    path.resolve(process.cwd(), "migrations/20261104_verification_authorization_tenant_binding.sql"),
    path.resolve(process.cwd(), "../migrations/20261104_verification_authorization_tenant_binding.sql"),
  ];
  const migrationPath = migrationCandidates.find(candidate => existsSync(candidate));
  assert.ok(migrationPath, "verification authorization migration must be available to the integration test");
  const migrationSql = await readFile(migrationPath, "utf8");
  await pool.query("drop trigger if exists verification_authorization_guard on public.verifications");
  await pool.query(`create or replace function public.test_legacy_verification_independence()
    returns trigger language plpgsql as $body$ begin return new; end $body$`);
  await pool.query("create trigger verification_independence_guard before insert on public.verifications for each row execute function public.test_legacy_verification_independence()");
  await pool.query("create trigger verifications_integrity_guard before insert or update on public.verifications for each row execute function public.prevent_invalid_verification()");
  await pool.query(migrationSql);
  const remainingVerificationTriggers = await pool.query<{ tgname: string }>(
    "select tgname from pg_trigger where tgrelid='public.verifications'::regclass and not tgisinternal order by tgname",
  );
  assert.deepEqual(remainingVerificationTriggers.rows.map(row => row.tgname), ["verification_authorization_guard"]);
  await pool.query("drop function public.test_legacy_verification_independence()");
  const suffix = randomBytes(8).toString("hex");
  const uploaderToken = randomBytes(32).toString("base64url");
  const reviewerToken = randomBytes(32).toString("base64url");
  const outsiderToken = randomBytes(32).toString("base64url");
  const crossOrgReviewerToken = randomBytes(32).toString("base64url");
  try {
    const org = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-EVIDENCE-" + suffix],
    );
    const organizationId = org.rows[0]!.id;
    const otherOrg = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-EVIDENCE-OUTSIDER-" + suffix],
    );
    const geography = await pool.query<{ id: string }>(
      "insert into geography(kind,name,source,source_version) values('STATE_UT',$1,'integration-test','fixture-v1') returning id",
      ["TEST-EVIDENCE-GEO-" + suffix],
    );
    const activity = await pool.query<{ id: string }>(
      "insert into activities(organization_id,geography_id,activity_type,status) values($1,$2,'WASTE_WEIGHT_MEASUREMENT','COMPLETED') returning id",
      [organizationId, geography.rows[0]!.id],
    );
    await pool.query("insert into organization_geography_scopes(organization_id,geography_id) values($1,$3),($2,$3)", [organizationId, otherOrg.rows[0]!.id, geography.rows[0]!.id]);
    const identities = await Promise.all([
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["test-evidence-uploader:"+suffix,"Evidence Uploader","uploader-"+suffix+"@example.invalid"]),
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["test-evidence-reviewer:"+suffix,"Evidence Reviewer","reviewer-"+suffix+"@example.invalid"]),
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["test-evidence-outsider:"+suffix,"Evidence Outsider","outsider-"+suffix+"@example.invalid"]),
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["test-evidence-cross-org-reviewer:"+suffix,"Cross Org Reviewer","cross-reviewer-"+suffix+"@example.invalid"]),
    ]);
    const uploaderId = identities[0].rows[0]!.id;
    const reviewerId = identities[1].rows[0]!.id;
    const outsiderId = identities[2].rows[0]!.id;
    const crossOrgReviewerId = identities[3].rows[0]!.id;
    const roles = await Promise.all([
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'evidence_uploader_test',$2::jsonb,'[]') returning id",[organizationId,JSON.stringify(["evidence:upload","evidence:read"])]),
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'evidence_reviewer_test',$2::jsonb,'[]') returning id",[organizationId,JSON.stringify(["evidence:read","evidence:review","VERIFY_EVIDENCE"])]),
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'evidence_outsider_test',$2::jsonb,'[]') returning id",[otherOrg.rows[0]!.id,JSON.stringify(["evidence:read","evidence:upload"])]),
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'cross_org_review_test',$2::jsonb,'[]') returning id",[organizationId,JSON.stringify(["evidence:review"])]),
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'cross_org_verifier_test',$2::jsonb,'[]') returning id",[otherOrg.rows[0]!.id,JSON.stringify(["VERIFY_EVIDENCE"])]),
    ]);
    await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    try {
      await pool.query(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$5,'VERIFIED'),($6,$7,$8,'VERIFIED'),($9,$2,$10,'VERIFIED'),($9,$7,$11,'VERIFIED'),($9,$2,$11,'VERIFIED')",
        [uploaderId,organizationId,roles[0].rows[0]!.id,reviewerId,roles[1].rows[0]!.id,outsiderId,otherOrg.rows[0]!.id,roles[2].rows[0]!.id,crossOrgReviewerId,roles[3].rows[0]!.id,roles[4].rows[0]!.id],
      );
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }
    await pool.query(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4),($5,now()+interval '1 hour',$6),($7,now()+interval '1 hour',$8)",
      [uploaderId,hash(uploaderToken),reviewerId,hash(reviewerToken),outsiderId,hash(outsiderToken),crossOrgReviewerId,hash(crossOrgReviewerToken)],
    );

    // Prove the candidate trigger on the complete migrated RupayKg schema,
    // using a non-owner API role with INSERT only. This role exists only in
    // the disposable integration database and is removed in the test cleanup.
    await pool.query("drop role if exists rupaykg_api_verification_proof");
    await pool.query("create role rupaykg_api_verification_proof nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls");
    apiProofRoleCreated = true;
    await pool.query("grant usage on schema public to rupaykg_api_verification_proof");
    await pool.query("grant insert on public.verifications to rupaykg_api_verification_proof");

    const apiProofEvidence = (await pool.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'FIELD','UNDER_REVIEW',now(),$2) returning id",
      [activity.rows[0]!.id, "actual-schema-guard-role-" + suffix],
    )).rows[0]!.id;

    const guardCatalog = await pool.query<{
      rolcanlogin: boolean; rolsuper: boolean; rolbypassrls: boolean;
      owns_protected_table: boolean; has_broad_update: boolean;
      has_id_lock_columns: boolean; is_member: boolean;
      owns_guard_functions: boolean; migrator_membership_safe: boolean;
    }>(
      `select r.rolcanlogin, r.rolsuper, r.rolbypassrls,
        exists (
          select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='public' and c.relkind in ('r','p')
             and c.relowner=r.oid
             and c.relname in ('evidence','activities','organizations','organization_memberships','roles','identities','verifications')
        ) as owns_protected_table,
        has_table_privilege(r.oid,'public.evidence','UPDATE')
          or has_table_privilege(r.oid,'public.activities','UPDATE')
          or has_table_privilege(r.oid,'public.organization_memberships','UPDATE')
          or has_table_privilege(r.oid,'public.roles','UPDATE')
          or has_table_privilege(r.oid,'public.identities','UPDATE')
          or has_table_privilege(r.oid,'public.organizations','UPDATE') as has_broad_update,
        has_column_privilege(r.oid,'public.evidence','id','UPDATE')
          and has_column_privilege(r.oid,'public.activities','id','UPDATE')
          and has_column_privilege(r.oid,'public.organization_memberships','id','UPDATE')
          and has_column_privilege(r.oid,'public.roles','id','UPDATE')
          and has_column_privilege(r.oid,'public.identities','id','UPDATE')
          and has_column_privilege(r.oid,'public.organizations','id','UPDATE') as has_id_lock_columns,
        pg_has_role('rupaykg_api_verification_proof','rupaykg_verification_guard','MEMBER') as is_member,
        exists (
          select 1 from pg_proc p
           where p.pronamespace='public'::regnamespace
             and p.proname in ('enforce_verification_authorization','lock_organization_for_geography_scope_change')
             and p.proowner=r.oid
          group by p.proowner having count(*)=2
        ) as owns_guard_functions,
        exists (
          select 1 from pg_auth_members m
           where m.roleid=r.oid
             and m.member=(select oid from pg_roles where rolname=current_user)
             and not m.set_option
        )
        and not exists (
          select 1 from pg_auth_members m
           where m.roleid=r.oid
             and m.member<>(select oid from pg_roles where rolname=current_user)
        ) as migrator_membership_safe
       from pg_roles r where r.rolname='rupaykg_verification_guard'`,
    );
    assert.equal(guardCatalog.rows[0]?.rolcanlogin, false);
    assert.equal(guardCatalog.rows[0]?.rolsuper, false);
    assert.equal(guardCatalog.rows[0]?.rolbypassrls, false);
    assert.equal(guardCatalog.rows[0]?.owns_protected_table, false);
    assert.equal(guardCatalog.rows[0]?.has_broad_update, false);
    assert.equal(guardCatalog.rows[0]?.has_id_lock_columns, true);
    assert.equal(guardCatalog.rows[0]?.is_member, false);
    assert.equal(guardCatalog.rows[0]?.owns_guard_functions, true);
    assert.equal(guardCatalog.rows[0]?.migrator_membership_safe, true);
    assert.equal(await pool.query("select has_table_privilege('rupaykg_api_verification_proof','public.verifications','INSERT') as ok").then(r => r.rows[0]?.ok), true);
    assert.equal(await pool.query("select has_table_privilege('rupaykg_api_verification_proof','public.evidence','SELECT') as ok").then(r => r.rows[0]?.ok), false);
    assert.equal(await pool.query("select has_table_privilege('rupaykg_api_verification_proof','public.verifications','UPDATE') as ok").then(r => r.rows[0]?.ok), false);
    assert.equal(await pool.query("select has_table_privilege('rupaykg_api_verification_proof','public.verifications','DELETE') as ok").then(r => r.rows[0]?.ok), false);
    assert.equal(await pool.query("select has_table_privilege('rupaykg_api_verification_proof','public.verifications','TRUNCATE') as ok").then(r => r.rows[0]?.ok), false);

    apiProofClient = await pool.connect();
    await apiProofClient.query("begin");
    await apiProofClient.query("set local role rupaykg_api_verification_proof");
    await apiProofClient.query(
      "insert into public.verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'REJECTED','ACTUAL_SCHEMA_GUARD_ROLE_PROOF','non-owner API role trigger proof')",
      [apiProofEvidence, activity.rows[0]!.id, reviewerId],
    );
    await apiProofClient.query("commit");
    const actualSchemaSnapshot = await pool.query<{
      authorization_membership_id: string; authorization_role_id: string;
      authorization_permissions_snapshot: string[]; authorization_checked_at: Date;
    }>(
      "select authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at from verifications where evidence_id=$1 and decision='REJECTED'",
      [apiProofEvidence],
    );
    assert.ok(actualSchemaSnapshot.rows[0]?.authorization_membership_id);
    assert.ok(actualSchemaSnapshot.rows[0]?.authorization_role_id);
    assert.ok(actualSchemaSnapshot.rows[0]?.authorization_checked_at);
    assert.ok(actualSchemaSnapshot.rows[0]?.authorization_permissions_snapshot.includes("VERIFY_EVIDENCE"));

    for (const forbiddenSql of [
      "select id from public.evidence limit 1",
      "update public.verifications set rationale='api mutation attempt'",
      "delete from public.verifications",
      "truncate public.verifications",
    ]) {
      await apiProofClient.query("begin");
      await apiProofClient.query("set local role rupaykg_api_verification_proof");
      await assert.rejects(apiProofClient.query(forbiddenSql), /permission denied/);
      await apiProofClient.query("rollback");
    }
    apiProofClient.release();
    apiProofClient = null;
    const headers = (token: string, orgId = organizationId) => ({ authorization: "Bearer " + token, "x-rupaykg-organization-id": orgId });
    const bytes = Buffer.from("%PDF-1.7\nMRV evidence fixture\n");
    const upload = await app.inject({
      method: "POST", url: "/api/v1/evidence-vault/upload", headers: headers(uploaderToken),
      payload: { activityId: activity.rows[0]!.id, evidenceType: "WASTE_WEIGHT_TICKET", fileName: "weight-ticket.pdf", mediaType: "application/pdf", contentBase64: bytes.toString("base64"), sourceReference: "TEST-SLIP-"+suffix, measurementPeriodStart: "2026-10-01", measurementPeriodEnd: "2026-10-31" },
    });
    assert.equal(upload.statusCode, 201, upload.body);
    const uploaded = upload.json().data as { evidenceId: string; seriesId: string; artifactVersionId: string; versionNumber: number; sha256: string };
    assert.equal(uploaded.versionNumber, 1);
    assert.equal(uploaded.sha256, createHash("sha256").update(bytes).digest("hex"));

    const secondBytes = Buffer.from("%PDF-1.7\\nCorrected MRV evidence fixture\\n");
    const secondUpload = await app.inject({
      method: "POST", url: "/api/v1/evidence-vault/upload", headers: headers(uploaderToken),
      payload: { activityId: activity.rows[0]!.id, seriesId: uploaded.seriesId, evidenceType: "WASTE_WEIGHT_TICKET", fileName: "weight-ticket-corrected.pdf", mediaType: "application/pdf", contentBase64: secondBytes.toString("base64"), sourceReference: "TEST-SLIP-CORRECTED-"+suffix, measurementPeriodStart: "2026-10-01", measurementPeriodEnd: "2026-10-31" },
    });
    assert.equal(secondUpload.statusCode, 201, secondUpload.body);
    const second = secondUpload.json().data as { evidenceId: string; versionNumber: number };
    assert.equal(second.versionNumber, 2);

    const list = await app.inject({ method: "GET", url: "/api/v1/evidence-vault?activityId="+activity.rows[0]!.id, headers: headers(uploaderToken) });
    assert.equal(list.statusCode, 200, list.body);
    assert.equal(list.json().data.artifacts.length, 2);
    assert.ok(list.json().data.artifacts.some((item: {evidence_id:string}) => item.evidence_id===uploaded.evidenceId));
    assert.ok(list.json().data.artifacts.some((item: {evidence_id:string;version_number:number}) => item.evidence_id===second.evidenceId&&item.version_number===2));

    const download = await app.inject({ method: "GET", url: "/api/v1/evidence-vault/"+uploaded.evidenceId, headers: headers(uploaderToken) });
    assert.equal(download.statusCode, 200, download.body);
    assert.deepEqual(download.rawPayload, bytes);
    assert.equal(download.headers["x-evidence-sha256"], uploaded.sha256);

    const selfReview = await app.inject({ method: "POST", url: "/api/v1/evidence-vault/"+uploaded.evidenceId+"/review", headers: headers(uploaderToken), payload: { decision: "APPROVED", rationale: "Self review must be blocked" } });
    assert.equal(selfReview.statusCode, 403, selfReview.body);

    const outsiderRead = await app.inject({ method: "GET", url: "/api/v1/evidence-vault?activityId="+activity.rows[0]!.id, headers: headers(outsiderToken, otherOrg.rows[0]!.id) });
    assert.equal(outsiderRead.statusCode, 403, outsiderRead.body);

    const crossOrgDirectInsert = pool.query(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'REJECTED','EVIDENCE_VAULT','Cross-org negative fixture')",
      [second.evidenceId, activity.rows[0]!.id, crossOrgReviewerId],
    );
    await assert.rejects(crossOrgDirectInsert, /verification requires active explicit verifier permission in the activity organization/);

    // The database guard must also reject direct inserts for activities with
    // no geography, even when the verifier has same-organization permission.
    const unscopedActivity = await pool.query<{ id: string }>(
      "insert into activities(organization_id,activity_type,status) values($1,'TEST_UNSCOPED_VERIFICATION','COMPLETED') returning id",
      [organizationId],
    );
    const unscopedEvidence = await pool.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'FIELD','UNDER_REVIEW',now(),$2) returning id",
      [unscopedActivity.rows[0]!.id, "unscoped-verification-"+suffix],
    );
    await assert.rejects(
      pool.query(
        "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'REJECTED','UNSCOPED_GEOGRAPHY')",
        [unscopedEvidence.rows[0]!.id, unscopedActivity.rows[0]!.id, reviewerId],
      ),
      /verification requires an activity within an authorized organization geography/,
    );

    const crossOrgReview = await app.inject({ method: "POST", url: "/api/v1/evidence-vault/"+second.evidenceId+"/review", headers: headers(crossOrgReviewerToken), payload: { decision: "REJECTED", rationale: "Cross-organization review must be denied" } });
    assert.equal(crossOrgReview.statusCode, 403, crossOrgReview.body);

    const reviewerDecision = await app.inject({ method: "POST", url: "/api/v1/evidence-vault/"+uploaded.evidenceId+"/review", headers: headers(reviewerToken), payload: { decision: "APPROVED", rationale: "Checked against the cited source record" } });
    assert.equal(reviewerDecision.statusCode, 200, reviewerDecision.body);
    assert.equal(reviewerDecision.json().data.status, "VERIFIED");
    const snapshot = await pool.query<{ authorization_membership_id: string; authorization_role_id: string; authorization_permissions_snapshot: string[]; authorization_checked_at: Date }>(
      "select authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at from verifications where evidence_id=$1 and decision='APPROVED'",
      [uploaded.evidenceId],
    );
    assert.ok(snapshot.rows[0]?.authorization_membership_id);
    assert.ok(snapshot.rows[0]?.authorization_role_id);
    assert.ok(snapshot.rows[0]?.authorization_checked_at);
    assert.ok(snapshot.rows[0]?.authorization_permissions_snapshot.includes("VERIFY_EVIDENCE"));
    await assert.rejects(
      pool.query("update verifications set rationale='attempted provenance rewrite' where evidence_id=$1", [uploaded.evidenceId]),
      /verification records are immutable/,
    );
    // Two-session race: a permission revocation that obtains the role-row
    // lock first must serialize before a verification decision.
    const revoker = await pool.connect();
    const verifier = await pool.connect();
    let revocationCommitted = false;
    try {
      await revoker.query("begin");
      await revoker.query("update roles set permissions=$2::jsonb where id=$1", [roles[1].rows[0]!.id, JSON.stringify(["evidence:read", "evidence:review"])]);
      const verifierPid = (await verifier.query<{ pid: number }>("select pg_backend_pid() pid")).rows[0]!.pid;
      const pendingDecision = verifier.query(
        "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'REJECTED','EVIDENCE_VAULT','Concurrent revocation fixture')",
        [second.evidenceId, activity.rows[0]!.id, reviewerId],
      ).then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
      let blockedOnLock = false;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const wait = await pool.query<{ wait_event_type: string | null }>("select wait_event_type from pg_stat_activity where pid=$1", [verifierPid]);
        if (wait.rows[0]?.wait_event_type === "Lock") { blockedOnLock = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(blockedOnLock, true, "verification insert must wait for the in-flight role permission update");
      await revoker.query("commit");
      revocationCommitted = true;
      const raced = await pendingDecision;
      assert.equal(raced.ok, false, "verification must fail after role permission revocation commits");
      if (!raced.ok) assert.match(raced.error instanceof Error ? raced.error.message : String(raced.error), /verification requires active explicit verifier permission in the activity organization/);
      await verifier.query("rollback").catch(() => undefined);
    } finally {
      if (!revocationCommitted) await revoker.query("rollback").catch(() => undefined);
      await verifier.query("rollback").catch(() => undefined);
      revoker.release();
      verifier.release();
      await pool.query("update roles set permissions=$2::jsonb where id=$1", [roles[1].rows[0]!.id, JSON.stringify(["evidence:read", "evidence:review", "VERIFY_EVIDENCE"])]);
    }
    // Membership deactivation race: the verification transaction must wait
    // for a concurrent membership status change and then fail closed.
    const membershipRaceIdentity = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,status) values($1,'Membership Race Verifier','VERIFIED') returning id",
      ["test-membership-race:"+suffix],
    )).rows[0]!.id;
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [membershipRaceIdentity, organizationId, roles[1].rows[0]!.id]);
    const membershipRaceEvidence = (await pool.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'FIELD','UNDER_REVIEW',now(),$2) returning id",
      [activity.rows[0]!.id, "membership-race-"+suffix],
    )).rows[0]!.id;
    const membershipRevoker = await pool.connect();
    const membershipVerifier = await pool.connect();
    let membershipChangeCommitted = false;
    try {
      await membershipRevoker.query("begin");
      await membershipRevoker.query("update organization_memberships set status='PENDING' where identity_id=$1 and organization_id=$2 and role_id=$3", [membershipRaceIdentity, organizationId, roles[1].rows[0]!.id]);
      const pid = (await membershipVerifier.query<{ pid: number }>("select pg_backend_pid() pid")).rows[0]!.pid;
      const pending = membershipVerifier.query(
        "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'REJECTED','MEMBERSHIP_RACE')",
        [membershipRaceEvidence, activity.rows[0]!.id, membershipRaceIdentity],
      ).then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
      let blocked = false;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const wait = await pool.query<{ wait_event_type: string | null }>("select wait_event_type from pg_stat_activity where pid=$1", [pid]);
        if (wait.rows[0]?.wait_event_type === "Lock") { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(blocked, true, "verification insert must wait for membership status update");
      await membershipRevoker.query("commit");
      membershipChangeCommitted = true;
      const result = await pending;
      assert.equal(result.ok, false, "verification must fail after membership deactivation commits");
      if (!result.ok) assert.match(result.error instanceof Error ? result.error.message : String(result.error), /verification requires active explicit verifier permission/);
      await membershipVerifier.query("rollback").catch(() => undefined);
    } finally {
      if (!membershipChangeCommitted) await membershipRevoker.query("rollback").catch(() => undefined);
      await membershipVerifier.query("rollback").catch(() => undefined);
      membershipRevoker.release();
      membershipVerifier.release();
    }

    // Identity suspension race: a decision cannot commit using an identity
    // whose suspension commits while authorization is waiting on its row lock.
    const suspensionRaceIdentity = (await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,status) values($1,'Suspension Race Verifier','VERIFIED') returning id",
      ["test-suspension-race:"+suffix],
    )).rows[0]!.id;
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [suspensionRaceIdentity, organizationId, roles[1].rows[0]!.id]);
    const suspensionRaceEvidence = (await pool.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'FIELD','UNDER_REVIEW',now(),$2) returning id",
      [activity.rows[0]!.id, "suspension-race-"+suffix],
    )).rows[0]!.id;
    const suspender = await pool.connect();
    const suspensionVerifier = await pool.connect();
    let suspensionCommitted = false;
    try {
      await suspender.query("begin");
      await suspender.query("update identities set suspended_at=now() where id=$1", [suspensionRaceIdentity]);
      const pid = (await suspensionVerifier.query<{ pid: number }>("select pg_backend_pid() pid")).rows[0]!.pid;
      const pending = suspensionVerifier.query(
        "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'REJECTED','SUSPENSION_RACE')",
        [suspensionRaceEvidence, activity.rows[0]!.id, suspensionRaceIdentity],
      ).then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
      let blocked = false;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const wait = await pool.query<{ wait_event_type: string | null }>("select wait_event_type from pg_stat_activity where pid=$1", [pid]);
        if (wait.rows[0]?.wait_event_type === "Lock") { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(blocked, true, "verification insert must wait for identity suspension update");
      await suspender.query("commit");
      suspensionCommitted = true;
      const result = await pending;
      assert.equal(result.ok, false, "verification must fail after identity suspension commits");
      if (!result.ok) assert.match(result.error instanceof Error ? result.error.message : String(result.error), /verification requires active explicit verifier permission/);
      await suspensionVerifier.query("rollback").catch(() => undefined);
    } finally {
      if (!suspensionCommitted) await suspender.query("rollback").catch(() => undefined);
      await suspensionVerifier.query("rollback").catch(() => undefined);
      suspender.release();
      suspensionVerifier.release();
    }

    // Organization-status race: a decision must wait for a concurrent
    // organization status change, then reject the now-unverified tenant.
    const organizationRaceEvidence = (await pool.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'FIELD','UNDER_REVIEW',now(),$2) returning id",
      [activity.rows[0]!.id, "organization-status-race-" + suffix],
    )).rows[0]!.id;
    const organizationChanger = await pool.connect();
    const organizationVerifier = await pool.connect();
    let organizationChangeCommitted = false;
    try {
      await organizationChanger.query("begin");
      await organizationChanger.query("update organizations set status='PENDING' where id=$1", [organizationId]);
      const pid = (await organizationVerifier.query<{ pid: number }>("select pg_backend_pid() pid")).rows[0]!.pid;
      const pending = organizationVerifier.query(
        "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'REJECTED','ORGANIZATION_STATUS_RACE')",
        [organizationRaceEvidence, activity.rows[0]!.id, reviewerId],
      ).then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
      let blocked = false;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const wait = await pool.query<{ wait_event_type: string | null }>("select wait_event_type from pg_stat_activity where pid=$1", [pid]);
        if (wait.rows[0]?.wait_event_type === "Lock") { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(blocked, true, "verification insert must wait for organization status update");
      await organizationChanger.query("commit");
      organizationChangeCommitted = true;
      const result = await pending;
      assert.equal(result.ok, false, "verification must fail after organization status change commits");
      if (!result.ok) assert.match(result.error instanceof Error ? result.error.message : String(result.error), /verification requires a verified activity organization/);
      await organizationVerifier.query("rollback").catch(() => undefined);
    } finally {
      if (!organizationChangeCommitted) await organizationChanger.query("rollback").catch(() => undefined);
      await organizationVerifier.query("rollback").catch(() => undefined);
      organizationChanger.release();
      organizationVerifier.release();
      await pool.query("update organizations set status='VERIFIED' where id=$1", [organizationId]);
    }

    // Geography-scope race: replacing the existing root must serialize against
    // a verification using the former root, then make that activity out of scope.
    const newScopeGeography = (await pool.query<{ id: string }>(
      "insert into geography(kind,name,source,source_version) values('STATE_UT',$1,'integration-test','scope-race-v1') returning id",
      ["TEST-NEW-SCOPE-GEO-" + suffix],
    )).rows[0]!.id;
    const scopeRaceEvidence = (await pool.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'FIELD','UNDER_REVIEW',now(),$2) returning id",
      [activity.rows[0]!.id, "geography-scope-race-" + suffix],
    )).rows[0]!.id;
    const scopeChanger = await pool.connect();
    const scopeVerifier = await pool.connect();
    let scopeChangeCommitted = false;
    try {
      await scopeChanger.query("begin");
      await scopeChanger.query(
        "update organization_geography_scopes set status='PENDING' where organization_id=$1 and geography_id=$2",
        [organizationId, geography.rows[0]!.id],
      );
      await scopeChanger.query(
        "insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
        [organizationId, newScopeGeography],
      );
      const pid = (await scopeVerifier.query<{ pid: number }>("select pg_backend_pid() pid")).rows[0]!.pid;
      const pending = scopeVerifier.query(
        "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'REJECTED','GEOGRAPHY_SCOPE_RACE')",
        [scopeRaceEvidence, activity.rows[0]!.id, reviewerId],
      ).then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
      let blocked = false;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const wait = await pool.query<{ wait_event_type: string | null }>("select wait_event_type from pg_stat_activity where pid=$1", [pid]);
        if (wait.rows[0]?.wait_event_type === "Lock") { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(blocked, true, "verification insert must wait for geography-scope mutation");
      await scopeChanger.query("commit");
      scopeChangeCommitted = true;
      const result = await pending;
      assert.equal(result.ok, false, "verification must fail after geography-scope change commits");
      if (!result.ok) assert.match(result.error instanceof Error ? result.error.message : String(result.error), /verification requires an activity within an authorized organization geography/);
      await scopeVerifier.query("rollback").catch(() => undefined);
    } finally {
      if (!scopeChangeCommitted) await scopeChanger.query("rollback").catch(() => undefined);
      await scopeVerifier.query("rollback").catch(() => undefined);
      scopeChanger.release();
      scopeVerifier.release();
    }

    const snapshotAfterRevocation = await pool.query<{ authorization_permissions_snapshot: string[] }>(
      "select authorization_permissions_snapshot from verifications where evidence_id=$1 and decision='APPROVED'",
      [uploaded.evidenceId],
    );
    assert.ok(snapshotAfterRevocation.rows[0]?.authorization_permissions_snapshot.includes("VERIFY_EVIDENCE"));
    const validRejectedDecision = await app.inject({ method: "POST", url: "/api/v1/evidence-vault/"+second.evidenceId+"/review", headers: headers(reviewerToken), payload: { decision: "REJECTED", rationale: "Valid same-organization rejection" } });
    assert.equal(validRejectedDecision.statusCode, 200, validRejectedDecision.body);
    assert.equal(validRejectedDecision.json().data.status, "REJECTED");

    const secondReview = await app.inject({ method: "POST", url: "/api/v1/evidence-vault/"+uploaded.evidenceId+"/review", headers: headers(reviewerToken), payload: { decision: "REJECTED", rationale: "Attempt a second decision" } });
    assert.equal(secondReview.statusCode, 409, secondReview.body);

    const spoofedPdf = await app.inject({ method: "POST", url: "/api/v1/evidence-vault/upload", headers: headers(uploaderToken), payload: { activityId: activity.rows[0]!.id, evidenceType: "MALICIOUS", fileName: "not-a-pdf.pdf", mediaType: "application/pdf", contentBase64: Buffer.from("MZ executable bytes").toString("base64") } });
    assert.equal(spoofedPdf.statusCode, 415, spoofedPdf.body);
  } finally {
    if (apiProofClient) {
      await apiProofClient.query("rollback").catch(() => undefined);
      apiProofClient.release();
    }
    if (apiProofRoleCreated) {
      await pool.query("drop owned by rupaykg_api_verification_proof").catch(() => undefined);
      await pool.query("drop role if exists rupaykg_api_verification_proof").catch(() => undefined);
    }
    await app.close();
    await pool.end();
  }
});
