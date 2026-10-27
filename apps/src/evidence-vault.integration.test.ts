import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerEvidenceVaultRoutes } from "./evidence-vault-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("evidence vault enforces tenant scope, versioned storage, integrity and independent review", { skip: !enabled }, async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = Fastify({ logger: false });
  await registerEvidenceVaultRoutes(app, pool);
  const suffix = randomBytes(8).toString("hex");
  const uploaderToken = randomBytes(32).toString("base64url");
  const reviewerToken = randomBytes(32).toString("base64url");
  const outsiderToken = randomBytes(32).toString("base64url");
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
    const identities = await Promise.all([
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["test-evidence-uploader:"+suffix,"Evidence Uploader","uploader-"+suffix+"@example.invalid"]),
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["test-evidence-reviewer:"+suffix,"Evidence Reviewer","reviewer-"+suffix+"@example.invalid"]),
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["test-evidence-outsider:"+suffix,"Evidence Outsider","outsider-"+suffix+"@example.invalid"]),
    ]);
    const uploaderId = identities[0].rows[0]!.id;
    const reviewerId = identities[1].rows[0]!.id;
    const outsiderId = identities[2].rows[0]!.id;
    const roles = await Promise.all([
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'evidence_uploader_test',$2::jsonb,'[]') returning id",[organizationId,JSON.stringify(["evidence:upload","evidence:read"])]),
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'evidence_reviewer_test',$2::jsonb,'[]') returning id",[organizationId,JSON.stringify(["evidence:read","evidence:review","VERIFY_EVIDENCE"])]),
      pool.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,'evidence_outsider_test',$2::jsonb,'[]') returning id",[otherOrg.rows[0]!.id,JSON.stringify(["evidence:read","evidence:upload"])]),
    ]);
    await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    try {
      await pool.query(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$5,'VERIFIED'),($6,$7,$8,'VERIFIED')",
        [uploaderId,organizationId,roles[0].rows[0]!.id,reviewerId,roles[1].rows[0]!.id,outsiderId,otherOrg.rows[0]!.id,roles[2].rows[0]!.id],
      );
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }
    await pool.query(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4),($5,now()+interval '1 hour',$6)",
      [uploaderId,hash(uploaderToken),reviewerId,hash(reviewerToken),outsiderId,hash(outsiderToken)],
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
    const second = secondUpload.json().data as { evidenceId: string; artifactVersionId: string; versionNumber: number };
    assert.equal(second.versionNumber, 2);

    await assert.rejects(
      pool.query("update evidence_artifact_series set activity_id=$2 where id=$1", [uploaded.seriesId, "00000000-0000-4000-8000-000000000001"]),
      /evidence artifact series provenance is immutable/i,
      "series scope must not be rewritten after artifacts are recorded",
    );

    await assert.rejects(
      pool.query(
        "insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale) values($1,$2,$3,'APPROVED','Mismatched artifact version must fail')",
        [uploaded.evidenceId, second.artifactVersionId, reviewerId],
      ),
      /review must reference the exact artifact version/i,
      "a review must not be rebound to a different artifact version",
    );

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

    const reviewerDecision = await app.inject({ method: "POST", url: "/api/v1/evidence-vault/"+uploaded.evidenceId+"/review", headers: headers(reviewerToken), payload: { decision: "APPROVED", rationale: "Checked against the cited source record" } });
    assert.equal(reviewerDecision.statusCode, 200, reviewerDecision.body);
    assert.equal(reviewerDecision.json().data.status, "VERIFIED");

    const secondReview = await app.inject({ method: "POST", url: "/api/v1/evidence-vault/"+uploaded.evidenceId+"/review", headers: headers(reviewerToken), payload: { decision: "REJECTED", rationale: "Attempt a second decision" } });
    assert.equal(secondReview.statusCode, 409, secondReview.body);

    const spoofedPdf = await app.inject({ method: "POST", url: "/api/v1/evidence-vault/upload", headers: headers(uploaderToken), payload: { activityId: activity.rows[0]!.id, evidenceType: "MALICIOUS", fileName: "not-a-pdf.pdf", mediaType: "application/pdf", contentBase64: Buffer.from("MZ executable bytes").toString("base64") } });
    assert.equal(spoofedPdf.statusCode, 415, spoofedPdf.body);
  } finally {
    await app.close();
    await pool.end();
  }
});
