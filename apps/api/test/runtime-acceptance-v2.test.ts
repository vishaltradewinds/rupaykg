import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const port = Number(process.env.RUNTIME_ACCEPTANCE_PORT ?? 43127);
const baseUrl = `http://127.0.0.1:${port}`;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 4 }) : null;
const suffix = randomUUID();
let server: ChildProcess | null = null;
let noDbServer: ChildProcess | null = null;
let serverError = "";
let noDbServerError = "";
let orgId = "";
let geographyId = "";
let outOfScopeGeographyId = "";
let actorId = "";
let verifierId = "";
let actorToken = "";
let verifierToken = "";
let verifiedDeviceId = "";
let envelopeId = "";
let activityId = "";
let evidenceId = "";

const token = () => randomBytes(32).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const capture = (child: ChildProcess, target: "server" | "noDb") => {
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => { if (target === "server") serverError += chunk; else noDbServerError += chunk; });
};
async function waitFor(url: string, status: number, child: ChildProcess): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 15_000) {
    if (child.exitCode !== null) throw new Error(`runtime server exited with ${child.exitCode}: ${serverError || noDbServerError}`);
    try { if ((await fetch(url)).status === status) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${url} => ${status}`);
}
async function request(path: string, init: RequestInit = {}, bearer?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}
async function body(response: Response): Promise<Record<string, any>> { return (await response.json()) as Record<string, any>; }

before(async () => {
  if (!pool) return;
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    orgId = (await c.query<{ id: string }>("insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id", [`runtime-${suffix}`])).rows[0]!.id;
    geographyId = (await c.query<{ id: string }>("insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id", [`RUNTIME-${suffix}`, `Runtime ${suffix}`])).rows[0]!.id;
    outOfScopeGeographyId = (await c.query<{ id: string }>("insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id", [`OTHER-${suffix}`, `Other ${suffix}`])).rows[0]!.id;
    await c.query("insert into organization_geography_scopes(organization_id,geography_id) values($1,$2)", [orgId, geographyId]);
    actorId = (await c.query<{ id: string }>("insert into identities(external_subject,display_name) values($1,$2) returning id", [`runtime-actor-${suffix}`, "Runtime Actor"])).rows[0]!.id;
    verifierId = (await c.query<{ id: string }>("insert into identities(external_subject,display_name) values($1,$2) returning id", [`runtime-verifier-${suffix}`, "Runtime Verifier"])).rows[0]!.id;
    const actorRole = (await c.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,'[]') returning id", [orgId, `ACTOR-${suffix}`])).rows[0]!.id;
    const verifierRole = (await c.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,'[\"VERIFY_EVIDENCE\"]') returning id", [orgId, `VERIFIER-${suffix}`])).rows[0]!.id;
    await c.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$5,'VERIFIED')", [actorId, orgId, actorRole, verifierId, verifierRole]);
    actorToken = token(); verifierToken = token();
    await c.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4)", [actorId, hash(actorToken), verifierId, hash(verifierToken)]);
    verifiedDeviceId = (await c.query<{ id: string }>("insert into field_devices(device_id,identity_id,organization_id,status) values($1,$2,$3,'VERIFIED') returning id", [`verified-${suffix}`, actorId, orgId])).rows[0]!.id;
    await c.query("COMMIT");
  } catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }

  server = spawn(process.execPath, ["dist/src/server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DATABASE_URL: databaseUrl, DATABASE_SSL: "false" }, stdio: ["ignore", "ignore", "pipe"] });
  capture(server, "server");
  await waitFor(`${baseUrl}/health`, 200, server);

  const noDbPort = String(port + 1);
  noDbServer = spawn(process.execPath, ["dist/src/server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: noDbPort, HOST: "127.0.0.1", DATABASE_URL: "", DATABASE_SSL: "false" }, stdio: ["ignore", "ignore", "pipe"] });
  capture(noDbServer, "noDb");
  await waitFor(`http://127.0.0.1:${noDbPort}/health`, 503, noDbServer);
});

after(async () => {
  noDbServer?.kill("SIGTERM"); server?.kill("SIGTERM");
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
    await c.query("delete from identity_sessions where identity_id in ($1,$2)", [actorId, verifierId]);
    await c.query("delete from organization_memberships where organization_id=$1", [orgId]);
    await c.query("delete from roles where organization_id=$1", [orgId]);
    await c.query("delete from organization_geography_scopes where organization_id=$1", [orgId]);
    await c.query("delete from identities where id in ($1,$2)", [actorId, verifierId]);
    await c.query("delete from geography where id in ($1,$2)", [geographyId, outOfScopeGeographyId]);
    await c.query("delete from organizations where id=$1", [orgId]);
  } finally { c.release(); await pool.end(); }
});

describe("runtime acceptance", () => {
  it("fails readiness without authoritative PostgreSQL", async () => {
    if (!pool) return;
    const response = await fetch(`http://127.0.0.1:${port + 1}/health`);
    const result = await body(response);
    assert.equal(response.status, 503); assert.equal(result.status, "DEGRADED"); assert.equal(result.database, "UNAVAILABLE"); assert.equal(result.syntheticData, false);
  });

  it("requires authentication and enforces geography authorization", async () => {
    if (!pool) return;
    assert.equal((await request("/api/v1/overview")).status, 401);
    const denied = await request("/api/v1/resource-flows", { method: "POST", body: JSON.stringify({ organizationId: orgId, originType: "COLLECTION", resourceForm: "BALE", materialCode: "TEST", unit: "kg", quantity: 1, sourceGeographyId: outOfScopeGeographyId }) }, actorToken);
    assert.equal(denied.status, 403); assert.equal((await body(denied)).code, "GEOGRAPHY_FORBIDDEN");
  });

  it("blocks pending devices and makes replay idempotent while rejecting cross-identity reuse", async () => {
    if (!pool) return;
    const pendingId = (await pool.query<{ id: string }>("insert into field_devices(device_id,identity_id,organization_id,status) values($1,$2,$3,'PENDING') returning id", [`pending-${suffix}`, actorId, orgId])).rows[0]!.id;
    const capturedAt = new Date().toISOString();
    const payload = { operationType: "ACTIVITY_CREATE", organizationId: orgId, activityType: "COLLECTION", geographyId };
    const make = (deviceId: string, identityToken: string) => request("/api/v1/field-sync/envelopes", { method: "POST", body: JSON.stringify({ idempotencyKey: `runtime-${suffix}`, deviceId, clientSequence: 1, capturedAt, payload }) }, identityToken);
    const pending = await make(pendingId, actorToken); assert.equal(pending.status, 403); assert.equal((await body(pending)).code, "DEVICE_FORBIDDEN");
    const accepted = await make(verifiedDeviceId, actorToken); assert.equal(accepted.status, 202); envelopeId = (await body(accepted)).envelope.id;
    const replay = await make(verifiedDeviceId, actorToken); assert.equal(replay.status, 200); assert.equal((await body(replay)).replay, true);
    const cross = await make(verifiedDeviceId, verifierToken); assert.equal(cross.status, 403);
  });

  it("executes activity, measurement, evidence and independent verification through the API", async () => {
    if (!pool) return;
    const apply = await request(`/api/v1/field-sync/envelopes/${envelopeId}/apply`, { method: "POST", body: "{}" }, actorToken);
    assert.equal(apply.status, 200); activityId = (await body(apply)).entityId;
    const measuredAt = new Date().toISOString();
    const measurement = await request(`/api/v1/activities/${activityId}/measurements`, { method: "POST", body: JSON.stringify({ value: 10, unit: "kg", method: "WEIGHBRIDGE", source: "FIELD", measuredAt }) }, actorToken);
    assert.equal(measurement.status, 201);
    const measurementId = (await body(measurement)).measurement.id;
    const evidence = await request(`/api/v1/activities/${activityId}/evidence`, { method: "POST", body: JSON.stringify({ evidenceType: "WEIGHBRIDGE_RECORD", capturedAt: measuredAt, contentHash: `sha256:${suffix}`, measurementId }) }, actorToken);
    assert.equal(evidence.status, 201); evidenceId = (await body(evidence)).evidence.id;
    const self = await request(`/api/v1/evidence/${evidenceId}/verification`, { method: "POST", body: JSON.stringify({ decision: "APPROVED", scope: "runtime" }) }, actorToken);
    assert.equal(self.status, 403);
    const verified = await request(`/api/v1/evidence/${evidenceId}/verification`, { method: "POST", body: JSON.stringify({ decision: "APPROVED", scope: "runtime" }) }, verifierToken);
    assert.equal(verified.status, 201);
    const state = await pool.query<{ activity_status: string; evidence_status: string }>("select a.status activity_status,e.status evidence_status from activities a join evidence e on e.activity_id=a.id where a.id=$1 and e.id=$2", [activityId, evidenceId]);
    assert.equal(state.rows[0]?.activity_status, "DRAFT"); assert.equal(state.rows[0]?.evidence_status, "VERIFIED");
  });
});
