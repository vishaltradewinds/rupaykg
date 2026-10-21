import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerGovernmentJurisdictionCrosswalkRoutes } from "./government-jurisdiction-crosswalk-routes.js";
import { registerEvidenceVaultRoutes } from "./evidence-vault-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("government jurisdiction crosswalk API scopes requests and rejects unauthorized decisions", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 8,
  });
  const app = Fastify({ logger: { level: "error" } });
  const suffix = randomBytes(8).toString("hex");
  const organizationId = randomUUID();
  const requesterId = randomUUID();
  const requesterRoleId = randomUUID();
  const geographyId = randomUUID();
  const outsideGeographyId = randomUUID();
  const requesterToken = randomBytes(32).toString("base64url");
  let requestId: string | null = null;

  try {
    await registerGovernmentJurisdictionCrosswalkRoutes(app, pool);
    await registerEvidenceVaultRoutes(app, pool);
    await app.ready();
    await pool.query("insert into organizations(id,name,organization_type) values($1,$2,'TEST_FIXTURE')", [organizationId, "Crosswalk integration " + suffix]);
    await pool.query("insert into identities(id,display_name) values($1,$2)", [requesterId, "Crosswalk requester " + suffix]);
    await pool.query("insert into roles(id,organization_id,name,permissions) values($1,$2,'CROSSWALK_MANAGER',$3::jsonb)", [
      requesterRoleId, organizationId, JSON.stringify(["MANAGE_STAKEHOLDERS", "evidence:upload"]),
    ]);
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [
      requesterId, organizationId, requesterRoleId,
    ]);
    await pool.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2)", [
      requesterId, hash(requesterToken),
    ]);
    await pool.query("insert into geography(id,kind,code,name,source,source_version) values($1,'CLUSTER',$2,$3,'Synthetic integration fixture','v1'),($4,'CLUSTER',$5,$6,'Synthetic integration fixture','v1')", [
      geographyId, "CROSSWALK-" + suffix, "Synthetic crosswalk geography " + suffix,
      outsideGeographyId, "CROSSWALK-OUTSIDE-" + suffix, "Synthetic outside geography " + suffix,
    ]);
    await pool.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')", [organizationId, geographyId]);

    const activityId = randomUUID();
    await pool.query("insert into activities(id,organization_id,geography_id,activity_type,status) values($1,$2,$3,'WASTE_WEIGHT_MEASUREMENT','COMPLETED')", [activityId, organizationId, geographyId]);
    const headers = { authorization: "Bearer " + requesterToken, "x-rupaykg-organization-id": organizationId };
    const evidenceBytes = Buffer.from("%PDF-1.7\\nSynthetic crosswalk evidence\\n");
    const evidenceUpload = await app.inject({
      method: "POST", url: "/api/v1/evidence-vault/upload", headers,
      payload: { activityId, evidenceType: "CROSSWALK_SOURCE_RECORD", fileName: "crosswalk-source.pdf", mediaType: "application/pdf", contentBase64: evidenceBytes.toString("base64"), sourceReference: "SYNTHETIC-CROSSWALK-" + suffix },
    });
    assert.equal(evidenceUpload.statusCode, 201, evidenceUpload.body);
    const artifact = evidenceUpload.json().data as { artifactVersionId: string; sha256: string };
    const payload = {
      organizationId, geographyId, activityId, authorityCode: "SYNTHETIC_AUTHORITY", municipalCode: "MUNI-" + suffix,
      sourceVersion: "synthetic-source-v1", sourceSnapshotId, evidenceReference: "db://evidence-vault/" + artifact.artifactVersionId,
      evidenceSha256: artifact.sha256, reason: "Synthetic integration test mapping request",
    };
    const outOfScope = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers,
      payload: { ...payload, geographyId: outsideGeographyId, municipalCode: "OUTSIDE-" + suffix },
    });
    assert.equal(outOfScope.statusCode, 403, outOfScope.body);
    assert.equal(outOfScope.json().code, "GEOGRAPHY_FORBIDDEN");

    const unboundEvidence = await app.inject({ method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers, payload: { ...payload, evidenceReference: "synthetic://not-in-vault/" + suffix } });
    assert.equal(unboundEvidence.statusCode, 422, unboundEvidence.body);
    assert.equal(unboundEvidence.json().code, "GOVERNMENT_CROSSWALK_EVIDENCE_UNBOUND");
    const missingSnapshot = await app.inject({ method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers, payload: { ...payload, sourceSnapshotId: undefined } });
    assert.equal(missingSnapshot.statusCode, 400, missingSnapshot.body);
    const mismatchedSnapshot = await app.inject({ method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers, payload: { ...payload, authorityCode: "OTHER_AUTHORITY" } });
    assert.equal(mismatchedSnapshot.statusCode, 409, mismatchedSnapshot.body);
    assert.equal(mismatchedSnapshot.json().code, "GOVERNMENT_CROSSWALK_SOURCE_SNAPSHOT_REQUIRED");

    // A real vault artifact for the same tenant but another activity must not be reusable
    // to assert evidence for the requested activity.
    const otherActivityId = randomUUID();
    await pool.query("insert into activities(id,organization_id,geography_id,activity_type,status) values($1,$2,$3,'WASTE_WEIGHT_MEASUREMENT','COMPLETED')", [otherActivityId, organizationId, geographyId]);
    const wrongActivity = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers,
      payload: { ...payload, activityId: otherActivityId },
    });
    assert.equal(wrongActivity.statusCode, 422, wrongActivity.body);
    assert.equal(wrongActivity.json().code, "GOVERNMENT_CROSSWALK_EVIDENCE_UNBOUND");

    // A valid immutable artifact belonging to another tenant must not bind to this tenant's request.
    const foreignOrganizationId = randomUUID();
    const foreignGeographyId = randomUUID();
    const foreignActivityId = randomUUID();
    const foreignEvidenceId = randomUUID();
    const foreignSeriesId = randomUUID();
    const foreignArtifactVersionId = randomUUID();
    const foreignBytes = Buffer.from("Synthetic evidence owned by a different tenant");
    const foreignSha256 = hash(foreignBytes.toString());
    await pool.query("insert into organizations(id,name,organization_type) values($1,$2,'TEST_FIXTURE')", [foreignOrganizationId, "Foreign evidence tenant " + suffix]);
    await pool.query("insert into geography(id,kind,code,name,source,source_version) values($1,'CLUSTER',$2,$3,'Synthetic foreign fixture','v1')", [foreignGeographyId, "FOREIGN-GEO-" + suffix, "Foreign evidence geography " + suffix]);
    await pool.query("insert into activities(id,organization_id,geography_id,activity_type,status) values($1,$2,$3,'WASTE_WEIGHT_MEASUREMENT','COMPLETED')", [foreignActivityId, foreignOrganizationId, foreignGeographyId]);
    await pool.query("insert into evidence_artifact_series(id,organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,$3,'CROSSWALK_SOURCE_RECORD',$4)", [foreignSeriesId, foreignOrganizationId, foreignActivityId, requesterId]);
    await pool.query("insert into evidence(id,activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,$2,'CROSSWALK_SOURCE_RECORD','CAPTURED',now(),$3,$4,'{}'::jsonb)", [foreignEvidenceId, foreignActivityId, "db://evidence-vault/" + foreignArtifactVersionId, foreignSha256]);
    await pool.query("insert into evidence_artifact_versions(id,series_id,evidence_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id,source_reference) values($1,$2,$3,1,'foreign-evidence.txt','text/plain',$4,$5,$6,$7,'synthetic://foreign-tenant')", [foreignArtifactVersionId, foreignSeriesId, foreignEvidenceId, foreignBytes.length, foreignSha256, foreignBytes, requesterId]);
    const wrongTenant = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers,
      payload: { ...payload, evidenceReference: "db://evidence-vault/" + foreignArtifactVersionId, evidenceSha256: foreignSha256 },
    });
    assert.equal(wrongTenant.statusCode, 422, wrongTenant.body);
    assert.equal(wrongTenant.json().code, "GOVERNMENT_CROSSWALK_EVIDENCE_UNBOUND");

    // Mapping targets are tenant-bound independently of evidence binding.
    const foreignTarget = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers,
      payload: { ...payload, organizationId: foreignOrganizationId, geographyId: foreignGeographyId },
    });
    assert.equal(foreignTarget.statusCode, 403, foreignTarget.body);
    assert.equal(foreignTarget.json().code, "GOVERNMENT_CROSSWALK_FORBIDDEN");

    // An activity from another tenant cannot be mapped to this tenant's geography,
    // even when the submitted organization and geography are otherwise authorized.
    const foreignActivityTarget = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers,
      payload: { ...payload, activityId: foreignActivityId },
    });
    assert.equal(foreignActivityTarget.statusCode, 409, foreignActivityTarget.body);
    assert.equal(foreignActivityTarget.json().code, "GOVERNMENT_CROSSWALK_ACTIVITY_MISMATCH");

    const requestResponse = await app.inject({ method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers, payload });
    assert.equal(requestResponse.statusCode, 201, requestResponse.body);
    assert.equal(requestResponse.json().status, "PENDING");
    requestId = requestResponse.json().requestId;

    const unauthorizedQueue = await app.inject({ method: "GET", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers });
    assert.equal(unauthorizedQueue.statusCode, 403, unauthorizedQueue.body);
    assert.equal(unauthorizedQueue.json().code, "GOVERNMENT_CROSSWALK_APPROVAL_FORBIDDEN");

    const unauthorizedDecision = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests/" + requestId + "/decision",
      headers, payload: { decision: "APPROVE", reason: "Attempted unauthorized approval is forbidden" },
    });
    assert.equal(unauthorizedDecision.statusCode, 403, unauthorizedDecision.body);
    assert.equal(unauthorizedDecision.json().code, "GOVERNMENT_CROSSWALK_APPROVAL_FORBIDDEN");

    const pending = await pool.query<{ status: string }>("select status from government_jurisdiction_crosswalk_requests where id=$1", [requestId]);
    assert.equal(pending.rows[0]?.status, "PENDING", "unauthorized decisions must not mutate the request");

    const listed = await app.inject({ method: "GET", url: "/api/v1/government/jurisdiction-crosswalks", headers });
    assert.equal(listed.statusCode, 200, listed.body);
    assert.equal(listed.json().crosswalks.length, 0, "pending requests must not appear as verified crosswalks");
  } finally {
    await app.close();
    if (requestId) await pool.query("delete from government_jurisdiction_crosswalk_requests where id=$1", [requestId]).catch(() => undefined);
    await pool.query("delete from organization_geography_scopes where organization_id=$1", [organizationId]).catch(() => undefined);
    await pool.query("delete from identity_sessions where identity_id=$1", [requesterId]).catch(() => undefined);
    await pool.query("delete from organization_memberships where organization_id=$1 and identity_id=$2", [organizationId, requesterId]).catch(() => undefined);
    await pool.query("delete from roles where id=$1", [requesterRoleId]).catch(() => undefined);
    await pool.query("delete from geography where id=any($1::uuid[])", [[geographyId, outsideGeographyId]]).catch(() => undefined);
    // Preserve the organization and identity because the append-only audit event references them.
    await pool.end();
  }
});
