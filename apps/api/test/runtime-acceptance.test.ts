import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const baseUrl = `http://127.0.0.1:${process.env.RUNTIME_ACCEPTANCE_PORT ?? 43127}`;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 4 }) : null;
const suffix = randomUUID();
let server: ChildProcess | null = null;
let noDbServer: ChildProcess | null = null;
let orgId = "";
let geographyId = "";
let outOfScopeGeographyId = "";
let actorId = "";
let verifierId = "";
let verifierToken = "";
let actorToken = "";
let pendingDeviceId = "";
let verifiedDeviceId = "";
let envelopeId = "";
let activityId = "";
let measurementId = "";
let evidenceId = "";

function token(): string {
  return randomBytes(32).toString("base64url");
}
function tokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
async function waitFor(url: string, expectedStatus: number, child: ChildProcess, timeoutMs = 15_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`runtime server exited with code ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.status === expectedStatus) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url} to return ${expectedStatus}`);
}
async function request(path: string, init: RequestInit = {}, bearer?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}
async function json(response: Response): Promise<Record<string, any>> {
  return (await response.json()) as Record<string, any>;
}

before(async () => {
  if (!pool) return;

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    orgId = (await c.query<{ id: string }>("insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id", [`runtime-${suffix}`])).rows[0]!.id;
    const otherOrg = (await c.query<{ id: string }>("insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id", [`runtime-other-${suffix}`])).rows[0]!.id;
    geographyId = (await c.query<{ id: string }>("insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id", [`RUNTIME-${suffix}`, `Runtime State ${suffix}`])).rows[0]!.id;
    outOfScopeGeographyId = (await c.query<{ id: string }>("insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id", [`RUNTIME-OTHER-${suffix}`, `Runtime Other State ${suffix}`])).rows[0]!.id;
    await c.query("insert into organization_geography_scopes(organization_id,geography_id) values($1,$2)", [orgId, geographyId]);

    actorId = (await c.query<{ id: string }>("insert into identities(external_subject,display_name) values($1,$2) returning id", [`runtime-actor-${suffix}`, "Runtime Actor"])).rows[0]!.id;
    verifierId = (await c.query<{ id: string }>("insert into identities(external_subject,display_name) values($1,$2) returning id", [`runtime-verifier-${suffix}`, "Runtime Verifier"])).rows[0]!.id;
    const actorRole = (await c.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,'[]') returning id", [orgId, `ACTOR-${suffix}`])).rows[0]!.id;
    const verifierRole = (await c.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,'[\"VERIFY_EVIDENCE\"]') returning id", [orgId, `VERIFIER-${suffix}`])).rows[0]!.id;
    await c.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [actorId, orgId, actorRole]);
    await c.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [verifierId, orgId, verifierRole]);

    actorToken = token();
    verifierToken = token();
    await c.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4)", [actorId, tokenHash(actorToken), verifierId, tokenHash(verifierToken)]);

    pendingDeviceId = (await c.query<{ id: string }>("insert into field_devices(device_id,identity_id,organization_id,status) values($1,$2,$3,'PENDING') returning id", [`pending-${suffix}`, actorId, orgId])).rows[0]!.id;
    verifiedDeviceId = (await c.query<{ id: string }>("insert into field_devices(device_id,identity_id,organization_id,status) values($1,$2,$3,'VERIFIED') returning id", [`verified-${suffix}`, actorId, orgId])).rows[0]!.id;
    await c.query("COMMIT");
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }

  const port = new URL(baseUrl).port;
  server = spawn(process.execPath, ["dist/server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, HOST: "127.0.0.1", DATABASE_URL: databaseUrl, DATABASE_SSL: "false" },
    stdio: "ignore",
  });
  await waitFor(`${baseUrl}/health`, 200, server);

  const noDbPort = String(Number(port) + 1);
  noDbServer = spawn(process.execPath, ["dist/server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: noDbPort, HOST: "127.0.0.1", DATABASE_URL: "", DATABASE_SSL: "false" },
    stdio: "ignore",
  });
  await waitFor(`http://127.0.0.1:${noDbPort}/health`, 503, noDbServer);
});

after(async () => {
  noDbServer?.kill("SIGTERM");
  server?.kill("SIGTERM");
  if (!pool || !orgId) return;
  const c = await pool.connect();
  try {
    await c.query("delete from field_sync_conflicts where envelope_id in (select id from field_sync_envelopes where device_id in (select id from field_devices where organization_id=$1))", [orgId]);
    await c.query("delete from field_sync_envelopes where device_id in (select id from field_devices where organization_id=$1)", [orgId]);
    await c.query("delete from field_sync_cursors where device_id in (select id from field_devices where organization_id=$1)", [orgId]);
    await c.query("delete from field_devices where organization_id=$1", [orgId]);
    await c.query("delete from verifications where evidence_id in (select id from evidence where activity_id in (select id from activities where organization_id=$1))", [orgId]);
    await c.query("delete from evidence where activity_id in (select id from activities where organization_id=$1)", [orgId]);
    await c.query("delete from measurements where activity_id in (select id from activities where organization_id=$1)", [orgId]);
    await c.query("delete from activities where organization_id=$1", [orgId]);
    await c.query("delete from identity_sessions where identity_id in (select id from identities where external_subject like $1)", [`%${suffix}`]);
    await c.query("delete from organization_memberships where organization_id=$1", [orgId]);
    await c.query("delete from roles where organization_id=$1", [orgId]);
    await c.query("delete from organization_geography_scopes where organization_id=$1", [orgId]);
    await c.query("delete from identities where id in ($1,$2)", [actorId, verifierId]);
    await c.query("delete from geography where id in ($1,$2)", [geographyId, outOfScopeGeographyId]);
    await c.query("delete from organizations where name like $1", [`runtime%${suffix}`]);
  } finally {
    c.release();
    await pool.end();
  }
});

describe("runtime acceptance", () => {
  it("fails readiness when authoritative PostgreSQL is unavailable", async () => {
    if (!pool) return;
    const port = String(Number(new URL(baseUrl).port) + 1);
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await json(response);
    assert.equal(response.status, 503);
    assert.equal(body.status, "DEGRADED");
    assert.equal(body.database, "UNAVAILABLE");
    assert.equal(body.syntheticData, false);
  });

  it("requires authentication and returns only authoritative status", async () => {
    if (!pool) return;
    const unauthorized = await request("/api/v1/overview");
    assert.equal(unauthorized.status, 401);
    const status = await request("/api/v1/status");
    assert.equal(status.status, 200);
    assert.equal((await json(status)).syntheticData, false);
  });

  it("rejects writes outside the authenticated organization's geography scope", async () => {
    if (!pool) return;
    const response = await request("/api/v1/resource-flows", {
      method: "POST",
      body: JSON.stringify({ organizationId: orgId, originType: "COLLECTION", resourceForm: "BALE", materialCode: "TEST", unit: "kg", quantity: 1, sourceGeographyId: outOfScopeGeographyId }),
    }, actorToken);
    assert.equal(response.status, 403);
    assert.equal((await json(response)).code, "GEOGRAPHY_FORBIDDEN");
  });

  it("blocks pending field devices, then accepts a verified device and enforces replay ownership", async () => {
    if (!pool) return;
    const payload = { operationType: "ACTIVITY_CREATE", organizationId: orgId, activityType: "COLLECTION", geographyId };
    const pending = await request("/api/v1/field-sync/envelopes", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: `pending-${suffix}`, deviceId: pendingDeviceId, clientSequence: 1, capturedAt: new Date().toISOString(), payload }),
    }, actorToken);
    assert.equal(pending.status, 403);
    assert.equal((await json(pending)).code, "DEVICE_FORBIDDEN");

    const accepted = await request("/api/v1/field-sync/envelopes", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: `accepted-${suffix}`, deviceId: verifiedDeviceId, clientSequence: 1, capturedAt: new Date().toISOString(), payload }),
    }, actorToken);
    assert.equal(accepted.status, 202);
    const acceptedBody = await json(accepted);
    envelopeId = acceptedBody.envelope.id;

    const replay = await request("/api/v1/field-sync/envelopes", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: `accepted-${suffix}`, deviceId: verifiedDeviceId, clientSequence: 1, capturedAt: new Date().toISOString(), payload }),
    }, actorToken);
    assert.equal(replay.status, 200);
    assert.equal((await json(replay)).replay, true);

    const crossIdentity = await request("/api/v1/field-sync/envelopes", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: `accepted-${suffix}`, deviceId: verifiedDeviceId, clientSequence: 1, capturedAt: new Date().toISOString(), payload }),
    }, verifierToken);
    assert.equal(crossIdentity.status, 403);
  });

  it("executes activity → measurement → evidence → verification through API routes", async () => {
    if (!pool) return;
    const apply = await request(`/api/v1/field-sync/envelopes/${envelopeId}/apply`, { method: "POST", body: "{}" }, actorToken);
    assert.equal(apply.status, 200);
    activityId = (await json(apply)).entityId;

    const measurement = await request(`/api/v1/activities/${activityId}/measurements`, {
      method: "POST",
      body: JSON.stringify({ value: 10, unit: "kg", method: "WEIGHBRIDGE", source: "FIELD", measuredAt: new Date().toISOString() }),
    }, actorToken);
    assert.equal(measurement.status, 201);
    measurementId = (await json(measurement)).measurement.id;

    const evidence = await request(`/api/v1/activities/${activityId}/evidence`, {
      method: "POST",
      body: JSON.stringify({ evidenceType: "WEIGHBRIDGE_RECORD", capturedAt: new Date().toISOString(), contentHash: `sha256:${suffix}`, measurementId }),
    }, actorToken);
    assert.equal(evidence.status, 201);
    evidenceId = (await json(evidence)).evidence.id;

    const selfApprove = await request(`/api/v1/evidence/${evidenceId}/verification`, {
      method: "POST",
      body: JSON.stringify({ decision: "APPROVED", scope: "runtime" }),
    }, actorToken);
    assert.equal(selfApprove.status, 403);
    assert.equal((await json(selfApprove)).code, "VERIFICATION_FORBIDDEN");

    const verified = await request(`/api/v1/evidence/${evidenceId}/verification`, {
      method: "POST",
      body: JSON.stringify({ decision: "APPROVED", scope: "runtime" }),
    }, verifierToken);
    assert.equal(verified.status, 201);

    const state = await pool.query<{ activity_status: string; evidence_status: string }>("select a.status as activity_status,e.status as evidence_status from activities a join evidence e on e.activity_id=a.id where a.id=$1 and e.id=$2", [activityId, evidenceId]);
    assert.equal(state.rows[0]?.evidence_status, "VERIFIED");
    assert.equal(state.rows[0]?.activity_status, "DRAFT");
  });
});
