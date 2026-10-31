import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { canonicalGovBridgeHash } from "./government-inbox-hash.js";
import { Pool } from "pg";
import { runGovernmentInboxWorker } from "./async-mirror-worker.js";

const enabled = process.env.CI === "true" && process.env.NODE_ENV !== "production"
  && process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const sha = canonicalGovBridgeHash;

test("government inbox worker persists retry recovery, quarantine and append-only transition evidence in disposable PostgreSQL", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: true },
    max: 4,
  });
  const suffix = randomUUID();
  const provisionCrosswalk = async (
    authorityCode: string,
    municipalCode: string,
    timestamp: string,
    scopeKind: "OTHER" | "STATE_UT" | "DISTRICT" | "LOCAL_BODY" = "OTHER",
  ): Promise<{ organizationId: string; geographyId: string; sourceSnapshotId: string }> => {
    const organizationId = randomUUID();
    const requesterId = randomUUID();
    const approverId = randomUUID();
    const geographyId = randomUUID();
    const scopeGeographyId = scopeKind === "OTHER" ? geographyId : randomUUID();
    const scopeDirectorySourceId = randomUUID();
    const scopeCode = "SYNTH-SCOPE-" + authorityCode;
    const scopeGeoKind = scopeKind === "STATE_UT" ? "STATE_UT" : scopeKind === "DISTRICT" ? "DISTRICT" : scopeKind === "LOCAL_BODY" ? "ULB" : "CLUSTER";
    const reason = "Synthetic worker crosswalk acceptance fixture";
    const effectiveFrom = new Date(Date.parse(timestamp) - 24 * 60 * 60 * 1000);
    await pool.query("insert into organizations(id,name,organization_type) values($1,$2,'TEST_FIXTURE')", [organizationId, "Worker crosswalk " + authorityCode]);
    await pool.query("insert into identities(id,display_name) values($1,$2),($3,$4)", [requesterId, "Worker crosswalk requester " + authorityCode, approverId, "Worker crosswalk approver " + authorityCode]);
    if (scopeKind !== "OTHER") {
      await pool.query(
        "insert into geography(id,kind,code,name,source,source_version) values($1,$2,$3,$4,'Synthetic worker fixture','v1')",
        [scopeGeographyId, scopeGeoKind, "WORKER-SCOPE-" + authorityCode, "Worker source scope " + authorityCode],
      );
    }
    await pool.query(
      "insert into geography(id,parent_id,kind,code,name,source,source_version) values($1,$2,'CLUSTER',$3,$4,'Synthetic worker fixture','v1')",
      [geographyId, scopeKind === "OTHER" ? null : scopeGeographyId, "WORKER-GEO-" + authorityCode, "Worker crosswalk geography " + authorityCode],
    );
    await pool.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')", [organizationId, geographyId]);
    const activityId = randomUUID();
    await pool.query("insert into activities(id,organization_id,geography_id,activity_type,status) values($1,$2,$3,'WASTE_WEIGHT_MEASUREMENT','COMPLETED')", [activityId, organizationId, geographyId]);
    const uploaderBytes = Buffer.from("Synthetic reviewed worker crosswalk evidence " + authorityCode);
    const evidenceSha256 = createHash("sha256").update(uploaderBytes).digest("hex");
    const directoryName = scopeKind === "OTHER" ? "Synthetic scope directory" : "Local Government Directory (LGD)";
    await pool.query(
      "insert into geography_sources(id,source_name,source_uri,source_version,checksum,status) values($1,$2,$3,$4,$5,'VERIFIED')",
      [scopeDirectorySourceId, directoryName, "synthetic://scope-directory/" + authorityCode, "synthetic-directory-v1-" + authorityCode, evidenceSha256],
    );
    await pool.query("update geography set external_code=$2,source_id=$3 where id=$1", [scopeGeographyId, scopeCode, scopeDirectorySourceId]);
    const evidenceId = randomUUID();
    const seriesId = randomUUID();
    const artifactVersionId = randomUUID();
    await pool.query("insert into evidence_artifact_series(id,organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,$3,'CROSSWALK_SOURCE_RECORD',$4)", [seriesId, organizationId, activityId, requesterId]);
    await pool.query("insert into evidence(id,activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,$2,'CROSSWALK_SOURCE_RECORD','VERIFIED',now(),$3,$4,$5::jsonb)", [evidenceId, activityId, "db://evidence-vault/" + artifactVersionId, evidenceSha256, JSON.stringify({ source: "synthetic test fixture" })]);
    await pool.query("insert into evidence_artifact_versions(id,series_id,evidence_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id,source_reference) values($1,$2,$3,1,'worker-crosswalk.txt','text/plain',$4,$5,$6,$7,$8)", [artifactVersionId, seriesId, evidenceId, uploaderBytes.length, evidenceSha256, uploaderBytes, requesterId, "synthetic://worker-crosswalk/" + authorityCode]);
    const evidenceReference = "db://evidence-vault/" + artifactVersionId;
    const sourceSnapshotId = randomUUID();
    await pool.query(
      "insert into authoritative_source_snapshots(id,authority_code,source_owner,dataset_code,source_url,source_version,scope_kind,scope_code,scope_geography_id,scope_directory_source_id,content_sha256,record_count,accepted_record_count,unresolved_record_count,validation_status,usage_terms_reference,retrieved_at,retrieved_by_identity_id,reviewed_by_identity_id,reviewed_at) values($1,$2,$2,$3,'https://example.invalid/worker-crosswalk-source','synthetic-source-v1',$4,$5,$6,$7,$8,1,1,0,'APPROVED','synthetic://worker-fixture-terms',now(),$9,$10,now())",
      [sourceSnapshotId, authorityCode, "WORKER_SOURCE_" + authorityCode, scopeKind, scopeCode, scopeGeographyId, scopeDirectorySourceId, evidenceSha256, requesterId, approverId],
    );
    const requestHash = sha(JSON.stringify({ authorityCode, municipalCode, sourceVersion: "synthetic-source-v1", sourceSnapshotId, organizationId, geographyId, evidenceSha256, effectiveFrom }));
    const request = await pool.query<{ id: string }>(
      `insert into government_jurisdiction_crosswalk_requests
        (authority_code,municipal_code,source_version,source_snapshot_id,organization_id,geography_id,effective_from,evidence_reference,evidence_sha256,request_reason,request_hash,requested_by_identity_id)
       values($1,$2,'synthetic-source-v1',$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [authorityCode, municipalCode, sourceSnapshotId, organizationId, geographyId, effectiveFrom, evidenceReference, evidenceSha256, reason, requestHash, requesterId],
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
        (authority_code,municipal_code,source_version,source_snapshot_id,organization_id,geography_id,status,evidence_reference,evidence_sha256,
         requested_by_identity_id,approved_by_identity_id,approval_reason,approval_request_id,effective_from,verified_at)
       values($1,$2,'synthetic-source-v1',$3,$4,$5,'VERIFIED',$6,$7,$8,$9,$10,$11,$12,now())`,
      [authorityCode, municipalCode, sourceSnapshotId, organizationId, geographyId, evidenceReference, evidenceSha256, requesterId, approverId, decisionReason, requestId, effectiveFrom],
    );
    return { organizationId, geographyId, sourceSnapshotId };
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
    const recoverableAuthority = "TST-" + suffix.slice(0, 8).toUpperCase();
    const expectedCrosswalk = await provisionCrosswalk(recoverableAuthority, "TEST-MUNI", new Date().toISOString());
    const recoverable = await makeRow(recoverableAuthority);

    // Administrative source scope codes must resolve through a verified, versioned LGD node.
    for (const kind of ["STATE_UT", "DISTRICT", "LOCAL_BODY"] as const) {
      const authority = "SCP-" + kind.slice(0, 3) + "-" + suffix.slice(0, 6).toUpperCase();
      const scoped = await provisionCrosswalk(authority, "TEST-MUNI", new Date().toISOString(), kind);
      const covered = await pool.query<{ covered: boolean }>(
        "select government_source_scope_covers_geography($1,$2) as covered",
        [scoped.sourceSnapshotId, scoped.geographyId],
      );
      assert.equal(covered.rows[0]?.covered, true, kind + " scope must cover its descendant geography");
      const scopeBinding = await pool.query<{ scope_geography_id: string; scope_directory_source_id: string }>(
        "select scope_geography_id,scope_directory_source_id from authoritative_source_snapshots where id=$1",
        [scoped.sourceSnapshotId],
      );
      await assert.rejects(
        pool.query("update geography set external_code=$2 where id=$1", [scopeBinding.rows[0]!.scope_geography_id, "MUTATED-SCOPE-CODE"]),
        /APPROVED_SOURCE_SCOPE_GEOGRAPHY_IMMUTABLE/,
        "approved scope geography code binding must be immutable",
      );
      await assert.rejects(
        pool.query("update geography_sources set checksum=$2 where id=$1", [scopeBinding.rows[0]!.scope_directory_source_id, "0".repeat(64)]),
        /APPROVED_SOURCE_SCOPE_DIRECTORY_IMMUTABLE/,
        "approved directory source checksum must be immutable",
      );
      await assert.rejects(
        pool.query("update geography set parent_id=null where id=$1", [scoped.geographyId]),
        /APPROVED_SOURCE_SCOPE_GEOGRAPHY_IMMUTABLE/,
        "approved source scope descendant hierarchy must be immutable",
      );
      const outsideId = randomUUID();
      await pool.query(
        "insert into geography(id,kind,code,name,source,source_version) values($1,'CLUSTER',$2,$3,'Synthetic unrelated fixture','v1')",
        [outsideId, "OUTSIDE-" + kind + "-" + suffix.slice(0, 6), "Outside scope " + kind],
      );
      const outside = await pool.query<{ covered: boolean }>(
        "select government_source_scope_covers_geography($1,$2) as covered",
        [scoped.sourceSnapshotId, outsideId],
      );
      assert.equal(outside.rows[0]?.covered, false, kind + " scope must not cover unrelated geography");

      await pool.query(
        "update geography_sources set status='UNAVAILABLE' where id=$1",
        [scopeBinding.rows[0]!.scope_directory_source_id],
      );
      const unavailableDirectory = await pool.query<{ covered: boolean }>(
        "select government_source_scope_covers_geography($1,$2) as covered",
        [scoped.sourceSnapshotId, scoped.geographyId],
      );
      assert.equal(unavailableDirectory.rows[0]?.covered, false, kind + " scope must stop resolving when its directory source is unavailable");

      await assert.rejects(
        pool.query(
          "insert into geography(id,parent_id,kind,code,name,source,source_version) values($1,$2,'CLUSTER',$3,$4,'Synthetic expansion attempt','v1')",
          [randomUUID(), scopeBinding.rows[0]!.scope_geography_id, "EXPAND-ROOT-" + kind + "-" + suffix.slice(0, 6), "Attempted child under approved scope"],
        ),
        /APPROVED_SOURCE_SCOPE_HIERARCHY_EXPANSION_FORBIDDEN/,
        "new descendants must not expand an approved source scope",
      );
      await assert.rejects(
        pool.query("update geography set parent_id=$2 where id=$1", [outsideId, scopeBinding.rows[0]!.scope_geography_id]),
        /APPROVED_SOURCE_SCOPE_HIERARCHY_EXPANSION_FORBIDDEN/,
        "an unrelated geography must not be reparented into an approved source scope",
      );
      await assert.rejects(
        pool.query(
          "insert into geography(id,parent_id,kind,code,name,source,source_version) values($1,$2,'CLUSTER',$3,$4,'Synthetic expansion attempt','v1')",
          [randomUUID(), scoped.geographyId, "EXPAND-DESC-" + kind + "-" + suffix.slice(0, 6), "Attempted grandchild under approved descendant"],
        ),
        /APPROVED_SOURCE_SCOPE_HIERARCHY_EXPANSION_FORBIDDEN/,
        "new descendants must not expand an approved source scope below its root",
      );
    }
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

    // Retiring a source snapshot must stop new inbox batches from resolving through
    // mappings grounded in that snapshot. Historical validated rows remain unchanged.
    const retiredAuthority = "RTA-" + suffix.slice(0, 8).toUpperCase();
    const retiredFixture = await provisionCrosswalk(retiredAuthority, "RET-MUNI", new Date().toISOString());
    await pool.query("update authoritative_source_snapshots set validation_status='RETIRED' where id=$1", [retiredFixture.sourceSnapshotId]);
    const retiredBatchId = randomUUID();
    const retiredTimestamp = new Date().toISOString();
    const retiredPayload = {
      batchMetadata: { authorityCode: retiredAuthority, municipalCode: "RET-MUNI", batchId: retiredBatchId,
        syncWindowTimestamp: retiredTimestamp, sourceVersion: "synthetic-source-v1" },
      rawDataLogs: ["Synthetic retired-source waste intake record"],
    };
    const retiredInsert = await pool.query<{ id: string }>(
      `insert into async_mirror_inbox(authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,status,attempts,received_at)
       values($1,'RET-MUNI',$2,$3,$4::jsonb,$5,'RECEIVED',0,now()-interval '2 minutes') returning id`,
      [retiredAuthority, retiredBatchId, retiredTimestamp, JSON.stringify(retiredPayload), sha(retiredPayload)],
    );
    await runGovernmentInboxWorker(pool, undefined, { batchSize: 10, maxAttempts: 3 });
    const retiredRow = await pool.query<{ status: string; last_error_code: string | null }>(
      "select status,last_error_code from async_mirror_inbox where id=$1", [retiredInsert.rows[0]!.id],
    );
    assert.equal(retiredRow.rows[0]?.status, "UNRESOLVED");
    assert.equal(retiredRow.rows[0]?.last_error_code, "GOVERNMENT_CROSSWALK_NOT_FOUND");

    // Approved source snapshot provenance is immutable at the database layer, so a
    // post-approval source_version mutation is not a valid fixture. Existing tests
    // cover retired snapshots; resolver query also binds snapshot identity/date.
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

    // A PROCESSING row with a NULL lease must be recoverable, not stranded.
    const nullLease = await makeRow("NUL-" + suffix.slice(0, 8));
    await pool.query(
      "update async_mirror_inbox set status='PROCESSING', attempts=1, lease_token=null, lease_until=null where id=$1",
      [nullLease.id],
    );
    await runGovernmentInboxWorker(pool, undefined, { batchSize: 10, maxAttempts: 3 });
    const nullLeaseRow = await pool.query<{ status: string; attempts: number }>(
      "select status,attempts from async_mirror_inbox where id=$1", [nullLease.id],
    );
    assert.equal(nullLeaseRow.rows[0]?.status, "UNRESOLVED");
    assert.equal(nullLeaseRow.rows[0]?.attempts, 2);

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

    // Concurrent workers must not claim the same row while the first validator is in flight.
    const concurrentAuthority = "TST-" + suffix.slice(8, 16).toUpperCase();
    await provisionCrosswalk(concurrentAuthority, "TEST-MUNI", new Date().toISOString());
    const concurrent = await makeRow(concurrentAuthority);
    let releaseConcurrentValidation: () => void = () => {};
    let signalConcurrentValidation: () => void = () => {};
    const concurrentValidationStarted = new Promise<void>(resolve => { signalConcurrentValidation = resolve; });
    const concurrentValidationGate = new Promise<void>(resolve => { releaseConcurrentValidation = resolve; });
    const firstConcurrentWorker = runGovernmentInboxWorker(pool, async () => {
      signalConcurrentValidation();
      await concurrentValidationGate;
      return { valid: true, summary: { officialAcceptance: false, authoritativeMrvMutation: false, guardianSubmission: false } };
    }, { batchSize: 1, maxAttempts: 3 });
    await concurrentValidationStarted;
    const secondConcurrentWorker = await runGovernmentInboxWorker(pool, async () => ({
      valid: true,
      summary: { officialAcceptance: false, authoritativeMrvMutation: false, guardianSubmission: false },
    }), { batchSize: 1, maxAttempts: 3 });
    assert.equal(secondConcurrentWorker.claimed, 0, "a concurrent worker must not claim the row already leased by the first worker");
    releaseConcurrentValidation();
    await firstConcurrentWorker;
    const concurrentFinal = await pool.query<{ status: string; attempts: number }>(
      "select status,attempts from async_mirror_inbox where id=$1", [concurrent.id],
    );
    assert.equal(concurrentFinal.rows[0]?.status, "VALIDATED");
    assert.equal(concurrentFinal.rows[0]?.attempts, 1);

    // Lease expiry alone revokes completion authority, even before another worker takes over.
    const expiredAuthority = "EXP-" + suffix.slice(8, 16).toUpperCase();
    await provisionCrosswalk(expiredAuthority, "TEST-MUNI", new Date().toISOString());
    const expiredInFlight = await makeRow(expiredAuthority);
    let releaseExpiredValidation: () => void = () => {};
    let signalExpiredValidation: () => void = () => {};
    const expiredValidationStarted = new Promise<void>(resolve => { signalExpiredValidation = resolve; });
    const expiredValidationGate = new Promise<void>(resolve => { releaseExpiredValidation = resolve; });
    const expiredWorker = runGovernmentInboxWorker(pool, async () => {
      signalExpiredValidation();
      await expiredValidationGate;
      return { valid: true, summary: { officialAcceptance: false, authoritativeMrvMutation: false, guardianSubmission: false } };
    }, { batchSize: 1, leaseSeconds: 15, maxAttempts: 3 });
    await expiredValidationStarted;
    await pool.query(
      "update async_mirror_inbox set lease_until=now()-interval '1 second' where id=$1 and status='PROCESSING'",
      [expiredInFlight.id],
    );
    releaseExpiredValidation();
    await expiredWorker;
    const expiredAfterOldWorker = await pool.query<{ status: string; lease_token: string | null; lease_until: Date | null }>(
      "select status,lease_token,lease_until from async_mirror_inbox where id=$1", [expiredInFlight.id],
    );
    assert.equal(expiredAfterOldWorker.rows[0]?.status, "PROCESSING");
    assert.ok(expiredAfterOldWorker.rows[0]?.lease_token);
    assert.ok(expiredAfterOldWorker.rows[0]?.lease_until && expiredAfterOldWorker.rows[0]!.lease_until! < new Date());

    // The next worker may reclaim the expired row and commit under its new token.
    const afterExpiryReclaim = await runGovernmentInboxWorker(pool, undefined, { batchSize: 1, maxAttempts: 3 });
    assert.equal(afterExpiryReclaim.claimed, 1);
    const expiredAfterReclaim = await pool.query<{ status: string; attempts: number }>(
      "select status,attempts from async_mirror_inbox where id=$1", [expiredInFlight.id],
    );
    assert.equal(expiredAfterReclaim.rows[0]?.status, "VALIDATED");
    assert.equal(expiredAfterReclaim.rows[0]?.attempts, 2);

    // A worker whose lease token has been superseded must not overwrite the newer lease owner's state.
    const staleAuthority = "STL-" + suffix.slice(0, 8).toUpperCase();
    await provisionCrosswalk(staleAuthority, "TEST-MUNI", new Date().toISOString());
    const stale = await makeRow(staleAuthority);
    let releaseStaleValidation: () => void = () => {};
    let signalStaleValidation: () => void = () => {};
    const staleValidationStarted = new Promise<void>(resolve => { signalStaleValidation = resolve; });
    const staleValidationGate = new Promise<void>(resolve => { releaseStaleValidation = resolve; });
    const staleWorker = runGovernmentInboxWorker(pool, async () => {
      signalStaleValidation();
      await staleValidationGate;
      return { valid: true, summary: { officialAcceptance: false, authoritativeMrvMutation: false, guardianSubmission: false } };
    }, { batchSize: 1, maxAttempts: 3 });
    await staleValidationStarted;
    const supersededToken = randomUUID();
    await pool.query(
      "update async_mirror_inbox set lease_token=$2,lease_until=now()+interval '120 seconds' where id=$1 and status='PROCESSING'",
      [stale.id, supersededToken],
    );
    releaseStaleValidation();
    await staleWorker;
    const staleFinal = await pool.query<{ status: string; lease_token: string | null }>(
      "select status,lease_token from async_mirror_inbox where id=$1", [stale.id],
    );
    assert.equal(staleFinal.rows[0]?.status, "PROCESSING", "stale worker must not commit a terminal status after its lease token is replaced");
    assert.equal(staleFinal.rows[0]?.lease_token, supersededToken, "newer lease token must remain authoritative");

    // The migration's per-jurisdiction advisory lock serializes crosswalk mutation
    // with the worker's resolution+terminal transaction, including concurrent inserts.
    const lockedAuthority = "LCK-" + suffix.slice(0, 8).toUpperCase();
    await provisionCrosswalk(lockedAuthority, "LOCK-MUNI", new Date().toISOString());
    const lockedCrosswalk = await pool.query<{ id: string }>(
      "select id from government_jurisdiction_crosswalks where authority_code=$1 and municipal_code='LOCK-MUNI' and status='VERIFIED'",
      [lockedAuthority],
    );
    assert.equal(lockedCrosswalk.rows.length, 1);
    const resolutionKey = [lockedAuthority, "LOCK-MUNI", "synthetic-source-v1"].join(String.fromCharCode(31));
    const lockOwner = await pool.connect();
    const lockContender = await pool.connect();
    try {
      await lockOwner.query("BEGIN");
      await lockOwner.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [resolutionKey]);
      await lockContender.query("BEGIN");
      await lockContender.query("SET LOCAL lock_timeout='150ms'");
      await assert.rejects(
        lockContender.query(
          "update government_jurisdiction_crosswalks set status='REVOKED', revoked_at=now() where id=$1",
          [lockedCrosswalk.rows[0]!.id],
        ),
        (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && (error as { code: string }).code === "55P03"),
        "crosswalk revocation must wait while an inbox resolution owns the jurisdiction key",
      );
      await lockContender.query("ROLLBACK");
      await lockOwner.query("COMMIT");
      await lockContender.query(
        "update government_jurisdiction_crosswalks set status='REVOKED', revoked_at=now() where id=$1",
        [lockedCrosswalk.rows[0]!.id],
      );
    } finally {
      await lockOwner.query("ROLLBACK").catch(() => undefined);
      await lockContender.query("ROLLBACK").catch(() => undefined);
      lockOwner.release();
      lockContender.release();
    }

    // Strict validator deadline aborts cooperative work and persists a bounded retry.
    const timeoutRow = await makeRow("TMO-" + suffix.slice(8, 16).toUpperCase());
    let timeoutSignal: AbortSignal | undefined;
    const timeoutResult = await runGovernmentInboxWorker(pool, async (input) => {
      timeoutSignal = input.signal;
      return new Promise((_resolve, reject) => {
        input.signal?.addEventListener("abort", () => reject(input.signal?.reason ?? new Error("aborted")), { once: true });
      });
    }, { batchSize: 1, leaseSeconds: 15, validationTimeoutSeconds: 1, leaseRenewalSeconds: 1, maxAttempts: 3 });
    assert.equal(timeoutResult.retried, 1);
    assert.equal(timeoutSignal?.aborted, true);
    const timedOut = await pool.query<{ status: string; last_error_code: string }>(
      "select status,last_error_code from async_mirror_inbox where id=$1", [timeoutRow.id],
    );
    assert.equal(timedOut.rows[0]?.status, "RETRY");
    assert.equal(timedOut.rows[0]?.last_error_code, "VALIDATION_TIMEOUT");

    // A long but bounded validator keeps its lease alive through periodic renewal.
    const renewedAuthority = "REN-" + suffix.slice(8, 16).toUpperCase();
    await provisionCrosswalk(renewedAuthority, "TEST-MUNI", new Date().toISOString());
    const renewedRow = await makeRow(renewedAuthority);
    let signalRenewalValidation: () => void = () => {};
    const renewalValidationStarted = new Promise<void>((resolve) => { signalRenewalValidation = resolve; });
    const renewedWorker = runGovernmentInboxWorker(pool, async () => {
      signalRenewalValidation();
      await new Promise((resolve) => setTimeout(resolve, 6200));
      return { valid: true, summary: { officialAcceptance: false, authoritativeMrvMutation: false, guardianSubmission: false } };
    }, { batchSize: 1, leaseSeconds: 15, validationTimeoutSeconds: 10, leaseRenewalSeconds: 1, maxAttempts: 3 });
    await renewalValidationStarted;
    await new Promise((resolve) => setTimeout(resolve, 1300));
    const leaseDuringValidation = await pool.query<{ lease_until: Date }>(
      "select lease_until from async_mirror_inbox where id=$1", [renewedRow.id],
    );
    assert.ok(leaseDuringValidation.rows[0]!.lease_until.getTime() > Date.now() + 10_000,
      "the active lease must be extended beyond its original 15-second window");
    const renewedResult = await renewedWorker;
    assert.equal(renewedResult.validated, 1);
    const renewedFinal = await pool.query<{ status: string }>(
      "select status from async_mirror_inbox where id=$1", [renewedRow.id],
    );
    assert.equal(renewedFinal.rows[0]?.status, "VALIDATED");

  } finally {
    await pool.end();
  }
});


test("production-shaped non-superuser migration principal can transfer a SECURITY DEFINER trigger to a NOLOGIN capability role", {
  skip: !enabled ? "requires disposable CI PostgreSQL" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: true },
    max: 2,
  });
  const suffix = randomUUID().replace(/-/g, "").slice(0, 16);
  const principal = "ci_migration_" + suffix;
  const writer = "ci_event_writer_" + suffix;
  const target = "ci_events_" + suffix;
  const source = "ci_source_" + suffix;
  const functionName = "ci_record_event_" + suffix;
  const triggerName = "ci_capture_event_" + suffix;
  const client = await pool.connect();
  let databaseName = "";
  let originalDatabaseOwner = "";
  try {
    const identity = await client.query<{ database_name: string; original_owner: string }>(
      "select current_database() as database_name,current_user as original_owner",
    );
    databaseName = identity.rows[0]!.database_name;
    originalDatabaseOwner = identity.rows[0]!.original_owner;
    // Match the live Neon migration principal's observed role attributes and database ownership,
    // which makes it an implicit member of pg_database_owner (owner of public schema).
    await client.query(`create role "${principal}" nologin nosuperuser createdb createrole replication bypassrls`);
    await client.query(`alter database "${databaseName}" owner to "${principal}"`);
    await client.query(`create table public."${target}" (id bigserial primary key, value text not null)`);
    await client.query(`create table public."${source}" (value text not null)`);
    await client.query(`grant usage, create on schema public to "${principal}"`);
    await client.query(`grant insert on table public."${target}" to "${principal}"`);
    await client.query(`grant usage, select on sequence public."${target}_id_seq" to "${principal}"`);

    await client.query(`set role "${principal}"`);
    await client.query(`create role "${writer}" nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls`);
    await client.query(`grant usage on schema public to "${writer}"`);
    await client.query(`grant insert on table public."${target}" to "${writer}"`);
    await client.query(`grant create on schema public to "${writer}"`);
    await client.query(`grant "${writer}" to current_user`);
    await client.query(`
      create function public."${functionName}"() returns trigger
      language plpgsql security definer
      set search_path = pg_catalog, public
      as $$
      begin
        insert into public."${target}"(value) values(new.value);
        return new;
      end
      $$`);
    await client.query(`alter function public."${functionName}"() owner to "${writer}"`);
    await client.query(`revoke create on schema public from "${writer}"`);
    await client.query(`revoke "${writer}" from current_user`);
    await client.query(`revoke all on function public."${functionName}"() from public`);
    await client.query("reset role");

    await client.query(`create trigger "${triggerName}" before insert on public."${source}" for each row execute function public."${functionName}"()`);
    await client.query(`insert into public."${source}"(value) values('least-privilege-trigger-ok')`);
    const verification = await client.query<{ owner: string; security_definer: boolean; config: string[] | null; inserted: string }>(
      `select pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,p.proconfig as config,
              (select value from public."${target}" order by id desc limit 1) as inserted
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname=$1`,
      [functionName],
    );
    assert.equal(verification.rows[0]?.owner, writer);
    assert.equal(verification.rows[0]?.security_definer, true);
    assert.ok(verification.rows[0]?.config?.some((value) => value.includes("search_path=pg_catalog, public")));
    assert.equal(verification.rows[0]?.inserted, "least-privilege-trigger-ok");
    const writerRole = await client.query<{ rolcanlogin: boolean; rolsuper: boolean; rolcreaterole: boolean; rolcreatedb: boolean; rolbypassrls: boolean }>(
      "select rolcanlogin,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls from pg_roles where rolname=$1",
      [writer],
    );
    assert.deepEqual(writerRole.rows[0], {
      rolcanlogin: false, rolsuper: false, rolcreaterole: false, rolcreatedb: false, rolbypassrls: false,
    });
  } finally {
    await client.query("reset role").catch(() => undefined);
    await client.query(`drop trigger if exists "${triggerName}" on public."${source}"`).catch(() => undefined);
    await client.query(`drop function if exists public."${functionName}"()`).catch(() => undefined);
    await client.query(`drop table if exists public."${source}", public."${target}" cascade`).catch(() => undefined);
    await client.query(`drop owned by "${writer}"`).catch(() => undefined);
    await client.query(`drop role if exists "${writer}"`).catch(() => undefined);
    if (databaseName && originalDatabaseOwner) {
      await client.query(`alter database "${databaseName}" owner to "${originalDatabaseOwner}"`).catch(() => undefined);
    }
    await client.query(`drop owned by "${principal}"`).catch(() => undefined);
    await client.query(`drop role if exists "${principal}"`).catch(() => undefined);
    client.release();
    await pool.end();
  }
});
