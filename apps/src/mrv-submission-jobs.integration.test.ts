import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { approveTestMembership } from "./test-support/approved-membership.js";

const databaseUrl = process.env.DATABASE_URL;
const ssl = process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false };

test("durable MRV job ledger enforces immutable request, legal transitions and append-only events", { skip: !databaseUrl }, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, ssl });
  const client = await pool.connect();
  const suffix = randomUUID();
  try {
    await client.query("begin");
    const organizationId = (await client.query<{id:string}>(
      "insert into organizations(name,organization_type,status) values($1,'COLLECTOR','VERIFIED') returning id",
      [`mrv-job-org-${suffix}`],
    )).rows[0]!.id;
    const geographyId = (await client.query<{id:string}>(
      "insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id",
      [`MRV-JOB-${suffix}`, `MRV Job Test ${suffix}`],
    )).rows[0]!.id;
    await client.query(
      "insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
      [organizationId, geographyId],
    );
    const identityId = (await client.query<{id:string}>(
      "insert into identities(external_subject,display_name) values($1,'MRV Job Test') returning id",
      [`mrv-job-identity-${suffix}`],
    )).rows[0]!.id;
    const verifierIdentityId = (await client.query<{id:string}>(
      "insert into identities(external_subject,display_name) values($1,'MRV Job Independent Verifier') returning id",
      [`mrv-job-verifier-${suffix}`],
    )).rows[0]!.id;
    const verifierRoleId = (await client.query<{id:string}>(
      "insert into roles(organization_id,name,permissions) values($1,'verifier',$2::jsonb) returning id",
      [organizationId, JSON.stringify(["verification:approve", "VERIFY_EVIDENCE"])],
    )).rows[0]!.id;
    await approveTestMembership(client, verifierIdentityId, organizationId, verifierRoleId, geographyId, "verifier", "collector");
    const activityId = (await client.query<{id:string}>(
      "insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status,completed_at) values($1,$2,$3,'COLLECTION','COMPLETED',now()) returning id",
      [organizationId, identityId, geographyId],
    )).rows[0]!.id;
    const measurementId = (await client.query<{id:string}>(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,quality_status) values($1,1,'kg','TEST','FIELD',now(),'VERIFIED') returning id",
      [activityId],
    )).rows[0]!.id;
    const evidenceId = (await client.query<{id:string}>(
      "insert into evidence(activity_id,measurement_id,evidence_type,status,captured_at,content_hash) values($1,$2,'TEST_RECORD','VERIFIED',now(),$3) returning id",
      [activityId, measurementId, `hash-${suffix}`],
    )).rows[0]!.id;
    const verificationId = (await client.query<{id:string}>(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','test','MRV job schema test') returning id",
      [evidenceId, activityId, verifierIdentityId],
    )).rows[0]!.id;
    const payloadHash = "a".repeat(64);
    const idempotencyKey = "b".repeat(64);
    const jobId = (await client.query<{id:string}>(
      `insert into mrv_submission_jobs(
         idempotency_key,payload_hash,activity_id,verification_id,evidence_id,organization_id,
         geography_id,requested_by_identity_id,guardian_policy_id,payload_snapshot
       ) values($1,$2,$3,$4,$5,$6,$7,$8,'test-policy','{"schema":"rupaykg:mrv:v1"}'::jsonb)
       returning id`,
      [idempotencyKey,payloadHash,activityId,verificationId,evidenceId,organizationId,geographyId,identityId],
    )).rows[0]!.id;

    const initialEvents = await client.query<{count:string}>(
      "select count(*)::text count from mrv_submission_job_events where job_id=$1",
      [jobId],
    );
    assert.equal(initialEvents.rows[0]?.count, "1", "job creation must be recorded");

    const expectSqlFailure = async (name: string, sql: string, values: unknown[], pattern: RegExp) => {
      await client.query(`savepoint ${name}`);
      try {
        await assert.rejects(client.query(sql, values), pattern);
      } finally {
        await client.query(`rollback to savepoint ${name}`);
        await client.query(`release savepoint ${name}`);
      }
    };
    await expectSqlFailure("immutable_request", "update mrv_submission_jobs set payload_hash=$2 where id=$1", [jobId,"c".repeat(64)], /MRV_JOB_REQUEST_IMMUTABLE/);
    await expectSqlFailure("invalid_transition", "update mrv_submission_jobs set status='COMPLETED' where id=$1", [jobId], /MRV_JOB_INVALID_STATE_TRANSITION/);
    await expectSqlFailure("append_only_event", "update mrv_submission_job_events set event_code='tampered' where job_id=$1", [jobId], /MRV_JOB_EVENT_APPEND_ONLY/);

    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
