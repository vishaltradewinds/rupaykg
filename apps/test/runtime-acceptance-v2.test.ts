import test, { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;
const port = 3310 + Math.floor(Math.random() * 200);
const baseUrl = `http://127.0.0.1:${port}`;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } }) : null;
let server: ChildProcess | undefined;
let noDbServer: ChildProcess | undefined;
let orgId = "";
let actorId = "";
let verifierId = "";
let geographyId = "";
let outOfScopeGeographyId = "";
let verifiedDeviceId = "";
let envelopeId = "";
let methodologyId = "";
const suffix = randomUUID().slice(0, 8);

async function body(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

async function request(path: string, options: RequestInit = {}, token?: string) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) },
  });
}

function capture(child: ChildProcess, name: string) {
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
}

async function waitFor(url: string, expected: number, child: ChildProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status === expected) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (child.exitCode !== null) throw new Error(`${url} process exited with ${child.exitCode}`);
  }
  throw new Error(`Timed out waiting for ${url} -> ${expected}`);
}

before(async () => {
  if (!pool) return;
  const c = await pool.connect();
  try {
    orgId = randomUUID(); actorId = randomUUID(); verifierId = randomUUID(); geographyId = randomUUID(); outOfScopeGeographyId = randomUUID(); verifiedDeviceId = `verified-${suffix}`; methodologyId = randomUUID();
    await c.query("begin");
    await c.query("insert into organizations(id,name,organization_type) values($1,$2,$3)", [orgId, `Runtime Test ${suffix}`, "TEST"]);
    await c.query("insert into identities(id,email,email_verified) values($1,$2,true),($3,$4,true)", [actorId, `actor-${suffix}@example.com`, verifierId, `verifier-${suffix}@example.com`]);
    await c.query("insert into geography(id,name,level) values($1,$2,$3),($4,$5,$6)", [geographyId, `Test Geo ${suffix}`, "STATE", outOfScopeGeographyId, `Other Geo ${suffix}`, "STATE"]);
    await c.query("insert into organization_geography_scopes(organization_id,geography_id) values($1,$2)", [orgId, geographyId]);
    await c.query("insert into roles(id,organization_id,name,permissions) values($1,$2,$3,$4),($5,$2,$6,$7)", [randomUUID(), orgId, "ACTOR", JSON.stringify(["waste:read","waste:write","evidence:upload"]), randomUUID(), "VERIFIER", JSON.stringify(["evidence:upload","evidence:review","guardian:read"]) ]);
    await c.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,(select id from roles where organization_id=$2 and name='ACTOR' limit 1),'VERIFIED'),($3,$2,(select id from roles where organization_id=$2 and name='VERIFIER' limit 1),'VERIFIED')", [actorId, orgId, verifierId]);
    await c.query("insert into field_devices(device_id,identity_id,organization_id,status) values($1,$2,$3,'VERIFIED')", [verifiedDeviceId, actorId, orgId]);
    await c.query("commit");
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
    await c.query("delete from environmental_attribute_claims where activity_id in (select id from activities where organization_id=$1)", [orgId]);
    await c.query("delete from carbon_calculations where activity_id in (select id from activities where organization_id=$1)", [orgId]);
    await c.query("delete from verifications where evidence_id in (select id from evidence where activity_id in (select id from activities where organization_id=$1))", [orgId]);
    await c.query("delete from evidence where activity_id in (select id from activities where organization_id=$1)", [orgId]);
    await c.query("delete from measurements where activity_id in (select id from activities where organization_id=$1)", [orgId]);
    await c.query("delete from activities where organization_id=$1", [orgId]);
    if (methodologyId) await c.query("delete from methodology_versions where id=$1", [methodologyId]);
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
  });
});
