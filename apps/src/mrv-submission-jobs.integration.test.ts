import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { approveTestMembership } from "./test-support/approved-membership.js";
import { advanceMrvSubmissionJob, claimNextMrvSubmissionJob, enqueueMrvSubmissionJob, isMrvSubmissionJobStillAuthorized, persistMrvGuardianIdempotencyKey, persistMrvHcsTransactionId, releaseMrvSubmissionJobLease, renewMrvSubmissionJobLease } from "./mrv-submission-jobs.js";

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
    const unverifiedEvidenceId = (await client.query<{id:string}>(
      "insert into evidence(activity_id,measurement_id,evidence_type,status,captured_at,content_hash) values($1,$2,'TEST_RECORD','CAPTURED',now(),$3) returning id",
      [activityId, measurementId, `unverified-${suffix}`],
    )).rows[0]!.id;
    const unverifiedEvidenceVerificationId = (await client.query<{id:string}>(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','test','Independent review of captured evidence') returning id",
      [unverifiedEvidenceId, activityId, verifierIdentityId],
    )).rows[0]!.id;
    const rejectedVerificationId = (await client.query<{id:string}>(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'REJECTED','test','Evidence rejected for MRV') returning id",
      [evidenceId, activityId, verifierIdentityId],
    )).rows[0]!.id;
    const attemptInvalidJob = async (name: string, organization: string, geography: string, evidence: string, verification: string, pattern: RegExp) => {
      await expectSqlFailure(name,
        `insert into mrv_submission_jobs(
           idempotency_key,payload_hash,activity_id,verification_id,evidence_id,organization_id,
           geography_id,requested_by_identity_id,guardian_policy_id,payload_snapshot
         ) values($1,$2,$3,$4,$5,$6,$7,$8,'test-policy','{"schema":"rupaykg:mrv:v1"}'::jsonb)`,
        [randomUUID().replaceAll("-", "") + "0000000000000000", "d".repeat(64), activityId, verification, evidence, organization, geography, identityId],
        pattern,
      );
    };
    await attemptInvalidJob("job_wrong_organization", randomUUID(), geographyId, evidenceId, verificationId, /MRV_JOB_ACTIVITY_SCOPE_INVALID/);
    await attemptInvalidJob("job_wrong_geography", organizationId, randomUUID(), evidenceId, verificationId, /MRV_JOB_ACTIVITY_SCOPE_INVALID/);
    await attemptInvalidJob("job_unverified_evidence", organizationId, geographyId, unverifiedEvidenceId, unverifiedEvidenceVerificationId, /MRV_JOB_EVIDENCE_NOT_VERIFIED/);
    await attemptInvalidJob("job_rejected_verification", organizationId, geographyId, evidenceId, rejectedVerificationId, /MRV_JOB_VERIFICATION_INVALID/);

    await expectSqlFailure("immutable_request", "update mrv_submission_jobs set payload_hash=$2 where id=$1", [jobId,"c".repeat(64)], /MRV_JOB_REQUEST_IMMUTABLE/);
    await expectSqlFailure("missing_worker_lease", "update mrv_submission_jobs set status='CLAIMED' where id=$1", [jobId], /MRV_JOB_LEASE_REQUIRED/);
    await expectSqlFailure("append_only_event", "update mrv_submission_job_events set event_code='tampered' where job_id=$1", [jobId], /MRV_JOB_EVENT_APPEND_ONLY/);

    const lease = await claimNextMrvSubmissionJob(client, "worker-" + suffix, 60);
    assert.ok(lease, "a due REQUESTED job must be claimable");
    assert.equal(lease.job.id, jobId);
    assert.equal(lease.job.status, "CLAIMED");
    assert.equal(lease.job.attempt_count, 1);
    await expectSqlFailure("invalid_transition_with_lease", "update mrv_submission_jobs set status='COMPLETED' where id=$1", [jobId], /MRV_JOB_INVALID_STATE_TRANSITION/);
    const competingLease = await claimNextMrvSubmissionJob(client, "worker-2-" + suffix, 60);
    assert.equal(competingLease, null, "a live lease must prevent a second worker claim");
    const renewedUntil = await renewMrvSubmissionJobLease(client, jobId, lease.leaseToken, 120);
    assert.ok(renewedUntil instanceof Date, "the active owner must be able to renew its lease");
    const staleAdvance = await advanceMrvSubmissionJob(client, jobId, randomUUID(), "GUARDIAN_SUBMITTED");
    assert.equal(staleAdvance, null, "a non-owner lease token must not advance a job");
    const guardianKey = "d".repeat(64);
    const persistedGuardian = await persistMrvGuardianIdempotencyKey(client, jobId, lease.leaseToken, guardianKey);
    assert.equal(persistedGuardian?.status, "GUARDIAN_SUBMITTED");
    assert.equal(persistedGuardian?.guardian_idempotency_key, guardianKey);
    assert.equal(persistedGuardian?.lease_token, lease.leaseToken, "persisting Guardian idempotency must retain the active fence");
    const conflictingGuardianKey = await persistMrvGuardianIdempotencyKey(client, jobId, lease.leaseToken, "e".repeat(64));
    assert.equal(conflictingGuardianKey, null, "a retry must not replace the persisted Guardian idempotency key");
    const guardianVerified = await advanceMrvSubmissionJob(client, jobId, lease.leaseToken, "GUARDIAN_VERIFIED", {
      guardian_execution_id: "guardian-exec-" + suffix,
      guardian_status: "VERIFIED",
    });
    assert.equal(guardianVerified?.status, "GUARDIAN_VERIFIED");
    assert.equal(guardianVerified?.lease_token, null, "stage advancement must release the lease atomically");

    const hcsLease = await claimNextMrvSubmissionJob(client, "hedera-worker-" + suffix, 60);
    assert.ok(hcsLease, "the verified Guardian stage must be resumable");
    const transactionId = "0.0.1234@1791620000.123456789";
    const persistedHcs = await persistMrvHcsTransactionId(client, jobId, hcsLease.leaseToken, "testnet", "0.0.12345", transactionId);
    assert.equal(persistedHcs?.status, "HCS_SUBMITTED");
    assert.equal(persistedHcs?.hedera_transaction_id, transactionId);
    assert.equal(persistedHcs?.lease_token, hcsLease.leaseToken, "persisting the provider transaction ID must retain the active fence");
    const conflictingTransaction = await persistMrvHcsTransactionId(client, jobId, hcsLease.leaseToken, "testnet", "0.0.12345", "0.0.1234@1791620001.123456789");
    assert.equal(conflictingTransaction, null, "a retry must not replace the previously persisted HCS transaction ID");

    const hcsConfirmed = await advanceMrvSubmissionJob(client, jobId, hcsLease.leaseToken, "HCS_CONSENSUS_CONFIRMED", {
      hedera_consensus_timestamp: "1791620000.123456789",
      hedera_status: "CONSENSUS_CONFIRMED",
    });
    assert.equal(hcsConfirmed?.status, "HCS_CONSENSUS_CONFIRMED");
    assert.equal(hcsConfirmed?.hedera_transaction_id, transactionId, "the persisted HCS transaction ID must survive stage completion");

    const interruptedLease = await claimNextMrvSubmissionJob(client, "interrupted-worker-" + suffix, 60);
    assert.ok(interruptedLease, "a confirmed HCS stage must be reclaimable for Mirror Node reconciliation");
    await client.query("update mrv_submission_jobs set lease_expires_at=now()-interval '1 second' where id=$1", [jobId]);
    const recoveredLease = await claimNextMrvSubmissionJob(client, "recovery-worker-" + suffix, 60);
    assert.ok(recoveredLease, "an expired lease must be recoverable");
    assert.notEqual(recoveredLease.leaseToken, interruptedLease.leaseToken, "recovery must fence the previous worker with a fresh token");
    assert.equal(recoveredLease.job.status, "HCS_CONSENSUS_CONFIRMED", "recovery must preserve the last confirmed provider stage");
    assert.equal(recoveredLease.job.hedera_transaction_id, transactionId, "recovery must preserve the exact persisted HCS transaction ID");
    const staleWorkerAdvance = await advanceMrvSubmissionJob(client, jobId, interruptedLease.leaseToken, "MIRROR_VERIFIED");
    assert.equal(staleWorkerAdvance, null, "the expired worker must not advance after another worker reclaims the lease");
    const staleWorkerHcsReplacement = await persistMrvHcsTransactionId(client, jobId, interruptedLease.leaseToken, "testnet", "0.0.12345", "0.0.1234@1791620002.123456789");
    assert.equal(staleWorkerHcsReplacement, null, "the expired worker must not replace the persisted HCS transaction ID");
    const eventsBeforeRelease = Number((await client.query<{count:string}>(
      "select count(*)::text count from mrv_submission_job_events where job_id=$1", [jobId],
    )).rows[0]!.count);
    assert.equal(await releaseMrvSubmissionJobLease(client, jobId, recoveredLease.leaseToken, new Date(Date.now() + 1000), "TEST_RELEASE", "release recovery lease for subsequent fixture checks"), true);
    const releaseEvent = await client.query<{count:string; event_detail: {lastErrorCode?:string}; actor_kind:string; actor_reference:string}>(
      "select count(*)::text count, (select event_detail from mrv_submission_job_events where job_id=$1 order by id desc limit 1) event_detail, (select actor_kind from mrv_submission_job_events where job_id=$1 order by id desc limit 1) actor_kind, (select actor_reference from mrv_submission_job_events where job_id=$1 order by id desc limit 1) actor_reference from mrv_submission_job_events where job_id=$1", [jobId],
    );
    assert.equal(Number(releaseEvent.rows[0]!.count), eventsBeforeRelease + 1, "lease release retry metadata must append an audit event");
    assert.equal(releaseEvent.rows[0]!.event_detail.lastErrorCode, "TEST_RELEASE");
    assert.equal(releaseEvent.rows[0]!.actor_kind, "WORKER", "worker-originated changes must be attributed to the worker");
    assert.equal(releaseEvent.rows[0]!.actor_reference, "recovery-worker-" + suffix, "worker audit events must identify the lease owner");

    const enqueueInput = {
      activityId, verificationId, evidenceId, organizationId, geographyId, requestedByIdentityId: verifierIdentityId,
      guardianPolicyId: "enqueue-test-policy", methodologyCode: "BM WA03.001", payloadSnapshot: { schema: "rupaykg:mrv:v1", observations: [], evidence: [] },
    };
    const queued = await enqueueMrvSubmissionJob(client, enqueueInput);
    const replayedQueue = await enqueueMrvSubmissionJob(client, enqueueInput);
    assert.equal(replayedQueue.id, queued.id, "identical submissions must return the same durable job");
    assert.equal(await isMrvSubmissionJobStillAuthorized(client, queued.id), true, "valid requester membership and current MRV bindings authorize provider work");
    await client.query("update organization_memberships set status='PENDING' where identity_id=$1 and organization_id=$2", [verifierIdentityId, organizationId]);
    assert.equal(await isMrvSubmissionJobStillAuthorized(client, queued.id), false, "revoked or pending requester membership must block provider work");
    await client.query("update organization_memberships set status='VERIFIED' where identity_id=$1 and organization_id=$2", [verifierIdentityId, organizationId]);
    await assert.rejects(
      enqueueMrvSubmissionJob(client, { ...enqueueInput, payloadSnapshot: { schema: "rupaykg:mrv:v1", observations: [{ value: 2 }], evidence: [] } }),
      /MRV_IDEMPOTENCY_PAYLOAD_CONFLICT/,
      "changed payload under the same idempotency key must fail closed",
    );

    await client.query("rollback");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
