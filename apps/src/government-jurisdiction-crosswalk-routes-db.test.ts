import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerGovernmentJurisdictionCrosswalkRoutes } from "./government-jurisdiction-crosswalk-routes.js";

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
    await app.ready();
    await pool.query("insert into organizations(id,name,organization_type) values($1,$2,'TEST_FIXTURE')", [organizationId, "Crosswalk integration " + suffix]);
    await pool.query("insert into identities(id,display_name) values($1,$2)", [requesterId, "Crosswalk requester " + suffix]);
    await pool.query("insert into roles(id,organization_id,name,permissions) values($1,$2,'CROSSWALK_MANAGER',$3::jsonb)", [
      requesterRoleId, organizationId, JSON.stringify(["MANAGE_STAKEHOLDERS"]),
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

    const headers = { authorization: "Bearer " + requesterToken, "x-rupaykg-organization-id": organizationId };
    const payload = {
      organizationId, geographyId, authorityCode: "SYNTHETIC_AUTHORITY", municipalCode: "MUNI-" + suffix,
      sourceVersion: "synthetic-source-v1", evidenceReference: "synthetic://crosswalk-evidence/" + suffix,
      evidenceSha256: hash("synthetic evidence " + suffix), reason: "Synthetic integration test mapping request",
    };
    const outOfScope = await app.inject({
      method: "POST", url: "/api/v1/government/jurisdiction-crosswalk/requests", headers,
      payload: { ...payload, geographyId: outsideGeographyId, municipalCode: "OUTSIDE-" + suffix },
    });
    assert.equal(outOfScope.statusCode, 403, outOfScope.body);
    assert.equal(outOfScope.json().code, "GEOGRAPHY_FORBIDDEN");

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
