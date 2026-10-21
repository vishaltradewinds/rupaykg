import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerGovernmentJurisdictionCrosswalkRoutes } from "./government-jurisdiction-crosswalk-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("government jurisdiction crosswalk API requires scope and independent approval", {
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
  const approverId = randomUUID();
  const requesterRoleId = randomUUID();
  const approverRoleId = randomUUID();
  const geographyId = randomUUID();
  const requesterToken = randomBytes(32).toString("base64url");
  const approverToken = randomBytes(32).toString("base64url");
  let requestId: string | null = null;
  let crosswalkId: string | null = null;

  try {
    await registerGovernmentJurisdictionCrosswalkRoutes(app, pool);
    await app.ready();
    await pool.query("insert into organizations(id,name,organization_type) values($1,$2,'TEST_FIXTURE')", [organizationId, "Crosswalk integration " + suffix]);
    await pool.query("insert into identities(id,display_name) values($1,$2),($3,$4)", [requesterId, "Crosswalk requester " + suffix, approverId, "Crosswalk approver " + suffix]);
    await pool.query("insert into roles(id,organization_id,name,permissions) values($1,$2,'CROSSWALK_MANAGER',$3::jsonb),($4,$2,'super_admin',$5::jsonb)", [
      requesterRoleId, organizationId, JSON.stringify(["MANAGE_STAKEHOLDERS"]), approverRoleId, JSON.stringify(["admin:system", "MANAGE_STAKEHOLDERS"]),
    ]);
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$5,'VERIFIED')", [
      requesterId, organizationId, requesterRoleId, approverId, approverRoleId,
    ]);
    await pool.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4)", [
      requesterId, hash(requesterToken), approverId, hash(approverToken),
    ]);
    await pool.query("insert into geography(id,kind,code,name,source,source_version) values($1,'CLUSTER',$2,$3,'Synthetic integration fixture','v1')", [
      geographyId, "CROSSWALK-" + suffix, "Synthetic crosswalk geography " + suffix,
    ]);
    await pool.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')", [organizationId, geographyId]);

    const headers = { authorization: "Bearer " + requesterToken, "x-rupaykg-organization-id": organizationId };
    const payload = {
      organizationId, geographyId, authorityCode: "SYNTHETIC_AUTHORITY", municipalCode: "MUNI-" + suffix,
      sourceVersion: "synthetic-source-v1", evidenceReference: "synthetic://crosswalk-evidence/" + suffix,
      evidenceSha256: hash("synthetic evidence " + suffix), reason: "Synthetic integration test mapping request",
    };
    const requestResponse = await app.inject({ method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers, payload });
    assert.equal(requestResponse.statusCode, 201, requestResponse.body);
    assert.equal(requestResponse.json().status, "PENDING");
    requestId = requestResponse.json().requestId;

    const selfApproval = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests/" + requestId + "/decision",
      headers, payload: { decision: "APPROVE", reason: "Attempted self approval is forbidden" },
    });
    assert.equal(selfApproval.statusCode, 403, selfApproval.body);
    assert.equal(selfApproval.json().code, "GOVERNMENT_CROSSWALK_APPROVAL_FORBIDDEN");

    const approval = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests/" + requestId + "/decision",
      headers: { authorization: "Bearer " + approverToken, "x-rupaykg-organization-id": organizationId },
      payload: { decision: "APPROVE", reason: "Independent synthetic approval for integration test" },
    });
    assert.equal(approval.statusCode, 200, approval.body);
    assert.equal(approval.json().status, "APPROVED");
    crosswalkId = approval.json().crosswalkId;
    assert.ok(crosswalkId);

    const persisted = await pool.query<{ status: string; organization_id: string; geography_id: string; requested_by_identity_id: string; approved_by_identity_id: string }>(
      "select status,organization_id,geography_id,requested_by_identity_id,approved_by_identity_id from government_jurisdiction_crosswalks where id=$1",
      [crosswalkId],
    );
    assert.deepEqual(persisted.rows[0], {
      status: "VERIFIED", organization_id: organizationId, geography_id: geographyId,
      requested_by_identity_id: requesterId, approved_by_identity_id: approverId,
    });

    const listed = await app.inject({
      method: "GET", url: "/api/v1/government/jurisdiction-crosswalks",
      headers: { authorization: "Bearer " + requesterToken, "x-rupaykg-organization-id": organizationId },
    });
    assert.equal(listed.statusCode, 200, listed.body);
    assert.ok(listed.json().crosswalks.some((row: { id: string }) => row.id === crosswalkId));
  } finally {
    await app.close();
    if (crosswalkId) await pool.query("delete from government_jurisdiction_crosswalks where id=$1", [crosswalkId]).catch(() => undefined);
    if (requestId) await pool.query("delete from government_jurisdiction_crosswalk_requests where id=$1", [requestId]).catch(() => undefined);
    await pool.query("delete from organization_geography_scopes where organization_id=$1", [organizationId]).catch(() => undefined);
    await pool.query("delete from identity_sessions where identity_id=any($1::uuid[])", [[requesterId, approverId]]).catch(() => undefined);
    await pool.query("delete from organization_memberships where organization_id=$1 and identity_id=any($2::uuid[])", [organizationId, [requesterId, approverId]]).catch(() => undefined);
    await pool.query("delete from roles where id=any($1::uuid[])", [[requesterRoleId, approverRoleId]]).catch(() => undefined);
    await pool.query("delete from geography where id=$1", [geographyId]).catch(() => undefined);
    // Preserve the organization and identities because the append-only audit events reference them.
    await pool.end();
  }
});
