import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("PostgreSQL rejects EPR external acceptance without independently verified authority evidence", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const suffix = randomBytes(8).toString("hex");
  try {
    await client.query("begin");
    const org = (await client.query<{id:string}>(
      "insert into organizations(name, organization_type, status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-EPR-ACCEPTANCE-"+suffix]
    )).rows[0]!.id;
    const identity = (await client.query<{id:string}>(
      "insert into identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["test-epr-acceptance:"+suffix,"EPR acceptance integration test"]
    )).rows[0]!.id;
    const verifierIdentity = (await client.query<{id:string}>(
      "insert into identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["test-epr-verifier:"+suffix,"Independent EPR verification test identity"]
    )).rows[0]!.id;
    const geography = (await client.query<{id:string}>(
      "insert into geography(kind,code,name,source) values('STATE_UT',$1,$2,'integration-test') returning id",
      ["TEST-"+suffix,"Test geography "+suffix]
    )).rows[0]!.id;
    await client.query(
      "insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [org,geography]
    );
    const verifierRole = (await client.query<{id:string}>(
      "insert into roles(organization_id,name,permissions) values($1,'TEST_VERIFIER','[\"VERIFY_EVIDENCE\"]') returning id",
      [org]
    )).rows[0]!.id;
    await client.query(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
      [verifierIdentity,org,verifierRole]
    );
    const activity = (await client.query<{id:string}>(
      "insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status,metadata) values($1,$2,$3,'EPR_EXTERNAL_ACCEPTANCE_TEST','DRAFT','{}'::jsonb) returning id",
      [org,identity,geography]
    )).rows[0]!.id;
    const scheme = (await client.query<{id:string}>(
      "insert into epr_schemes(code,name,authority,status,metadata) values($1,'Integration test scheme','Test authority','VERIFIED','{}'::jsonb) returning id",
      ["TEST_EPR_"+suffix]
    )).rows[0]!.id;
    const evidence = (await client.query<{id:string}>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,'AUTHORITY_CONFIRMATION','UNDER_REVIEW',now(),'test://authority-confirmation','"+ "a".repeat(64) +"','{}'::jsonb) returning id",
      [activity]
    )).rows[0]!.id;
    const rejectedVerification = (await client.query<{id:string}>(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'REJECTED','EPR_EXTERNAL_ACCEPTANCE','Integration fixture intentionally rejected') returning id",
      [evidence,activity,verifierIdentity]
    )).rows[0]!.id;
    await client.query("update evidence set status='VERIFIED' where id=$1",[evidence]);

    const base = {
      schemeId: scheme, organizationId: org, periodStart: "2026-01-01", periodEnd: "2026-03-31",
      returnType: "QUARTERLY", reportedQuantity: 0, fulfilledQuantity: 0
    };
    await client.query("savepoint missing_confirmation");
    await assert.rejects(
      client.query(
        "insert into epr_returns(scheme_id,organization_id,period_start,period_end,return_type,reported_quantity,status) values($1,$2,$3,$4,$5,$6,'ACCEPTED')",
        [base.schemeId,base.organizationId,base.periodStart,base.periodEnd,base.returnType,base.reportedQuantity]
      ),
      /requires authority, reference, confirmation evidence/i,
      "ACCEPTED must not be reachable from internal workflow state alone"
    );
    await client.query("rollback to savepoint missing_confirmation");

    await client.query("savepoint rejected_confirmation");
    await assert.rejects(
      client.query(
        `insert into epr_returns
          (scheme_id,organization_id,period_start,period_end,return_type,reported_quantity,status,
           external_reference,external_authority_name,external_confirmation_evidence_id,
           external_confirmation_verification_id,external_authority_confirmed_at)
         values($1,$2,$3,$4,$5,$6,'COMPLETED',$7,$8,$9,$10,now())`,
        [base.schemeId,base.organizationId,base.periodStart,base.periodEnd,"QUARTERLY_REJECTED",0,
          "TEST-EXT-"+suffix,"Test authority",evidence,rejectedVerification]
      ),
      /must be verified, approved, provenance-backed/i,
      "external acceptance must reject unverified evidence or rejected verification"
    );
    await client.query("rollback to savepoint rejected_confirmation");

    // A valid acceptance must remain bound to its original organization.
    const approvedVerification = (await client.query<{id:string}>(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','EPR_EXTERNAL_ACCEPTANCE','Independent authority evidence review approved') returning id",
      [evidence,activity,verifierIdentity]
    )).rows[0]!.id;
    const otherOrg = (await client.query<{id:string}>(
      "insert into organizations(name, organization_type, status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-EPR-OTHER-"+suffix]
    )).rows[0]!.id;
    const acceptedReturn = (await client.query<{id:string}>(
      `insert into epr_returns
        (scheme_id,organization_id,period_start,period_end,return_type,reported_quantity,status,
         external_reference,external_authority_name,external_confirmation_evidence_id,
         external_confirmation_verification_id,external_authority_confirmed_at)
       values($1,$2,'2026-01-01','2026-03-31',$3,0,'ACCEPTED',$4,'Test authority',$5,$6,now())
       returning id`,
      [scheme,org,"QUARTERLY_ACCEPTED_"+suffix,"TEST-EXT-VALID-"+suffix,evidence,approvedVerification]
    )).rows[0]!.id;
    await client.query("savepoint organization_reassignment");
    await assert.rejects(
      client.query("update epr_returns set organization_id=$2 where id=$1",[acceptedReturn,otherOrg]),
      /accepted EPR external confirmation is immutable|must be verified, approved, provenance-backed and organization\/geography scoped/i,
      "accepted return must not be reassigned away from the organization that owns its evidence"
    );
    await client.query("rollback to savepoint organization_reassignment");

    await client.query("savepoint evidence_invalidation");
    await assert.rejects(
      client.query("update evidence set status='UNDER_REVIEW' where id=$1",[evidence]),
      /evidence referenced by accepted EPR return is immutable/i,
      "accepted EPR evidence cannot be downgraded after external acceptance"
    );
    await client.query("rollback to savepoint evidence_invalidation");

    await client.query("savepoint verification_invalidation");
    await assert.rejects(
      client.query("update verifications set decision='REJECTED' where id=$1",[approvedVerification]),
      /verification referenced by accepted EPR return is immutable/i,
      "accepted EPR verification cannot be revoked in place"
    );
    await client.query("rollback to savepoint verification_invalidation");

    await client.query("savepoint evidence_delete");
    await assert.rejects(
      client.query("delete from evidence where id=$1",[evidence]),
      /evidence referenced by accepted EPR return cannot be deleted/i,
      "accepted EPR evidence cannot be deleted"
    );
    await client.query("rollback to savepoint evidence_delete");

    await client.query("savepoint verification_delete");
    await assert.rejects(
      client.query("delete from verifications where id=$1",[approvedVerification]),
      /verification referenced by accepted EPR return cannot be deleted/i,
      "accepted EPR verification cannot be deleted"
    );
    await client.query("rollback to savepoint verification_delete");

    await client.query("savepoint confirmation_rewrite");
    await assert.rejects(
      client.query("update epr_returns set external_reference='REWRITTEN' where id=$1",[acceptedReturn]),
      /accepted EPR external confirmation is immutable/i,
      "accepted external authority reference cannot be rewritten"
    );
    await client.query("rollback to savepoint confirmation_rewrite");
  } finally {
    try { await client.query("rollback"); } catch {}
    client.release();
    await pool.end();
  }
});
