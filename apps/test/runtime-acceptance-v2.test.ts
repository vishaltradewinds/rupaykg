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
let methodologyId = "";

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
async function submitAndApply(payload: Record<string, unknown>, identityToken: string, clientSequence: number, idempotencyKey: string): Promise<Record<string, any>> {
  const capturedAt = new Date().toISOString();
  const accepted = await request("/api/v1/field-sync/envelopes", { method: "POST", body: JSON.stringify({ idempotencyKey, deviceId: verifiedDeviceId, clientSequence, capturedAt, payload }) }, identityToken);
  assert.equal(accepted.status, 202);
  const acceptedBody = await body(accepted);
  const id = acceptedBody.envelope.id as string;
  const applied = await request(`/api/v1/field-sync/envelopes/${id}/apply`, { method: "POST", body: "{}" }, identityToken);
  assert.equal(applied.status, 200);
  return body(applied);
}

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
    const actorRole = (await c.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,'[\"FIELD_SYNC\"]') returning id", [orgId, `ACTOR-${suffix}`])).rows[0]!.id;
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
    const cross = await make(verifiedDeviceId, verifierToken); assert.equal(cross.status, 403);
  });

  it("executes activity, measurement, evidence and independent verification through the authoritative API", async () => {
    if (!pool) return;
    const apply = await request(`/api/v1/field-sync/envelopes/${envelopeId}/apply`, { method: "POST", body: "{}" }, actorToken);
    assert.equal(apply.status, 200); activityId = (await body(apply)).entityId;
    const measuredAt = new Date().toISOString();
    const measurementApplied = await submitAndApply({ operationType: "MEASUREMENT_CREATE", activityId, value: 10, unit: "kg", method: "WEIGHBRIDGE", source: "FIELD", measuredAt }, actorToken, 2, `measurement-${suffix}`);
    const measurementId = measurementApplied.entityId as string;
    const evidenceApplied = await submitAndApply({ operationType: "EVIDENCE_CREATE", activityId, evidenceType: "WEIGHBRIDGE_RECORD", capturedAt: measuredAt, contentHash: `sha256:${suffix}`, measurementId }, actorToken, 3, `evidence-${suffix}`);
    evidenceId = evidenceApplied.entityId as string;
    const self = await request(`/api/v1/evidence/${evidenceId}/verification`, { method: "POST", body: JSON.stringify({ decision: "APPROVED", scope: "runtime" }) }, actorToken);
    assert.equal(self.status, 403);
    const verified = await request(`/api/v1/evidence/${evidenceId}/verification`, { method: "POST", body: JSON.stringify({ decision: "APPROVED", scope: "runtime" }) }, verifierToken);
    assert.equal(verified.status, 201);
    const state = await pool.query<{ activity_status: string; evidence_status: string }>("select a.status activity_status,e.status evidence_status from activities a join evidence e on e.activity_id=a.id where a.id=$1 and e.id=$2", [activityId, evidenceId]);
    assert.equal(state.rows[0]?.activity_status, "DRAFT"); assert.equal(state.rows[0]?.evidence_status, "VERIFIED");
  });

  it("fails closed when evidence belongs to a different activity, then binds valid carbon calculations to deterministic provenance", async () => {
    if (!pool) return;
    methodologyId = randomUUID();
    await pool.query("insert into methodology_versions(id,methodology_code,version,rules,governance_status) values($1,$2,$3,$4,'SOURCE_LOCKED')", [methodologyId, `RUNTIME-${suffix}`, "1", JSON.stringify({ formula: "baseline-project-leakage-uncertainty" })]);
    const otherActivityId = (await pool.query<{ id: string }>("insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status) values($1,$2,$3,'COLLECTION','DRAFT') returning id", [orgId, actorId, geographyId])).rows[0]!.id;
    const mismatch = await request("/api/v1/carbon/calculations", { method: "POST", body: JSON.stringify({ activityId: otherActivityId, methodologyCode: `RUNTIME-${suffix}`, methodologyVersion: "1", evidenceId, baselineTco2e: 100, projectTco2e: 40, leakageTco2e: 5, uncertaintyTco2e: 2 }) }, actorToken);
    assert.equal(mismatch.status, 409); assert.equal((await body(mismatch)).code, "EVIDENCE_ACTIVITY_MISMATCH");
    const calculated = await request("/api/v1/carbon/calculations", { method: "POST", body: JSON.stringify({ activityId, methodologyCode: `RUNTIME-${suffix}`, methodologyVersion: "1", evidenceId, baselineTco2e: 100, projectTco2e: 40, leakageTco2e: 5, uncertaintyTco2e: 2 }) }, actorToken);
    assert.equal(calculated.status, 201);
    const result = await body(calculated);
    assert.equal(result.syntheticData, false);
    assert.equal(result.calculation.provenance_version, "1");
    assert.match(result.calculation.dataset_hash, /^[a-f0-9]{64}$/);
    assert.match(result.calculation.formula_hash, /^[a-f0-9]{64}$/);
    assert.match(result.calculation.calculation_hash, /^[a-f0-9]{64}$/);
    const second = await request("/api/v1/carbon/calculations", { method: "POST", body: JSON.stringify({ activityId, methodologyCode: `RUNTIME-${suffix}`, methodologyVersion: "1", evidenceId, baselineTco2e: 100, projectTco2e: 40, leakageTco2e: 5, uncertaintyTco2e: 2 }) }, actorToken);
    assert.equal(second.status, 201);
    const secondResult = await body(second);
    assert.equal(secondResult.calculation.dataset_hash, result.calculation.dataset_hash);
    assert.equal(secondResult.calculation.formula_hash, result.calculation.formula_hash);
    assert.equal(secondResult.calculation.calculation_hash, result.calculation.calculation_hash);
  });

  it("keeps intelligence advisory and non-mutating", async () => {
    if (!pool) return;
    const beforeState = (await pool.query<{ status: string }>("select status from activities where id=$1", [activityId])).rows[0]?.status;
    const response = await request("/api/v1/workspaces/intelligence", {}, actorToken);
    assert.equal(response.status, 200);
    const result = await body(response);
    assert.equal(result.advisory, true); assert.equal(result.syntheticData, false);
    assert.ok((result.findings ?? []).every((finding: any) => finding.authoritativeMutation === false));
    const afterState = (await pool.query<{ status: string }>("select status from activities where id=$1", [activityId])).rows[0]?.status;
    assert.equal(afterState, beforeState);
  });
});
