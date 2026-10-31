import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import Fastify from "fastify";
import { issueOpaqueToken } from "./auth.js";
import { registerEvidenceVaultRoutes } from "./evidence-vault-routes.js";
import { registerMrvInstrumentRoutes } from "./mrv-instrument-routes.js";

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
  meitySha256: string;
  calibrationEvidenceId: string;
  calibrationArtifactId: string;
  calibrationSha256: string;
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


test("PostgreSQL serializes instrument approval against evidence rejection on two sessions", {
  skip: !url || !enabled,
  timeout: 120_000,
}, async () => {
  assert.ok(url);
  const pool = new Pool({
    connectionString: url,
    max: 5,
    application_name: "rupaykg-mrv-approval-concurrency-test",
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });
  try {
    await exerciseApprovalRace(pool, "approval-first");
    await exerciseApprovalRace(pool, "rejection-first");
  } finally {
    await pool.end();
  }
});

test("HTTP routes reject stale evidence and refuse MRV instrument approval", {
  skip: !url || !enabled,
  timeout: 120_000,
}, async () => {
  assert.ok(url);
  const pool = new Pool({
    connectionString: url,
    max: 6,
    application_name: "rupaykg-mrv-route-integration-test",
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });
  const app = Fastify({ logger: false });
  try {
    const suffix = randomUUID();
    const fixture = await createFixture(pool, suffix);
    const token = issueOpaqueToken();
    await pool.query("update identities set status='VERIFIED' where id=$1", [fixture.reviewerId]);
    const role = await pool.query<{id:string}>(
      "insert into roles(organization_id,name,permissions) values($1,$2,'[\"VERIFY_EVIDENCE\",\"evidence:review\",\"guardian:operate\"]'::jsonb) returning id",
      [fixture.organizationId, `MRV-ROUTE-REVIEWER-${suffix}`],
    );
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [fixture.reviewerId, fixture.organizationId, role.rows[0]!.id]);
    await pool.query("insert into identity_sessions(identity_id,token_hash,expires_at) values($1,$2,now()+interval '15 minutes')", [fixture.reviewerId, createHash("sha256").update(token).digest("hex")]);
    await registerEvidenceVaultRoutes(app, pool);
    await registerMrvInstrumentRoutes(app, pool);
    const headers = { authorization: `Bearer ${token}`, "x-rupaykg-organization-id": fixture.organizationId };
    const rejection = await app.inject({
      method: "POST",
      url: `/api/v1/evidence-vault/${fixture.evidenceId}/review`,
      headers,
      payload: { decision: "REJECTED", rationale: "Route-level integration revocation test" },
    });
    assert.equal(rejection.statusCode, 200, rejection.body);
    assert.equal(rejection.json().data.status, "REJECTED");
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const approval = await app.inject({
      method: "POST",
      url: `/api/v1/mrv/instruments/${fixture.instrumentId}/review`,
      headers,
      payload: {
        decision: "VERIFIED", note: "Route-level stale-evidence fail-closed test",
        meityCertificateId: "MEITY-CONC-TEST", meityIssuer: "Test authority",
        meityCertificateScope: "Exact model/SKU revision", meityVerificationUrl: "https://official.example.gov/test",
        meityEvidenceReference: "evidence://meity-test", meityEvidenceSha256: fixture.meitySha256,
        meityEvidenceArtifactVersionId: fixture.artifactId, meityVerifiedAt: new Date().toISOString(),
        meityValidityBasis: "VALID_UNTIL", meityValidUntil: future, calibrationRequired: true, calibrationSerialNumber: `SERIAL-CONCURRENCY-${suffix}`,
        calibrationStatus: "VERIFIED", calibrationCertificateId: "CAL-CONC-TEST",
        calibrationEvidenceReference: "evidence://cal-test", calibrationEvidenceSha256: fixture.calibrationSha256,
        calibrationEvidenceArtifactVersionId: fixture.calibrationArtifactId, calibrationLab: "Traceable test lab",
        calibrationTraceability: "Test national standard traceability", calibrationUncertainty: 0.2,
        calibrationValidUntil: future, securityReviewStatus: "NOT_APPLICABLE_WITH_JUSTIFICATION",
        securityNotApplicableReason: "Non-firmware test instrument",
      },
    });
    assert.equal(approval.statusCode, 409, approval.body);
    assert.equal(approval.json().code, "MRV_INSTRUMENT_EVIDENCE_STALE");
    const state = await pool.query<{ evidence_status: string; approval_status: string; evidence_current: boolean }>(
      "select e.status::text evidence_status,i.approval_status,mrv_instrument_evidence_is_current(i.id) evidence_current from evidence e cross join mrv_instruments i where e.id=$1 and i.id=$2",
      [fixture.evidenceId, fixture.instrumentId],
    );
    assert.equal(state.rows[0]?.evidence_status, "REJECTED");
    assert.equal(state.rows[0]?.approval_status, "VERIFIED");
    assert.equal(state.rows[0]?.evidence_current, false);
  } finally {
    await app.close();
    await pool.end();
  }
});


test("HTTP review routes serialize evidence rejection against instrument approval in both lock orders", {
  skip: !url || !enabled,
  timeout: 120_000,
}, async () => {
  assert.ok(url);
  await exerciseHttpRouteRace("approval-first");
  await exerciseHttpRouteRace("rejection-first");
});

async function exerciseHttpRouteRace(winner: "approval-first" | "rejection-first"): Promise<void> {
  const suffix = randomUUID();
  const applicationName = `mrv-http-race-${suffix.slice(0, 8)}`;
  const pool = new Pool({
    connectionString: url!,
    max: 8,
    application_name: applicationName,
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });
  const app = Fastify({ logger: false });
  const observer = await pool.connect();
  const blocker = await pool.connect();
  try {
    const fixture = await createFixture(pool, suffix);
    await pool.query("update mrv_instruments set approval_status='HOLD' where id=$1", [fixture.instrumentId]);
    await pool.query("update identities set status='VERIFIED' where id=$1", [fixture.reviewerId]);
    const role = await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions) values($1,$2,'[\"VERIFY_EVIDENCE\",\"evidence:review\",\"guardian:operate\"]'::jsonb) returning id",
      [fixture.organizationId, `MRV-HTTP-RACE-REVIEWER-${suffix}`],
    );
    await pool.query(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
      [fixture.reviewerId, fixture.organizationId, role.rows[0]!.id],
    );
    const token = issueOpaqueToken();
    await pool.query(
      "insert into identity_sessions(identity_id,token_hash,expires_at) values($1,$2,now()+interval '15 minutes')",
      [fixture.reviewerId, createHash("sha256").update(token).digest("hex")],
    );
    await registerEvidenceVaultRoutes(app, pool);
    await registerMrvInstrumentRoutes(app, pool);
    const headers = { authorization: `Bearer ${token}`, "x-rupaykg-organization-id": fixture.organizationId };
    // Reuse the exact evidence already bound to this instrument. Its immutable
    // identity guard must not be weakened merely to exercise a concurrent review.
    const existing = await pool.query<{
      meity_certificate_id: string; meity_issuer: string; meity_certificate_scope: string;
      meity_verification_url: string; meity_evidence_reference: string; meity_evidence_sha256: string;
      meity_evidence_artifact_version_id: string; meity_verified_at: string;
      meity_validity_basis: string; meity_valid_until: string | null; calibration_required: boolean;
      calibration_status: string; calibration_certificate_id: string | null; calibration_serial_number: string | null;
      calibration_evidence_reference: string | null; calibration_evidence_sha256: string | null;
      calibration_evidence_artifact_version_id: string | null; calibration_lab: string | null;
      calibration_traceability: string | null; calibration_uncertainty: string | number | null;
      calibration_valid_until: string | null; security_review_status: string;
      security_evidence_reference: string | null; security_evidence_sha256: string | null;
      security_evidence_artifact_version_id: string | null; security_reviewed_at: string | null;
      security_not_applicable_reason: string | null; firmware_version: string | null;
      firmware_support_until: string | null;
    }>(
      "select meity_certificate_id,meity_issuer,meity_certificate_scope,meity_verification_url,meity_evidence_reference,meity_evidence_sha256,meity_evidence_artifact_version_id,meity_verified_at::text meity_verified_at,meity_validity_basis,meity_valid_until::text meity_valid_until,calibration_required,calibration_status,calibration_certificate_id,calibration_serial_number,calibration_evidence_reference,calibration_evidence_sha256,calibration_evidence_artifact_version_id,calibration_lab,calibration_traceability,calibration_uncertainty,calibration_valid_until::text calibration_valid_until,security_review_status,security_evidence_reference,security_evidence_sha256,security_evidence_artifact_version_id,security_reviewed_at::text security_reviewed_at,security_not_applicable_reason,firmware_version,firmware_support_until::text firmware_support_until from mrv_instruments where id=$1",
      [fixture.instrumentId],
    );
    const evidence = existing.rows[0]!;
    const approvalRequest = () => app.inject({
      method: "POST",
      url: `/api/v1/mrv/instruments/${fixture.instrumentId}/review`,
      headers,
      payload: {
        decision: "VERIFIED", note: "Deterministic HTTP concurrency acceptance test",
        meityCertificateId: evidence.meity_certificate_id, meityIssuer: evidence.meity_issuer,
        meityCertificateScope: evidence.meity_certificate_scope, meityVerificationUrl: evidence.meity_verification_url,
        meityEvidenceReference: evidence.meity_evidence_reference, meityEvidenceSha256: evidence.meity_evidence_sha256,
        meityEvidenceArtifactVersionId: evidence.meity_evidence_artifact_version_id, meityVerifiedAt: evidence.meity_verified_at,
        meityValidityBasis: evidence.meity_validity_basis, meityValidUntil: evidence.meity_valid_until,
        calibrationRequired: evidence.calibration_required, calibrationStatus: evidence.calibration_status, calibrationSerialNumber: evidence.calibration_serial_number,
        calibrationCertificateId: evidence.calibration_certificate_id, calibrationEvidenceReference: evidence.calibration_evidence_reference,
        calibrationEvidenceSha256: evidence.calibration_evidence_sha256, calibrationEvidenceArtifactVersionId: evidence.calibration_evidence_artifact_version_id,
        calibrationLab: evidence.calibration_lab, calibrationTraceability: evidence.calibration_traceability,
        calibrationUncertainty: evidence.calibration_uncertainty == null ? null : Number(evidence.calibration_uncertainty),
        calibrationValidUntil: evidence.calibration_valid_until, securityReviewStatus: evidence.security_review_status,
        securityEvidenceReference: evidence.security_evidence_reference, securityEvidenceSha256: evidence.security_evidence_sha256,
        securityEvidenceArtifactVersionId: evidence.security_evidence_artifact_version_id,
        securityReviewedAt: evidence.security_reviewed_at, securityNotApplicableReason: evidence.security_not_applicable_reason,
        firmwareVersion: evidence.firmware_version, firmwareSupportUntil: evidence.firmware_support_until,
      },
    });
    const rejectionRequest = () => app.inject({
      method: "POST",
      url: `/api/v1/evidence-vault/${fixture.evidenceId}/review`,
      headers,
      payload: { decision: "REJECTED", rationale: "Deterministic HTTP race revocation test" },
    });

    await blocker.query("select set_config('application_name',$1,false)", [`mrv-http-blocker-${suffix.slice(0, 8)}`]);
    await blocker.query("begin");
    await blocker.query("select id from mrv_instruments where id=$1 for update", [fixture.instrumentId]);

    const firstIsApproval = winner === "approval-first";
    const first = firstIsApproval ? approvalRequest() : rejectionRequest();
    await waitUntilBlockedByQuery(
      observer,
      applicationName,
      firstIsApproval
        ? "%from mrv_instruments where id=$1 for update%"
        : "%select i.id from mrv_instruments i where i.meity_evidence_artifact_version_id%",
    );
    const second = firstIsApproval ? rejectionRequest() : approvalRequest();
    await waitUntilBlockedByQuery(
      observer,
      applicationName,
      firstIsApproval
        ? "%select i.id from mrv_instruments i where i.meity_evidence_artifact_version_id%"
        : "%from mrv_instruments where id=$1 for update%",
    );
    await blocker.query("commit");

    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    const approvalResponse = firstIsApproval ? firstResponse : secondResponse;
    const rejectionResponse = firstIsApproval ? secondResponse : firstResponse;
    assert.equal(rejectionResponse.statusCode, 200, rejectionResponse.body);
    assert.equal(rejectionResponse.json().data.status, "REJECTED");
    if (winner === "approval-first") {
      assert.equal(approvalResponse.statusCode, 200, approvalResponse.body);
    } else {
      assert.equal(approvalResponse.statusCode, 409, approvalResponse.body);
      assert.equal(approvalResponse.json().code, "MRV_INSTRUMENT_REVIEW_BLOCKED");
    }

    const state = await pool.query<{ evidence_status: string; approval_status: string; evidence_current: boolean }>(
      "select e.status::text evidence_status,i.approval_status,mrv_instrument_evidence_is_current(i.id) evidence_current from evidence e cross join mrv_instruments i where e.id=$1 and i.id=$2",
      [fixture.evidenceId, fixture.instrumentId],
    );
    assert.equal(state.rows[0]?.evidence_status, "REJECTED");
    assert.equal(state.rows[0]?.evidence_current, false);
    if (winner === "rejection-first") assert.notEqual(state.rows[0]?.approval_status, "VERIFIED");
  } catch (error) {
    await blocker.query("rollback").catch(() => undefined);
    throw new Error(`HTTP evidence rejection / instrument approval / ${winner} failed: ${String(error)}`, { cause: error });
  } finally {
    await app.close();
    blocker.release();
    observer.release();
    await pool.end();
  }
}

async function waitUntilBlockedByQuery(observer: PoolClient, applicationName: string, queryPattern: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const result = await observer.query<{ blocked: boolean }>(
      "select exists(select 1 from pg_stat_activity where application_name=$1 and wait_event_type='Lock' and state='active' and query ilike $2) blocked",
      [applicationName, queryPattern],
    );
    if (result.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for PostgreSQL route lock: ${applicationName} / ${queryPattern}`);
}

async function exerciseApprovalRace(pool: Pool, winner: "approval-first" | "rejection-first"): Promise<void> {
  const suffix = randomUUID();
  const fixture = await createFixture(pool, suffix);
  // The shared fixture is fully verified for other acceptance cases. Reset only its
  // review state to HOLD before this isolated approval-race test; evidence and identity
  // remain immutable and committed. This ensures rejection-first proves approval cannot
  // move a pending instrument to VERIFIED using revoked evidence.
  await pool.query("update mrv_instruments set approval_status='HOLD' where id=$1", [fixture.instrumentId]);
  const approval = await pool.connect();
  const review = await pool.connect();
  const observer = await pool.connect();
  const approvalApp = `mrv-appr-${suffix.slice(0, 8)}`;
  const reviewApp = `mrv-rej-appr-${suffix.slice(0, 8)}`;
  try {
    await approval.query("select set_config('application_name',$1,false)", [approvalApp]);
    await review.query("select set_config('application_name',$1,false)", [reviewApp]);
    await observer.query("select set_config('application_name',$1,false)", [`mrv-obs-appr-${suffix.slice(0, 8)}`]);

    if (winner === "approval-first") {
      await approval.query("begin");
      await approval.query("select id from mrv_instruments where id=$1 for update", [fixture.instrumentId]);
      await lockInstrumentEvidence(approval, fixture);
      // mrv_instrument_evidence_is_current() includes approval_status='VERIFIED',
      // so it is an eligibility predicate, not a pre-approval evidence predicate.
      // The database approval trigger validates the reviewed evidence bundle atomically
      // as this HOLD -> VERIFIED transition occurs.
      await approval.query("update mrv_instruments set approval_status='VERIFIED',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='two-session approval race test' where id=$1", [fixture.instrumentId, fixture.reviewerId]);
      await review.query("begin");
      const rejection = rejectEvidence(review, fixture);
      await waitUntilBlocked(observer, reviewApp);
      await approval.query("commit");
      await rejection;
      await review.query("commit");
    } else {
      await review.query("begin");
      await lockEvidenceForReview(review, fixture);
      await approval.query("begin");
      const approvalAttempt = (async () => {
        await approval.query("select id from mrv_instruments where id=$1 for update", [fixture.instrumentId]);
        await lockInstrumentEvidence(approval, fixture);
        // Let the database's evidence-binding trigger decide against the locked,
        // latest review state. A prior eligibility predicate is not valid while HOLD.
        await approval.query("update mrv_instruments set approval_status='VERIFIED',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='two-session approval race test' where id=$1", [fixture.instrumentId, fixture.reviewerId]);
      })();
      await waitUntilBlocked(observer, approvalApp);
      await rejectEvidenceAfterLocks(review, fixture);
      await review.query("commit");
      await assert.rejects(approvalAttempt, /MeitY evidence must resolve to an approved, verified same-organization evidence-vault artifact with matching recomputed SHA-256/);
      await approval.query("rollback");
    }

    const final = await pool.query<{ status: string; approval_status: string }>(
      "select e.status::text status,i.approval_status from evidence e cross join mrv_instruments i where e.id=$1 and i.id=$2",
      [fixture.evidenceId, fixture.instrumentId],
    );
    assert.equal(final.rows[0]?.status, "REJECTED", "rejection must be durable after both sessions finish");
    if (winner === "rejection-first") assert.notEqual(final.rows[0]?.approval_status, "VERIFIED");
    const guard = await pool.query<{ current: boolean }>("select mrv_instrument_evidence_is_current($1) current", [fixture.instrumentId]);
    assert.equal(guard.rows[0]?.current, false, "revoked evidence must make the instrument ineligible");
  } catch (error) {
    await approval.query("rollback").catch(() => undefined);
    await review.query("rollback").catch(() => undefined);
    throw new Error(`instrument approval / evidence rejection / ${winner} failed: ${String(error)}`, { cause: error });
  } finally {
    approval.release();
    review.release();
    observer.release();
  }
}

async function lockInstrumentEvidence(client: PoolClient, f: Fixture): Promise<void> {
  await client.query(
    "select e.id from evidence e where e.id in (select v.evidence_id from evidence_artifact_versions v where v.id in (select i.meity_evidence_artifact_version_id from mrv_instruments i where i.id=$1 union select i.calibration_evidence_artifact_version_id from mrv_instruments i where i.id=$1 union select i.security_evidence_artifact_version_id from mrv_instruments i where i.id=$1 union select ps.source_evidence_artifact_version_id from mrv_instrument_parameter_specs ps where ps.instrument_id=$1)) order by e.id for update",
    [f.instrumentId],
  );
}

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
      if (followUpKind === "settlement") {
        // In use-first order, the original settlement is committed before evidence
        // rejection. Re-check that same value-bearing record instead of creating a
        // duplicate that would fail for an unrelated uniqueness constraint.
        const existing = await verifyClient.query<{ id: string }>(
          "select id from settlements where credential_id=$1 and payer_id=$2 and payee_id=$3 and status not in ('SETTLED','CANCELLED') order by created_at desc limit 1",
          [fixture.credentialId, fixture.organizationId, fixture.foreignOrganizationId],
        );
        if (existing.rows[0]) {
          await assert.rejects(
            verifyClient.query("update settlements set status=status where id=$1", [existing.rows[0].id]),
            errorPattern(followUpKind),
          );
        } else {
          await assert.rejects(
            performUse(verifyClient, followUpKind, fixture, `post-rejection-${suffix}`),
            errorPattern(followUpKind),
          );
        }
      } else {
        await assert.rejects(
          performUse(verifyClient, followUpKind, fixture, `post-rejection-${suffix}`),
          errorPattern(followUpKind),
        );
      }
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
      "insert into mrv_instruments(organization_id,instrument_code,instrument_type,manufacturer,model,sku_revision,manufacturer_serial_number,intended_use,supported_parameter_codes,registered_by_identity_id) values($1,$2,'GAS_FLOW','Test Manufacturer','Flow Model 1','Rev A',$3,'Concurrency test flow measurement',array['gas_flow'],$4) returning id",
      [organizationId, `FLOW-CONCURRENCY-${suffix}`, `SERIAL-CONCURRENCY-${suffix}`, identityId],
    )).rows[0]!.id;
    await c.query(
      "insert into mrv_instrument_parameter_specs(instrument_id,parameter_code,unit,minimum_value,maximum_value,resolution,accuracy_absolute,accuracy_basis,source_evidence_artifact_version_id,created_by_identity_id) values($1,'gas_flow','m3/h',0,500,0.1,0.5,'concurrency test specification',$2,$3)",
      [instrumentId, datasheet.id, identityId],
    );
    await c.query(
      "update mrv_instruments set approval_status='VERIFIED',meity_certificate_id='MEITY-CONC-TEST',meity_issuer='Test authority',meity_certificate_scope='Exact model/SKU revision',meity_verification_url='https://official.example.gov/test',meity_evidence_reference='evidence://meity-test',meity_evidence_sha256=$2,meity_evidence_artifact_version_id=$3,meity_verified_at=now(),meity_validity_basis='VALID_UNTIL',meity_valid_until=now()+interval '1 year',calibration_required=true,calibration_status='VERIFIED',calibration_certificate_id='CAL-CONC-TEST',calibration_evidence_reference='evidence://cal-test',calibration_evidence_sha256=$4,calibration_evidence_artifact_version_id=$5,calibration_lab='Traceable test lab',calibration_traceability='Test national standard traceability',calibration_uncertainty=0.2,calibration_valid_until=now()+interval '1 year',security_review_status='NOT_APPLICABLE_WITH_JUSTIFICATION',security_not_applicable_reason='Non-firmware test instrument',reviewed_by_identity_id=$6,reviewed_at=now(),review_note='Concurrency test instrument approval',calibration_serial_number=$7 where id=$1",
      [instrumentId, meity.sha256, meity.id, calibration.sha256, calibration.id, reviewerId, `SERIAL-CONCURRENCY-${suffix}`],
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

    return { organizationId, foreignOrganizationId, activityId, identityId, reviewerId, instrumentId, evidenceId: meity.evidenceId, artifactId: meity.id, meitySha256: meity.sha256, calibrationEvidenceId: calibration.evidenceId, calibrationArtifactId: calibration.id, calibrationSha256: calibration.sha256, credentialId };
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
