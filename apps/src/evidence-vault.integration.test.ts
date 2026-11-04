import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerEvidenceVaultRoutes } from "./evidence-vault-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("evidence vault enforces tenant scope, versioned storage, integrity and independent review", { skip: !enabled }, async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = Fastify({ logger: false });
  await registerEvidenceVaultRoutes(app, pool);
  const membershipMigrationCandidates = [
    path.resolve(process.cwd(), "migrations/2026110401_membership_role_tenant_binding.sql"),
    path.resolve(process.cwd(), "../migrations/2026110401_membership_role_tenant_binding.sql"),
  ];
  const membershipMigrationPath = membershipMigrationCandidates.find(candidate => existsSync(candidate));
  assert.ok(membershipMigrationPath, "membership role tenant-binding migration must be available to the integration test");
  const membershipMigrationSql = await readFile(membershipMigrationPath, "utf8");
  await pool.query(membershipMigrationSql);
  const membershipRoleConstraint = await pool.query<{ convalidated: boolean; definition: string }>(
    "select convalidated, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.organization_memberships'::regclass and conname='organization_memberships_role_organization_fk'",
  );
  assert.equal(membershipRoleConstraint.rows[0]?.convalidated, true);
  assert.match(membershipRoleConstraint.rows[0]?.definition ?? "", /FOREIGN KEY \(role_id, organization_id\) REFERENCES roles\(id, organization_id\)/);
  // Rehearse the forward-only migration against a production-like catalog:
  // snapshot columns already exist and both historical trigger names are present.
  const migrationCandidates = [
    path.resolve(process.cwd(), "migrations/20261104_verification_authorization_tenant_binding.sql"),
    path.resolve(process.cwd(), "../migrations/20261104_verification_authorization_tenant_binding.sql"),
  ];
  const migrationPath = migrationCandidates.find(candidate => existsSync(candidate));
  assert.ok(migrationPath, "verification authorization migration must be available to the integration test");
  const migrationSql = await readFile(migrationPath, "utf8");
  // Recreate the exact recovered migration-096 function body and the real
  // migration-010 independence trigger before rehearsing the new forward-only
  // migration. This is disposable CI state only; migration 096 stays review-only.
  const recovered096Sql = `
    alter table verifications
      add column if not exists authorization_membership_id uuid references organization_memberships(id),
      add column if not exists authorization_role_id uuid references roles(id),
      add column if not exists authorization_permissions_snapshot jsonb,
      add column if not exists authorization_checked_at timestamptz;

    create or replace function prevent_invalid_verification()
    returns trigger
    language plpgsql
    as $$
    declare
      resolved_activity_id uuid;
      activity_actor uuid;
      activity_organization_id uuid;
      membership_row record;
      evidence_activity_id uuid;
    begin
      resolved_activity_id := new.activity_id;
      if new.evidence_id is not null then
        select e.activity_id into evidence_activity_id from evidence e where e.id = new.evidence_id;
        if evidence_activity_id is null then
          raise exception 'verification evidence must be bound to an activity';
        end if;
        if resolved_activity_id is not null and resolved_activity_id is distinct from evidence_activity_id then
          raise exception 'verification activity must match the evidence activity';
        end if;
        resolved_activity_id := evidence_activity_id;
        new.activity_id := evidence_activity_id;
      end if;
      if resolved_activity_id is not null then
        select a.actor_identity_id, a.organization_id
          into activity_actor, activity_organization_id
          from activities a where a.id = resolved_activity_id;
      end if;
      if new.decision = 'APPROVED' then
        if activity_organization_id is null then
          raise exception 'approved verification requires an activity with an organization';
        end if;
        if activity_actor is not null and activity_actor = new.verifier_identity_id then
          raise exception 'activity actor cannot verify its own evidence';
        end if;
        select m.id as membership_id, m.role_id, r.permissions
          into membership_row
          from organization_memberships m
          join roles r on r.id = m.role_id
          join identities i on i.id = m.identity_id
         where m.identity_id = new.verifier_identity_id
           and m.organization_id = activity_organization_id
           and m.status = 'VERIFIED'
           and i.status = 'VERIFIED'
           and i.suspended_at is null
           and (
             r.permissions @> '[\"VERIFY_EVIDENCE\"]'::jsonb
             or r.permissions @> '[\"verification:approve\"]'::jsonb
             or r.permissions @> '[\"verification.approve\"]'::jsonb
           )
         order by m.created_at desc
         limit 1;
        if membership_row.membership_id is null then
          raise exception 'approved verification requires active verifier permission in the activity organization';
        end if;
        new.authorization_membership_id := membership_row.membership_id;
        new.authorization_role_id := membership_row.role_id;
        new.authorization_permissions_snapshot := membership_row.permissions;
        new.authorization_checked_at := now();
      end if;
      return new;
    end;
    $$;
  `;
  await pool.query("drop trigger if exists verification_authorization_guard on public.verifications");
  await pool.query("drop trigger if exists verification_independence_guard on public.verifications");
  await pool.query("drop trigger if exists verifications_integrity_guard on public.verifications");
  await pool.query(recovered096Sql);
  await pool.query("create trigger verification_independence_guard before insert on public.verifications for each row execute function public.enforce_verification_independence()");
  await pool.query("create trigger verifications_integrity_guard before insert or update on public.verifications for each row execute function public.prevent_invalid_verification()");
  const historicalVerificationTriggers = await pool.query<{ tgname: string }>(
    "select tgname from pg_trigger where tgrelid='public.verifications'::regclass and not tgisinternal order by tgname",
  );
  assert.deepEqual(historicalVerificationTriggers.rows.map(row => row.tgname), ["verification_independence_guard", "verifications_integrity_guard"]);
  const recoveredFunction = await pool.query<{ definition: string }>(
    "select pg_get_functiondef('public.prevent_invalid_verification()'::regprocedure) as definition",
  );
  assert.match(recoveredFunction.rows[0]?.definition ?? "", /approved verification requires active verifier permission in the activity organization/);
  const legacyFunction = await pool.query<{ definition: string }>(
    "select pg_get_functiondef('public.enforce_verification_independence()'::regprocedure) as definition",
  );
  assert.match(legacyFunction.rows[0]?.definition ?? "", /VERIFIER/);
  assert.match(legacyFunction.rows[0]?.definition ?? "", /AUDITOR/);

  // Demonstrate the historical trigger composition before replacing it:
  // migration 010's cross-org permission lookup lets REJECTED through, while
  // recovered 096 applies its strict same-org check only to APPROVED.
  const legacySuffix = randomBytes(6).toString("hex");
  const legacyOrgA = (await pool.query<{ id: string }>(
    "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
    ["TEST-096-ORG-A-" + legacySuffix],
  )).rows[0]!.id;
  const legacyOrgB = (await pool.query<{ id: string }>(
    "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
    ["TEST-096-ORG-B-" + legacySuffix],
  )).rows[0]!.id;
  const legacyGeo = (await pool.query<{ id: string }>(
    "insert into geography(kind,name,source,source_version) values('STATE_UT',$1,'integration-test','legacy-096') returning id",
    ["TEST-096-GEO-" + legacySuffix],
  )).rows[0]!.id;
  const legacyIdentity = (await pool.query<{ id: string }>(
    "insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id",
    ["test-096-cross-org:" + legacySuffix, "Legacy 096 Cross Org Verifier", "legacy-096-" + legacySuffix + "@example.invalid"],
  )).rows[0]!.id;
  const legacyRoleA = (await pool.query<{ id: string }>(
    "insert into roles(organization_id,name,permissions,geography_scope) values($1,'legacy_reviewer',$2::jsonb,'[]') returning id",
    [legacyOrgA, JSON.stringify(["evidence:review"])],
  )).rows[0]!.id;
  const legacyRoleB = (await pool.query<{ id: string }>(
    "insert into roles(organization_id,name,permissions,geography_scope) values($1,'legacy_verifier',$2::jsonb,'[]') returning id",
    [legacyOrgB, JSON.stringify(["VERIFY_EVIDENCE"])],
  )).rows[0]!.id;
  await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
  try {
    await pool.query(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($1,$4,$5,'VERIFIED')",
      [legacyIdentity, legacyOrgA, legacyRoleA, legacyOrgB, legacyRoleB],
    );
  } finally {
    await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
  }
  const legacyActivity = (await pool.query<{ id: string }>(
    "insert into activities(organization_id,geography_id,activity_type,status) values($1,$2,'WASTE_WEIGHT_MEASUREMENT','COMPLETED') returning id",
    [legacyOrgA, legacyGeo],
  )).rows[0]!.id;
  const legacyEvidence = (await pool.query<{ id: string }>(
    "insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'FIELD','UNDER_REVIEW',now(),$2) returning id",
    [legacyActivity, "legacy-096-" + legacySuffix],
  )).rows[0]!.id;
  await assert.rejects(
    pool.query(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','LEGACY_096','Historical strict guard negative')",
      [legacyEvidence, legacyActivity, legacyIdentity],
    ),
    /approved verification requires active verifier permission in the activity organization/,
  );
  const legacyRejected = await pool.query<{ id: string }>(
    "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'REJECTED','LEGACY_096','Historical cross-org rejection path') returning id",
    [legacyEvidence, legacyActivity, legacyIdentity],
  );
  assert.equal(legacyRejected.rowCount, 1, "historical trigger composition allowed the cross-org REJECTED path");
  await pool.query("delete from verifications where id=$1", [legacyRejected.rows[0]!.id]);
  await pool.query("delete from evidence where id=$1", [legacyEvidence]);
  await pool.query("delete from activities where id=$1", [legacyActivity]);
  await pool.query("delete from organization_memberships where identity_id=$1", [legacyIdentity]);
  await pool.query("delete from roles where id in ($1,$2)", [legacyRoleA, legacyRoleB]);
  await pool.query("delete from identities where id=$1", [legacyIdentity]);
  await pool.query("delete from organizations where id in ($1,$2)", [legacyOrgA, legacyOrgB]);
  await pool.query("delete from geography where id=$1", [legacyGeo]);

  await pool.query(migrationSql);
  const remainingVerificationTriggers = await pool.query<{ tgname: string }>(
    "select tgname from pg_trigger where tgrelid='public.verifications'::regclass and not tgisinternal order by tgname",
  );
  assert.deepEqual(remainingVerificationTriggers.rows.map(row => row.tgname), ["verification_authorization_guard"]);
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
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$5,'VERIFIED'),($6,$7,$8,'VERIFIED'),($9,$2,$10,'VERIFIED'),($9,$7,$11,'VERIFIED')",
        [uploaderId,organizationId,roles[0].rows[0]!.id,reviewerId,roles[1].rows[0]!.id,outsiderId,otherOrg.rows[0]!.id,roles[2].rows[0]!.id,crossOrgReviewerId,roles[3].rows[0]!.id,roles[4].rows[0]!.id],
      );
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }
    await assert.rejects(
      pool.query(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
        [crossOrgReviewerId, organizationId, roles[4].rows[0]!.id],
      ),
      (error: unknown) => {
        const dbError = error as { code?: string; constraint?: string };
        return dbError.code === "23503" && dbError.constraint === "organization_memberships_role_organization_fk";
      },
    );
    await assert.rejects(
      pool.query(
        "update organization_memberships set organization_id=$2 where identity_id=$1 and organization_id=$3 and role_id=$4",
        [uploaderId, otherOrg.rows[0]!.id, organizationId, roles[0].rows[0]!.id],
      ),
      (error: unknown) => {
        const dbError = error as { code?: string; constraint?: string };
        return dbError.code === "23503" && dbError.constraint === "organization_memberships_role_organization_fk";
      },
    );
    await pool.query(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4),($5,now()+interval '1 hour',$6),($7,now()+interval '1 hour',$8)",
      [uploaderId,hash(uploaderToken),reviewerId,hash(reviewerToken),outsiderId,hash(outsiderToken),crossOrgReviewerId,hash(crossOrgReviewerToken)],
    );
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
      assert.equal(raced.ok, false);
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
      assert.equal(result.ok, false);
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
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error instanceof Error ? result.error.message : String(result.error), /verification requires active explicit verifier permission/);
      await suspensionVerifier.query("rollback").catch(() => undefined);
    } finally {
      if (!suspensionCommitted) await suspender.query("rollback").catch(() => undefined);
      await suspensionVerifier.query("rollback").catch(() => undefined);
      suspender.release();
      suspensionVerifier.release();
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
    await app.close();
    await pool.end();
  }
});
