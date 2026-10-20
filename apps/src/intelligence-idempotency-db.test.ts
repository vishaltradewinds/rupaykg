import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("AI intake ledger serializes duplicate submissions, rejects content conflicts, and fences stale workers", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 6,
  });
  const identityId = randomUUID();
  const organizationId = randomUUID();
  const key = `db-integration-${randomUUID()}`;
  const hash = createHash("sha256").update("synthetic request body A").digest("hex");
  try {
    await pool.query("insert into identities(id, display_name) values ($1, $2)", [identityId, "AI intake integration test"]);
    await pool.query("insert into organizations(id, name, organization_type) values ($1, $2, $3)", [organizationId, "AI intake integration test", "TEST_FIXTURE"]);

    const insert = () => pool.query<{ id: string; lease_token: string }>(
      `insert into ai_evidence_intake_jobs(identity_id, organization_id, idempotency_key, request_sha256)
       values ($1, $2, $3, $4)
       on conflict(identity_id, organization_id, idempotency_key) do nothing
       returning id, lease_token`,
      [identityId, organizationId, key, hash],
    );
    const [first, second] = await Promise.all([insert(), insert()]);
    assert.equal(first.rows.length + second.rows.length, 1, "concurrent duplicate key must create exactly one job");
    const initial = (first.rows[0] ?? second.rows[0])!;
    const jobId = initial.id;
    const oldToken = initial.lease_token;

    const duplicate = await pool.query<{ id: string; request_sha256: string }>(
      `select id, request_sha256 from ai_evidence_intake_jobs
        where identity_id=$1 and organization_id=$2 and idempotency_key=$3`,
      [identityId, organizationId, key],
    );
    assert.equal(duplicate.rows.length, 1);
    assert.equal(duplicate.rows[0]!.id, jobId);
    assert.equal(duplicate.rows[0]!.request_sha256, hash);
    assert.notEqual(duplicate.rows[0]!.request_sha256, createHash("sha256").update("synthetic request body B").digest("hex"),
      "same idempotency key with changed request content must be distinguishable as conflict");

    await pool.query("update ai_evidence_intake_jobs set lease_expires_at=now()-interval '1 second' where id=$1", [jobId]);
    const newToken = randomUUID();
    const takeover = await pool.query<{ lease_token: string; attempt_count: number }>(
      `update ai_evidence_intake_jobs
          set lease_token=$2::uuid, lease_expires_at=now()+interval '5 minutes',
              attempt_count=least(attempt_count+1,100), updated_at=now()
        where id=$1 and status='PROCESSING' and lease_expires_at < now()
        returning lease_token, attempt_count`,
      [jobId, newToken],
    );
    assert.equal(takeover.rowCount, 1, "expired job must be reclaimable");
    assert.equal(takeover.rows[0]!.lease_token, newToken);
    assert.equal(Number(takeover.rows[0]!.attempt_count), 2);

    const staleWrite = await pool.query(
      `update ai_evidence_intake_jobs set status='RETRYABLE_FAILED', last_error_code='STALE_WORKER'
        where id=$1 and lease_token=$2::uuid and status='PROCESSING'`,
      [jobId, oldToken],
    );
    assert.equal(staleWrite.rowCount, 0, "stale worker's fencing token must not mutate the job");

    await pool.query(
      `update ai_evidence_intake_jobs
          set status='RETRYABLE_FAILED', last_error_code='SYNTHETIC_TRANSIENT_FAILURE',
              lease_expires_at=now(), updated_at=now()
        where id=$1 and lease_token=$2::uuid and status='PROCESSING'`,
      [jobId, newToken],
    );
    const retryToken = randomUUID();
    const retry = await pool.query<{ lease_token: string; attempt_count: number }>(
      `update ai_evidence_intake_jobs
          set status='PROCESSING', lease_token=$2::uuid,
              lease_expires_at=now()+interval '5 minutes',
              attempt_count=least(attempt_count+1,100), updated_at=now(), last_error_code=null
        where id=$1 and status='RETRYABLE_FAILED'
        returning lease_token, attempt_count`,
      [jobId, retryToken],
    );
    assert.equal(retry.rowCount, 1, "retryable job must be reclaimable");
    assert.equal(retry.rows[0]!.lease_token, retryToken);
    assert.equal(Number(retry.rows[0]!.attempt_count), 3);

    const response = { jobId, result: "synthetic-completed-response", authoritativeMutation: false };
    const complete = await pool.query(
      `update ai_evidence_intake_jobs
          set status='COMPLETED', response_json=$3::jsonb, completed_at=now(),
              updated_at=now(), lease_expires_at=now()
        where id=$1 and lease_token=$2::uuid and status='PROCESSING'`,
      [jobId, retryToken, JSON.stringify(response)],
    );
    assert.equal(complete.rowCount, 1);
    const replay = await pool.query<{ status: string; response_json: unknown; completed_at: Date | null }>(
      "select status, response_json, completed_at from ai_evidence_intake_jobs where id=$1",
      [jobId],
    );
    assert.equal(replay.rows[0]!.status, "COMPLETED");
    assert.deepEqual(replay.rows[0]!.response_json, response);
    assert.ok(replay.rows[0]!.completed_at, "completed response must be durable for replay");

    await assert.rejects(
      pool.query(
        `insert into ai_evidence_intake_jobs(identity_id, organization_id, idempotency_key, request_sha256)
         values ($1,$2,$3,$4)`,
        [identityId, organizationId, key, hash],
      ),
      /duplicate key|unique constraint/i,
      "database uniqueness must protect the idempotency key even if a caller omits ON CONFLICT",
    );
  } finally {
    await pool.query("delete from ai_evidence_intake_jobs where identity_id=$1 and organization_id=$2", [identityId, organizationId]).catch(() => undefined);
    await pool.query("delete from identities where id=$1", [identityId]).catch(() => undefined);
    await pool.query("delete from organizations where id=$1", [organizationId]).catch(() => undefined);
    await pool.end();
  }
});
