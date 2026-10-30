import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

const url = process.env.DATABASE_URL;
const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1";

type UseKind = "issuance" | "transfer" | "settlement";
type Fixture = {
  organizationId: string;
  foreignOrganizationId: string;
  activityId: string;
  identityId: string;
  reviewerId: string;
  instrumentId: string;
  evidenceId: string;
  artifactId: string;
  credentialId: string;
};

test("PostgreSQL serializes evidence rejection against credential issuance, transfer, and settlement on two sessions", {
  skip: !url || !enabled,
  timeout: 120_000,
}, async () => {
  assert.ok(url);
  // The CI job runs against a disposable PostgreSQL database. Use distinct sessions
  // and committed fixtures: an uncommitted fixture in one session is invisible to the other.
  // Every run uses a unique UUID suffix so no scenario can reuse another scenario's evidence.
  const pool = new Pool({
    connectionString: url,
    max: 8,
    application_name: "rupaykg-mrv-concurrency-test",
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });

  try {
    for (const kind of ["issuance", "transfer", "settlement"] as const) {
      await exerciseRace(pool, kind, "use-first");
      await exerciseRace(pool, kind, "rejection-first");
    }
  } finally {
    await pool.end();
  }
});

async function exerciseRace(
  pool: Pool,
  kind: UseKind,
  winner: "use-first" | "rejection-first",
): Promise<void> {
  const suffix = randomUUID();
  const fixture = await createFixture(pool, suffix);
  const useClient = await pool.connect();
  const reviewClient = await pool.connect();
  const observer = await pool.connect();
  try {
    const useApp = `mrv-use-${suffix.slice(0, 8)}`;
    const reviewApp = `mrv-rej-${suffix.slice(0, 8)}`;
    await useClient.query("select set_config('application_name',$1,false)", [useApp]);
    await reviewClient.query("select set_config('application_name',$1,false)", [reviewApp]);
    await observer.query("select set_config('application_name',$1,false)", [`mrv-obs-${suffix.slice(0, 8)}`]);

    if (winner === "use-first") {
      await useClient.query("begin");
      await performUse(useClient, kind, fixture, suffix);
      await reviewClient.query("begin");
      const rejection = rejectEvidence(reviewClient, fixture);
      await waitUntilBlocked(observer, reviewApp);
      await useClient.query("commit");
      await rejection;
      await reviewClient.query("commit");
    } else {
      await reviewClient.query("begin");
      await lockEvidenceForReview(reviewClient, fixture);
      await useClient.query("begin");
      const useAttempt = performUse(useClient, kind, fixture, suffix);
      await waitUntilBlocked(observer, useApp);
      await rejectEvidenceAfterLocks(reviewClient, fixture);
      await reviewClient.query("commit");
      await assert.rejects(useAttempt, errorPattern(kind));
      await useClient.query("rollback");
    }

    // After rejection commits, all value-bearing uses must re-check current evidence.
    const verifyClient = await pool.connect();
    try {
      await verifyClient.query("begin");
      const followUpKind: UseKind = kind === "issuance" ? "transfer" : kind;
      await assert.rejects(
        performUse(verifyClient, followUpKind, fixture, `post-rejection-${suffix}`),
        errorPattern(followUpKind),
      );
      await verifyClient.query("rollback");
    } finally {
      verifyClient.release();
    }
  } catch (error) {
    await useClient.query("rollback").catch(() => undefined);
    await reviewClient.query("rollback").catch(() => undefined);
    throw new Error(`${kind} / ${winner} concurrency case failed: ${String(error)}`, { cause: error });
  } finally {
    useClient.release();
    reviewClient.release();
    observer.release();
  }
}

function errorPattern(kind: UseKind): RegExp {
  if (kind === "issuance") return /CREDENTIAL_MRV_INSTRUMENT_EVIDENCE_REQUIRED/i;
  if (kind === "transfer") return /REGISTRY_MRV_EVIDENCE_STALE/i;
  return /SETTLEMENT_MRV_EVIDENCE_STALE/i;
}

async function performUse(client: PoolClient, kind: UseKind, f: Fixture, nonce: string): Promise<void> {
  if (kind === "issuance") {
    await client.query("update credentials set status='ISSUED' where id=$1", [f.credentialId]);
  } else if (kind === "transfer") {
    await client.query(
      "insert into registry_events(credential_id,event_type,event_hash,from_owner_id,to_owner_id,recorded_by_identity_id) values($1,'TRANSFERRED',$2,$3,$4,$5)",
      [f.credentialId, createHash("sha256").update(nonce).digest("hex"), f.organizationId, f.foreignOrganizationId, f.reviewerId],
    );
  } else {
    // Settlement requires a registry-backed current owner; do not fabricate ownership
    // through settlement fields alone. Seed the fixture's authoritative issuance event.
    await client.query(
      "insert into registry_events(credential_id,event_type,event_hash,to_owner_id,recorded_by_identity_id) values($1,'ISSUED',$2,$3,$4)",
      [f.credentialId, createHash("sha256").update(`registry-issue-${nonce}`).digest("hex"), f.organizationId, f.reviewerId],
    );
    // The settlement lifecycle intentionally only permits creation in CREATED/ELIGIBLE.
    // Exercise the guarded value-bearing transition separately, in the same transaction.
    const settlement = await client.query<{ id: string }>(
      "insert into settlements(credential_id,payer_id,payee_id,amount,currency,status,authorization_reference,verified_at) values($1,$2,$3,1,'INR','CREATED',$4,now()) returning id",
      [f.credentialId, f.organizationId, f.foreignOrganizationId, `AUTH-${nonce}`],
    );
    await client.query("update settlements set status='AUTHORIZED' where id=$1", [settlement.rows[0]!.id]);
    await client.query("update settlements set status='EXECUTING' where id=$1", [settlement.rows[0]!.id]);
  }
}

async function lockEvidenceForReview(client: PoolClient, f: Fixture): Promise<void> {
  await client.query("select id from mrv_instruments where id=$1 order by id for update", [f.instrumentId]);
  await client.query("select id from evidence where id=$1 for update", [f.evidenceId]);
}

async function rejectEvidence(client: PoolClient, f: Fixture): Promise<void> {
  await lockEvidenceForReview(client, f);
  await rejectEvidenceAfterLocks(client, f);
}

async function rejectEvidenceAfterLocks(client: PoolClient, f: Fixture): Promise<void> {
  await client.query(
    "insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale) values($1,$2,$3,'REJECTED','Deterministic two-session concurrency regression')",
    [f.evidenceId, f.artifactId, f.reviewerId],
  );
  await client.query("update evidence set status='REJECTED' where id=$1", [f.evidenceId]);
}

async function waitUntilBlocked(observer: PoolClient, applicationName: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const r = await observer.query<{ blocked: boolean }>(
      "select exists(select 1 from pg_stat_activity where application_name=$1 and wait_event_type='Lock' and state='active') blocked",
      [applicationName],
    );
    if (r.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for PostgreSQL lock wait: ${applicationName}`);
}

async function createFixture(pool: Pool, suffix: string): Promise<Fixture> {
  const c = await pool.connect();
  try {
    const organizationId = (await c.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`mrv-concurrency-org-${suffix}`],
    )).rows[0]!.id;
    const foreignOrganizationId = (await c.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`mrv-concurrency-foreign-${suffix}`],
    )).rows[0]!.id;
    const geographyId = (await c.query<{ id: string }>(
      "insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id",
      [`MRV-CONCURRENCY-${suffix}`, `MRV concurrency test ${suffix}`],
    )).rows[0]!.id;
    await c.query("insert into organization_geography_scopes(organization_id,geography_id) values($1,$2)", [organizationId, geographyId]);
    const identityId = (await c.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`mrv-concurrency-uploader-${suffix}`, "MRV concurrency uploader"],
    )).rows[0]!.id;
    const reviewerId = (await c.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`mrv-concurrency-reviewer-${suffix}`, "MRV concurrency reviewer"],
    )).rows[0]!.id;
    const reviewerRoleId = (await c.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions) values($1,$2,'[\"VERIFY_EVIDENCE\",\"TRANSFER_CREDENTIAL\",\"ISSUE_CREDENTIAL\"]'::jsonb) returning id",
      [organizationId, `MRV-CONCURRENCY-REVIEWER-${suffix}`],
    )).rows[0]!.id;
    await c.query(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
      [reviewerId, organizationId, reviewerRoleId],
    );
    const activityId = (await c.query<{ id: string }>(
      "insert into activities(organization_id,actor_identity_id,geography_id,activity_type,occurred_at) values($1,$2,$3,'MRV_CONCURRENCY_TEST',now()) returning id",
      [organizationId, identityId, geographyId],
    )).rows[0]!.id;

    const meity = await createReviewedArtifact(c, organizationId, activityId, identityId, reviewerId, "MEITY_CERTIFICATE", `MeitY evidence ${suffix}`);
    const calibration = await createReviewedArtifact(c, organizationId, activityId, identityId, reviewerId, "CALIBRATION_CERTIFICATE", `Calibration evidence ${suffix}`);
    const datasheet = await createReviewedArtifact(c, organizationId, activityId, identityId, reviewerId, "MANUFACTURER_DATASHEET", `Parameter datasheet ${suffix}`);

    const instrumentId = (await c.query<{ id: string }>(
      "insert into mrv_instruments(organization_id,instrument_code,instrument_type,manufacturer,model,sku_revision,intended_use,supported_parameter_codes,registered_by_identity_id) values($1,$2,'GAS_FLOW','Test Manufacturer','Flow Model 1','Rev A','Concurrency test flow measurement',array['gas_flow'],$3) returning id",
      [organizationId, `FLOW-CONCURRENCY-${suffix}`, identityId],
    )).rows[0]!.id;
    await c.query(
      "insert into mrv_instrument_parameter_specs(instrument_id,parameter_code,unit,minimum_value,maximum_value,resolution,accuracy_absolute,accuracy_basis,source_evidence_artifact_version_id,created_by_identity_id) values($1,'gas_flow','m3/h',0,500,0.1,0.5,'concurrency test specification',$2,$3)",
      [instrumentId, datasheet.id, identityId],
    );
    await c.query(
      "update mrv_instruments set approval_status='VERIFIED',meity_certificate_id='MEITY-CONC-TEST',meity_issuer='Test authority',meity_certificate_scope='Exact model/SKU revision',meity_verification_url='https://official.example.gov/test',meity_evidence_reference='evidence://meity-test',meity_evidence_sha256=$2,meity_evidence_artifact_version_id=$3,meity_verified_at=now(),meity_validity_basis='VALID_UNTIL',meity_valid_until=now()+interval '1 year',calibration_required=true,calibration_status='VERIFIED',calibration_certificate_id='CAL-CONC-TEST',calibration_evidence_reference='evidence://cal-test',calibration_evidence_sha256=$4,calibration_evidence_artifact_version_id=$5,calibration_lab='Traceable test lab',calibration_traceability='Test national standard traceability',calibration_uncertainty=0.2,calibration_valid_until=now()+interval '1 year',security_review_status='NOT_APPLICABLE_WITH_JUSTIFICATION',security_not_applicable_reason='Non-firmware test instrument',reviewed_by_identity_id=$6,reviewed_at=now(),review_note='Concurrency test instrument approval' where id=$1",
      [instrumentId, meity.sha256, meity.id, calibration.sha256, calibration.id, reviewerId],
    );
    await c.query(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,mrv_instrument_id,parameter_code) values($1,2,'m3/h','test','two-session concurrency fixture',now(),$2,'gas_flow')",
      [activityId, instrumentId],
    );
    const verificationId = (await c.query<{ id: string }>(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','MRV concurrency fixture','test-only fixture') returning id",
      [meity.evidenceId, activityId, reviewerId],
    )).rows[0]!.id;
    // Synthetic provenance exists only in the disposable CI database to satisfy
    // the independent issuance prerequisite; it is not real Guardian/Hedera proof.
    await c.query(
      "insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,methodology_code,mirror_node_verified_at,metadata) values($1,$2,$3,'TEST-ONLY-POLICY',$4,'VERIFIED','CONSENSUS_CONFIRMED','test-topic',$5,'2026-10-30T00:00:00.000Z',$6,'TEST-ONLY',now(),'{\"testOnly\":true}'::jsonb)",
      [activityId, verificationId, meity.evidenceId, `test-guardian-${suffix}`, `test-hcs-tx-${suffix}`, createHash("sha256").update(suffix).digest("hex")],
    );
    const credentialId = (await c.query<{ id: string }>(
      "insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id) values($1,$2,'MRV-CONCURRENCY-ROOT','ELIGIBLE',$3) returning id",
      [activityId, organizationId, verificationId],
    )).rows[0]!.id;

    return { organizationId, foreignOrganizationId, activityId, identityId, reviewerId, instrumentId, evidenceId: meity.evidenceId, artifactId: meity.id, credentialId };
  } finally {
    c.release();
  }
}

async function createReviewedArtifact(
  client: PoolClient,
  organizationId: string,
  activityId: string,
  uploaderId: string,
  reviewerId: string,
  evidenceType: string,
  contentText: string,
): Promise<{ id: string; sha256: string; evidenceId: string }> {
  const bytes = Buffer.from(contentText, "utf8");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const seriesId = (await client.query<{ id: string }>(
    "insert into evidence_artifact_series(organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,$3,$4) returning id",
    [organizationId, activityId, evidenceType, uploaderId],
  )).rows[0]!.id;
  const evidenceId = (await client.query<{ id: string }>(
    "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,$2,'VERIFIED',now(),'db://evidence-vault/pending',$3,'{}'::jsonb) returning id",
    [activityId, evidenceType, sha256],
  )).rows[0]!.id;
  const artifactId = (await client.query<{ id: string }>(
    "insert into evidence_artifact_versions(series_id,evidence_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id,source_reference) values($1,$2,1,$3,'text/plain',$4,$5,$6,$7,$8) returning id",
    [seriesId, evidenceId, `${evidenceType.toLowerCase()}-concurrency-test.txt`, bytes.length, sha256, bytes, uploaderId, "https://official.example.gov/test-evidence"],
  )).rows[0]!.id;
  await client.query("update evidence set content_uri=$2 where id=$1", [evidenceId, `db://evidence-vault/${artifactId}`]);
  await client.query(
    "insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale) values($1,$2,$3,'APPROVED','Independent concurrency fixture review')",
    [evidenceId, artifactId, reviewerId],
  );
  return { id: artifactId, sha256, evidenceId };
}
