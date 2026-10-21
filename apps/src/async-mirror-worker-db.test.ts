import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { canonicalGovBridgeHash } from "./government-inbox-hash.js";
import { Pool } from "pg";
import { runGovernmentInboxWorker } from "./async-mirror-worker.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const sha = canonicalGovBridgeHash;

test("government inbox worker persists retry recovery, quarantine and append-only transition evidence in disposable PostgreSQL", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 4,
  });
  const suffix = randomUUID();
  const provisionCrosswalk = async (authorityCode: string, municipalCode: string, timestamp: string): Promise<{ organizationId: string; geographyId: string }> => {
    const organizationId = randomUUID();
    const requesterId = randomUUID();
    const approverId = randomUUID();
    const geographyId = randomUUID();
    const reason = "Synthetic worker crosswalk acceptance fixture";
    const effectiveFrom = new Date(Date.parse(timestamp) - 24 * 60 * 60 * 1000);
    await pool.query("insert into organizations(id,name,organization_type) values($1,$2,'TEST_FIXTURE')", [organizationId, "Worker crosswalk " + authorityCode]);
    await pool.query("insert into identities(id,display_name) values($1,$2),($3,$4)", [requesterId, "Worker crosswalk requester " + authorityCode, approverId, "Worker crosswalk approver " + authorityCode]);
    await pool.query("insert into geography(id,kind,code,name,source,source_version) values($1,'CLUSTER',$2,$3,'Synthetic worker fixture','v1')", [geographyId, "WORKER-GEO-" + authorityCode, "Worker crosswalk geography " + authorityCode]);
    await pool.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')", [organizationId, geographyId]);
    const activityId = randomUUID();
    await pool.query("insert into activities(id,organization_id,geography_id,activity_type,status) values($1,$2,$3,'WASTE_WEIGHT_MEASUREMENT','COMPLETED')", [activityId, organizationId, geographyId]);
    const uploaderBytes = Buffer.from("Synthetic reviewed worker crosswalk evidence " + authorityCode);
    const evidenceSha256 = createHash("sha256").update(uploaderBytes).digest("hex");
    const evidenceId = randomUUID();
    const seriesId = randomUUID();
    const artifactVersionId = randomUUID();
    await pool.query("insert into evidence_artifact_series(id,organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,$3,'CROSSWALK_SOURCE_RECORD',$4)", [seriesId, organizationId, activityId, requesterId]);
    await pool.query("insert into evidence(id,activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,$2,'CROSSWALK_SOURCE_RECORD','VERIFIED',now(),$3,$4,$5::jsonb)", [evidenceId, activityId, "db://evidence-vault/" + artifactVersionId, evidenceSha256, JSON.stringify({ source: "synthetic test fixture" })]);
    await pool.query("insert into evidence_artifact_versions(id,series_id,evidence_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id,source_reference) values($1,$2,$3,1,'worker-crosswalk.txt','text/plain',$4,$5,$6,$7,$8)", [artifactVersionId, seriesId, evidenceId, uploaderBytes.length, evidenceSha256, uploaderBytes, requesterId, "synthetic://worker-crosswalk/" + authorityCode]);
    const evidenceReference = "db://evidence-vault/" + artifactVersionId;
    const requestHash = sha(JSON.stringify({ authorityCode, municipalCode, organizationId, geographyId, evidenceSha256, effectiveFrom }));
    const request = await pool.query<{ id: string }>(
      `insert into government_jurisdiction_crosswalk_requests
        (authority_code,municipal_code,source_version,organization_id,geography_id,effective_from,evidence_reference,evidence_sha256,request_reason,request_hash,requested_by_identity_id)
       values($1,$2,'synthetic-source-v1',$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [authorityCode, municipalCode, organizationId, geographyId, effectiveFrom, evidenceReference, evidenceSha256, reason, requestHash, requesterId],
    );
    const requestId = request.rows[0]!.id;
    const decisionReason = "Independent synthetic fixture approval";
    await pool.query(
      `update government_jurisdiction_crosswalk_requests
          set status='APPROVED',decided_by_identity_id=$2,decision_reason=$3,decided_at=now(),applied_at=now()
        where id=$1`,
      [requestId, approverId, decisionReason],
    );
    await pool.query(
      `insert into government_jurisdiction_crosswalks
        (authority_code,municipal_code,source_version,organization_id,geography_id,status,evidence_reference,evidence_sha256,
         requested_by_identity_id,approved_by_identity_id,approval_reason,approval_request_id,effective_from,verified_at)
       values($1,$2,'synthetic-source-v1',$3,$4,'VERIFIED',$5,$6,$7,$8,$9,$10,$11,now())`,
      [authorityCode, municipalCode, organizationId, geographyId, evidenceReference, evidenceSha256, requesterId, approverId, decisionReason, requestId, effectiveFrom],
    );
    return { organizationId, geographyId };
  };

  const makeRow = async (authorityCode: string, shouldQuarantine = false) => {
    const batchId = randomUUID();
    const syncWindowTimestamp = new Date().toISOString();
    const payload = {
      batchMetadata: { authorityCode, municipalCode: "TEST-MUNI", batchId, syncWindowTimestamp, sourceVersion: "synthetic-source-v1" },
      rawDataLogs: ["Synthetic test-only waste intake record"],
    };
    const inserted = await pool.query<{ id: string }>(
      `insert into async_mirror_inbox(authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,status,attempts,received_at)
       values($1,'TEST-MUNI',$2,$3,$4::jsonb,$5,'RECEIVED',0,now() - interval '2 minutes') returning id`,
      [authorityCode, batchId, syncWindowTimestamp, JSON.stringify(payload), sha(payload)],
    );
    return { id: inserted.rows[0]!.id, authorityCode, batchId, shouldQuarantine };
  };
  try {
    const recoverable = await makeRow("TST-" + suffix.slice(0, 8).toUpperCase());
    const expectedCrosswalk = await provisionCrosswalk(recoverable.authorityCode, "TEST-MUNI", new Date().toISOString());
    const first = await runGovernmentInboxWorker(pool, async () => { throw new Error("SyntheticTransientFailure"); }, { batchSize: 10, maxAttempts: 3 });
    assert.ok(first.retried >= 1, "transient validator failure must be persisted as RETRY");
    const retryRow = await pool.query<{ status: string; attempts: number; lease_token: string | null }>(
      "select status,attempts,lease_token from async_mirror_inbox where id=$1", [recoverable.id],
    );
    assert.equal(retryRow.rows[0]?.status, "RETRY");
    assert.equal(retryRow.rows[0]?.attempts, 1);
    assert.equal(retryRow.rows[0]?.lease_token, null);

    await pool.query("update async_mirror_inbox set next_attempt_at=now()-interval '1 second' where id=$1", [recoverable.id]);
    const recovered = await runGovernmentInboxWorker(pool, undefined, { batchSize: 10, maxAttempts: 3 });
    const finalRow = await pool.query<{ status: string; attempts: number; lease_token: string | null; lease_until: Date | null; validation_summary: Record<string, unknown>; last_error_code: string | null }>(
      "select status,attempts,lease_token,lease_until,validation_summary,last_error_code from async_mirror_inbox where id=$1", [recoverable.id],
    );
    assert.ok(recovered.validated >= 1, `retry must recover into internal VALIDATED state; result=${JSON.stringify(recovered)} row=${JSON.stringify(finalRow.rows[0])}`);
    assert.equal(finalRow.rows[0]?.status, "VALIDATED");
    assert.equal(finalRow.rows[0]?.attempts, 2);
    assert.equal(finalRow.rows[0]?.lease_token, null);
    assert.equal(finalRow.rows[0]?.lease_until, null);
    assert.equal(finalRow.rows[0]?.validation_summary.validation, "STRUCTURAL_AND_JURISDICTION_CROSSWALK_RESOLVED");
    assert.equal(finalRow.rows[0]?.validation_summary.officialAcceptance, false);
    assert.equal(finalRow.rows[0]?.validation_summary.authoritativeMrvMutation, false);
    assert.equal(finalRow.rows[0]?.validation_summary.guardianSubmission, false);
    const resolved = finalRow.rows[0]?.validation_summary.jurisdictionCrosswalk as Record<string, unknown> | undefined;
    assert.ok(resolved, "a validated inbox row must expose the exact resolved crosswalk");
    assert.equal(resolved.organizationId, expectedCrosswalk.organizationId);
    assert.equal(resolved.geographyId, expectedCrosswalk.geographyId);
    assert.equal(resolved.activityId, null);
    assert.equal(resolved.sourceVersion, "synthetic-source-v1");

    // A different source version must not resolve merely because authority and municipality match.
    const mismatchedVersionBatchId = randomUUID();
    const mismatchedVersionTimestamp = new Date().toISOString();
    const mismatchedVersionPayload = {
      batchMetadata: { authorityCode: recoverable.authorityCode, municipalCode: "TEST-MUNI", batchId: mismatchedVersionBatchId,
        syncWindowTimestamp: mismatchedVersionTimestamp, sourceVersion: "wrong-source-version" },
      rawDataLogs: ["Synthetic wrong-version waste intake record"],
    };
    const mismatchedVersionInsert = await pool.query<{ id: string }>(
      `insert into async_mirror_inbox(authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,status,attempts,received_at)
       values($1,'TEST-MUNI',$2,$3,$4::jsonb,$5,'RECEIVED',0,now() - interval '2 minutes') returning id`,
      [recoverable.authorityCode, mismatchedVersionBatchId, mismatchedVersionTimestamp, JSON.stringify(mismatchedVersionPayload), sha(mismatchedVersionPayload)],
    );
    const mismatchedVersionId = mismatchedVersionInsert.rows[0]!.id;
    const mismatchResult = await runGovernmentInboxWorker(pool, undefined, { batchSize: 10, maxAttempts: 3 });
    assert.ok(mismatchResult.unresolved >= 1, "wrong source version must remain unresolved");
    const mismatchRow = await pool.query<{ status: string; last_error_code: string | null; validation_summary: Record<string, unknown> }>(
      "select status,last_error_code,validation_summary from async_mirror_inbox where id=$1", [mismatchedVersionId],
    );
    assert.equal(mismatchRow.rows[0]?.status, "UNRESOLVED");
    assert.equal(mismatchRow.rows[0]?.last_error_code, "GOVERNMENT_CROSSWALK_NOT_FOUND");
    assert.equal(mismatchRow.rows[0]?.validation_summary.officialAcceptance, false);

    const resolvedCrosswalk = await pool.query<{ id: string }>(
      "select id from government_jurisdiction_crosswalks where authority_code=$1 and municipal_code='TEST-MUNI' and organization_id=$2 and source_version='synthetic-source-v1' and status='VERIFIED'",
      [recoverable.authorityCode, expectedCrosswalk.organizationId],
    );
    assert.equal(resolvedCrosswalk.rows.length, 1);

    // Expired mappings must not resolve a batch, even with the exact source version.
    // Keep the row valid at wall-clock time but expired at the test batch timestamp;
    // the database correctly forbids changing a VERIFIED row to already expired now.
    const expiredTimestamp = new Date(Date.now() + 120_000).toISOString();
    await pool.query("update government_jurisdiction_crosswalks set effective_to=now()+make_interval(mins => 1) where id=$1", [
      resolvedCrosswalk.rows[0]!.id,
    ]);
    const expiredBatchId = randomUUID();
    const expiredPayload = {
      batchMetadata: { authorityCode: recoverable.authorityCode, municipalCode: "TEST-MUNI", batchId: expiredBatchId,
        syncWindowTimestamp: expiredTimestamp, sourceVersion: "synthetic-source-v1" },
      rawDataLogs: ["Synthetic expired-crosswalk waste intake record"],
    };
    const expiredInsert = await pool.query<{ id: string }>(
      "insert into async_mirror_inbox(authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,status,attempts,received_at) values($1,'TEST-MUNI',$2,$3,$4::jsonb,$5,'RECEIVED',0,now()-interval '2 minutes') returning id",
      [recoverable.authorityCode, expiredBatchId, expiredTimestamp, JSON.stringify(expiredPayload), sha(expiredPayload)],
    );
    await runGovernmentInboxWorker(pool, undefined, { batchSize: 10, maxAttempts: 3 });
    const expiredRow = await pool.query<{ status: string; last_error_code: string | null }>(
      "select status,last_error_code from async_mirror_inbox where id=$1", [expiredInsert.rows[0]!.id],
    );
    assert.equal(expiredRow.rows[0]?.status, "UNRESOLVED");
    assert.equal(expiredRow.rows[0]?.last_error_code, "GOVERNMENT_CROSSWALK_NOT_FOUND");

    // Revoked mappings must not resolve future batches.
    await pool.query("update government_jurisdiction_crosswalks set status='REVOKED', effective_to=null, revoked_at=now() where id=$1", [resolvedCrosswalk.rows[0]!.id]);
    const revokedTimestamp = new Date().toISOString();
    const revokedBatchId = randomUUID();
    const revokedPayload = {
      batchMetadata: { authorityCode: recoverable.authorityCode, municipalCode: "TEST-MUNI", batchId: revokedBatchId,
        syncWindowTimestamp: revokedTimestamp, sourceVersion: "synthetic-source-v1" },
      rawDataLogs: ["Synthetic revoked-crosswalk waste intake record"],
    };
    const revokedInsert = await pool.query<{ id: string }>(
      "insert into async_mirror_inbox(authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,status,attempts,received_at) values($1,'TEST-MUNI',$2,$3,$4::jsonb,$5,'RECEIVED',0,now()-interval '2 minutes') returning id",
      [recoverable.authorityCode, revokedBatchId, revokedTimestamp, JSON.stringify(revokedPayload), sha(revokedPayload)],
    );
    await runGovernmentInboxWorker(pool, undefined, { batchSize: 10, maxAttempts: 3 });
    const revokedRow = await pool.query<{ status: string; last_error_code: string | null }>(
      "select status,last_error_code from async_mirror_inbox where id=$1", [revokedInsert.rows[0]!.id],
    );
    assert.equal(revokedRow.rows[0]?.status, "UNRESOLVED");
    assert.equal(revokedRow.rows[0]?.last_error_code, "GOVERNMENT_CROSSWALK_NOT_FOUND");

    const exhausted = await makeRow("QRT-" + suffix.slice(0, 8), true);
    const quarantined = await runGovernmentInboxWorker(pool, async () => { throw new Error("SyntheticExhaustedFailure"); }, { batchSize: 10, maxAttempts: 1 });
    assert.ok(quarantined.quarantined >= 1, "exhausted work must be quarantined");
    const quarantineRow = await pool.query<{ status: string; attempts: number; quarantined_at: Date | null; lease_token: string | null }>(
      "select status,attempts,quarantined_at,lease_token from async_mirror_inbox where id=$1", [exhausted.id],
    );
    assert.equal(quarantineRow.rows[0]?.status, "QUARANTINED");
    assert.equal(quarantineRow.rows[0]?.attempts, 1);
    assert.ok(quarantineRow.rows[0]?.quarantined_at);
    assert.equal(quarantineRow.rows[0]?.lease_token, null);

    // Existing rows that have already exhausted their retry budget must be swept
    // into quarantine before the claim query can leave them stranded indefinitely.
    const exhaustedRetry = await makeRow("STL-" + suffix.slice(0, 8));
    await pool.query(
      "update async_mirror_inbox set status='RETRY', attempts=3, next_attempt_at=now()-interval '1 second' where id=$1",
      [exhaustedRetry.id],
    );
    const expiredProcessing = await makeRow("EXP-" + suffix.slice(0, 8));
    await pool.query(
      "update async_mirror_inbox set status='PROCESSING', attempts=3, lease_until=now()-interval '1 second' where id=$1",
      [expiredProcessing.id],
    );
    await runGovernmentInboxWorker(pool, undefined, { batchSize: 10, maxAttempts: 3 });
    const swept = await pool.query<{ id: string; status: string; quarantined_at: Date | null; lease_token: string | null }>(
      "select id,status,quarantined_at,lease_token from async_mirror_inbox where id = any($1::uuid[])",
      [[exhaustedRetry.id, expiredProcessing.id]],
    );
    assert.equal(swept.rows.length, 2);
    assert.ok(swept.rows.every(item => item.status === "QUARANTINED"));
    assert.ok(swept.rows.every(item => item.quarantined_at));
    assert.ok(swept.rows.every(item => item.lease_token === null));

    const events = await pool.query<{ to_status: string; attempt: number; payload_sha256: string }>(
      "select to_status,attempt,payload_sha256 from async_mirror_inbox_events where inbox_id=$1 order by id", [recoverable.id],
    );
    assert.deepEqual(events.rows.map(event => [event.to_status, event.attempt]), [
      ["RECEIVED", 0], ["PROCESSING", 1], ["RETRY", 1], ["PROCESSING", 2], ["VALIDATED", 2],
    ]);
    assert.ok(events.rows.every(event => /^[0-9a-f]{64}$/.test(event.payload_sha256)));
    await assert.rejects(
      pool.query("delete from async_mirror_inbox_events where inbox_id=$1", [recoverable.id]),
      /append-only/,
      "transition evidence must remain append-only",
    );
  } finally {
    await pool.end();
  }
});
