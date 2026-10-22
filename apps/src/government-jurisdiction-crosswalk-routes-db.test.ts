import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerGovernmentJurisdictionCrosswalkRoutes } from "./government-jurisdiction-crosswalk-routes.js";
import { registerEvidenceVaultRoutes } from "./evidence-vault-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function bootstrapReservedMembership(pool: Pool, identityId: string, organizationId: string, roleId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    await client.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [identityId, organizationId, roleId]);
    await client.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}

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
  const approverId = randomUUID();
  const approverRoleId = randomUUID();
  const approverToken = randomBytes(32).toString("base64url");
  const geographyId = randomUUID();
  const outsideGeographyId = randomUUID();
  const requesterToken = randomBytes(32).toString("base64url");
  let requestId: string | null = null;
  let expiredRequestId: string | null = null;
  let sourceSnapshotId: string | null = null;
  let unboundSnapshotId: string | null = null;
  let geographySourceId: string | null = null;
  let aliasRequestId: string | null = null;

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
    await pool.query("insert into identities(id,display_name) values($1,$2)", [approverId, "Crosswalk approver " + suffix]);
    await pool.query("insert into roles(id,organization_id,name,permissions) values($1,$2,'super_admin',$3::jsonb)", [
      approverRoleId, organizationId, JSON.stringify(["MANAGE_STAKEHOLDERS", "admin:system"]),
    ]);
    await bootstrapReservedMembership(pool, approverId, organizationId, approverRoleId);
    await pool.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2)", [
      approverId, hash(approverToken),
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
    sourceSnapshotId = randomUUID();
    await pool.query(
      "insert into authoritative_source_snapshots(id,authority_code,source_owner,dataset_code,source_url,source_version,scope_kind,content_sha256,record_count,accepted_record_count,unresolved_record_count,validation_status,usage_terms_reference,retrieved_at,retrieved_by_identity_id,reviewed_by_identity_id,reviewed_at) values($1,'SYNTHETIC_AUTHORITY','Synthetic integration fixture','SYNTHETIC_CROSSWALK_SOURCE','https://example.invalid/synthetic-crosswalk-source','synthetic-source-v1','OTHER',$2,1,1,0,'APPROVED','synthetic://test-fixture-terms',now(),$3,$3,now())",
      [sourceSnapshotId, artifact.sha256, requesterId],
    );
    unboundSnapshotId = randomUUID();
    await pool.query(
      "insert into authoritative_source_snapshots(id,authority_code,source_owner,dataset_code,source_url,source_version,scope_kind,content_sha256,record_count,accepted_record_count,unresolved_record_count,validation_status,usage_terms_reference,retrieved_at,retrieved_by_identity_id,reviewed_by_identity_id,reviewed_at) values($1,'SYNTHETIC_AUTHORITY','Synthetic integration fixture','SYNTHETIC_UNBOUND_SOURCE','https://example.invalid/unbound-source','synthetic-source-v1','OTHER',$2,1,1,0,'APPROVED','synthetic://test-fixture-terms',now(),$3,$3,now())",
      [unboundSnapshotId, artifact.sha256, requesterId],
    );
    geographySourceId = (await pool.query<{ id: string }>(
      "insert into geography_sources(source_name,source_uri,source_version,checksum,status) values($1,'https://example.invalid/synthetic-crosswalk-source','synthetic-source-v1',$2,'VERIFIED') returning id",
      ["Synthetic crosswalk source " + suffix, artifact.sha256],
    )).rows[0]!.id;
    await pool.query(
      "insert into geography_external_identifiers(source_id,geography_id,identifier_type,external_identifier,valid_from,status,source_reference_uri,source_checksum,reviewed_by_identity_id,reviewed_at) values($1,$2,'LGD_CODE',$3,'2020-01-01','VERIFIED','https://example.invalid/synthetic-alias-record',$4,$5,now()),($1,$6,'LGD_CODE',$7,'2020-01-01','VERIFIED','https://example.invalid/synthetic-alias-record',$4,$5,now())",
      [geographySourceId, geographyId, "ALIAS-" + suffix.toUpperCase(), artifact.sha256, requesterId, outsideGeographyId, "MISMATCH-" + suffix.toUpperCase()],
    );
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

    // The optional alias path must bind the exact approved snapshot to one verified source.
    const aliasRequest = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers,
      payload: { ...payload, municipalCode: "ALIAS-" + suffix, externalIdentifierType: "LGD_CODE" },
    });
    assert.equal(aliasRequest.statusCode, 201, aliasRequest.body);
    aliasRequestId = aliasRequest.json().requestId;

    // An alias resolving to a different canonical geography must be rejected without fallback.
    const mismatchedAlias = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers,
      payload: { ...payload, municipalCode: "MISMATCH-" + suffix, externalIdentifierType: "LGD_CODE" },
    });
    assert.equal(mismatchedAlias.statusCode, 409, mismatchedAlias.body);
    assert.equal(mismatchedAlias.json().code, "GEOGRAPHY_EXTERNAL_IDENTIFIER_MISMATCH");

    // Supplying an identifier type without a bound verified source must fail closed.
    const missingSourceBinding = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers,
      payload: { ...payload, sourceSnapshotId: unboundSnapshotId, municipalCode: "UNBOUND-" + suffix, externalIdentifierType: "LGD_CODE" },
    });
    assert.equal(missingSourceBinding.statusCode, 409, missingSourceBinding.body);
    assert.equal(missingSourceBinding.json().code, "GEOGRAPHY_SOURCE_SNAPSHOT_BINDING_REQUIRED");

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

    // Expired requests must fail closed at the API boundary, with no status change.
    // Insert a synthetic expired pending request directly because the lifecycle trigger intentionally
    // prevents editing request fields after creation; the route must still enforce expiry at decision time.
    const expiredRequest = await pool.query<{ id: string }>(
      `insert into government_jurisdiction_crosswalk_requests
        (authority_code,municipal_code,source_version,source_snapshot_id,organization_id,geography_id,activity_id,effective_from,evidence_reference,evidence_sha256,request_reason,request_hash,requested_by_identity_id,expires_at)
       values($1,$2,$3,$4,$5,$6,$7,now(),$8,$9,$10,$11,$12,now()-interval '1 second') returning id`,
      [payload.authorityCode, "EXPIRED-" + suffix.toUpperCase(), payload.sourceVersion, sourceSnapshotId, organizationId, geographyId, activityId,
        payload.evidenceReference, payload.evidenceSha256, "Synthetic expired crosswalk request", hash("expired-request-" + suffix), requesterId],
    );
    expiredRequestId = expiredRequest.rows[0]?.id ?? null;
    assert.ok(expiredRequestId, "expired request fixture must be created");
    await assert.rejects(
      pool.query("update government_jurisdiction_crosswalk_requests set expires_at=now()+interval '1 day',status='APPROVED',decided_by_identity_id=$2,decision_reason=$3,decided_at=now(),applied_at=now() where id=$1", [expiredRequestId, approverId, "Attempt to revive expired request"]),
      (error: unknown) => typeof error === "object" && error !== null && "message" in error && String((error as { message: unknown }).message).includes("GOVERNMENT_CROSSWALK_EXPIRY_IMMUTABLE"),
      "database must prevent extending expiry while approving a request",
    );
    const expiredApproval = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests/" + expiredRequestId + "/decision",
      headers: { authorization: "Bearer " + approverToken, "x-rupaykg-organization-id": organizationId },
      payload: { decision: "APPROVE", reason: "Expired request must be resubmitted" },
    });
    assert.equal(expiredApproval.statusCode, 409, expiredApproval.body);
    assert.equal(expiredApproval.json().code, "GOVERNMENT_CROSSWALK_REQUEST_EXPIRED");
    const stillPending = await pool.query<{ status: string }>("select status from government_jurisdiction_crosswalk_requests where id=$1", [expiredRequestId]);
    assert.equal(stillPending.rows[0]?.status, "PENDING", "expired approval attempts must not mutate the request");

    const listed = await app.inject({ method: "GET", url: "/api/v1/government/jurisdiction-crosswalks", headers });
    assert.equal(listed.statusCode, 200, listed.body);
    assert.equal(listed.json().crosswalks.length, 0, "pending requests must not appear as verified crosswalks");
  } finally {
    await app.close();
    if (requestId || expiredRequestId || aliasRequestId) await pool.query("delete from government_jurisdiction_crosswalk_requests where id=any($1::uuid[])", [[requestId, expiredRequestId, aliasRequestId].filter(Boolean)]).catch(() => undefined);
    if (geographySourceId) await pool.query("delete from geography_external_identifiers where source_id=$1", [geographySourceId]).catch(() => undefined);
    if (geographySourceId) await pool.query("delete from geography_sources where id=$1", [geographySourceId]).catch(() => undefined);
    if (sourceSnapshotId || unboundSnapshotId) await pool.query("delete from authoritative_source_snapshots where id=any($1::uuid[])", [[sourceSnapshotId, unboundSnapshotId].filter(Boolean)]).catch(() => undefined);
    await pool.query("delete from organization_geography_scopes where organization_id=$1", [organizationId]).catch(() => undefined);
    await pool.query("delete from identity_sessions where identity_id=any($1::uuid[])", [[requesterId, approverId]]).catch(() => undefined);
    await pool.query("delete from organization_memberships where organization_id=$1 and identity_id=any($2::uuid[])", [organizationId, [requesterId, approverId]]).catch(() => undefined);
    await pool.query("delete from roles where id=any($1::uuid[])", [[requesterRoleId, approverRoleId]]).catch(() => undefined);
    await pool.query("delete from identities where id=$1", [approverId]).catch(() => undefined);
    await pool.query("delete from geography where id=any($1::uuid[])", [[geographyId, outsideGeographyId]]).catch(() => undefined);
    // Preserve the organization and identity because the append-only audit event references them.
    await pool.end();
  }
});
