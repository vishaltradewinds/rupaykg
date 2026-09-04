import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const port = Number(process.env.RUNTIME_REGISTRY_PORT ?? 43129);
const baseUrl = `http://127.0.0.1:${port}`;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 4 }) : null;
const suffix = randomUUID();
let server: ChildProcess | null = null;
let ownerOrgId = "";
let destinationOrgId = "";
let geographyId = "";
let actorId = "";
let verifierId = "";
let actorToken = "";
let verifierToken = "";
let activityId = "";
let evidenceId = "";
let verificationId = "";
let credentialId = "";
let settlementId = "";

const token = () => randomBytes(32).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function waitFor(url: string, status: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 15_000) {
    if (server?.exitCode !== null) throw new Error(`runtime server exited with ${server?.exitCode}`);
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
    await c.query("begin");
    ownerOrgId = (await c.query<{ id: string }>("insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id", [`runtime-registry-owner-${suffix}`])).rows[0]!.id;
    destinationOrgId = (await c.query<{ id: string }>("insert into organizations(name,organization_type) values($1,'PROCESSOR') returning id", [`runtime-registry-destination-${suffix}`])).rows[0]!.id;
    geographyId = (await c.query<{ id: string }>("insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id", [`REGISTRY-${suffix}`, `Registry Runtime ${suffix}`])).rows[0]!.id;
    await c.query("insert into organization_geography_scopes(organization_id,geography_id) values($1,$2)", [ownerOrgId, geographyId]);
    actorId = (await c.query<{ id: string }>("insert into identities(external_subject,display_name) values($1,$2) returning id", [`runtime-registry-actor-${suffix}`, "Registry Runtime Actor"])).rows[0]!.id;
    verifierId = (await c.query<{ id: string }>("insert into identities(external_subject,display_name) values($1,$2) returning id", [`runtime-registry-verifier-${suffix}`, "Registry Runtime Verifier"])).rows[0]!.id;
    const actorRole = (await c.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,$3::jsonb) returning id", [ownerOrgId, `REGISTRY-OPERATOR-${suffix}`, JSON.stringify(["ISSUE_CREDENTIAL","TRANSFER_CREDENTIAL","RETIRE_CREDENTIAL","AUTHORIZE_SETTLEMENT","SETTLE_FUNDS"])] )).rows[0]!.id;
    const verifierRole = (await c.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,'[\"VERIFY_EVIDENCE\"]') returning id", [ownerOrgId, `REGISTRY-VERIFIER-${suffix}`])).rows[0]!.id;
    await c.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$5,'VERIFIED')", [actorId, ownerOrgId, actorRole, verifierId, verifierRole]);
    actorToken = token(); verifierToken = token();
    await c.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4)", [actorId, hash(actorToken), verifierId, hash(verifierToken)]);
    activityId = (await c.query<{ id: string }>("insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status,completed_at) values($1,$2,$3,'COLLECTION','COMPLETED',now()) returning id", [ownerOrgId, actorId, geographyId])).rows[0]!.id;
    const measurementId = (await c.query<{ id: string }>("insert into measurements(activity_id,value,unit,method,source,measured_at,quality_status) values($1,100,'kg','WEIGHBRIDGE','FIELD',now(),'VERIFIED') returning id", [activityId])).rows[0]!.id;
    evidenceId = (await c.query<{ id: string }>("insert into evidence(activity_id,measurement_id,evidence_type,status,captured_at,content_hash) values($1,$2,'WEIGHBRIDGE_RECORD','VERIFIED',now(),$3) returning id", [activityId, measurementId, `runtime-${suffix}`])).rows[0]!.id;
    verificationId = (await c.query<{ id: string }>("insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','runtime','independent runtime acceptance') returning id", [evidenceId, activityId, verifierId])).rows[0]!.id;
    await c.query("commit");
  } catch (error) { await c.query("rollback"); throw error; } finally { c.release(); }
  server = spawn(process.execPath, ["dist/src/server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DATABASE_URL: databaseUrl, DATABASE_SSL: "false" }, stdio: ["ignore", "ignore", "pipe"] });
  await waitFor(`${baseUrl}/health`, 200);
});

after(async () => {
  server?.kill("SIGTERM");
  if (pool) await pool.end();
});

describe("registry and settlement runtime acceptance", () => {
  it("requires explicit registry permission before issuance", async () => {
    if (!pool) return;
    const deniedRole = (await pool.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,'[]') returning id", [ownerOrgId, `DENIED-${suffix}`])).rows[0]!.id;
    const deniedIdentity = (await pool.query<{ id: string }>("insert into identities(external_subject,display_name) values($1,$2) returning id", [`runtime-registry-denied-${suffix}`, "Denied Registry Actor"])).rows[0]!.id;
    const deniedToken = token();
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [deniedIdentity, ownerOrgId, deniedRole]);
    await pool.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2)", [deniedIdentity, hash(deniedToken)]);
    const response = await request("/api/v1/credentials", { method: "POST", body: JSON.stringify({ activityId, trustRootId: `runtime-root-${suffix}`, verificationId, issuerOrganizationId: ownerOrgId, quantity: 100, unit: "kg" }) }, deniedToken);
    assert.equal(response.status, 403);
    assert.equal((await body(response)).code, "HIGH_RISK_PERMISSION_REQUIRED");
  });

  it("issues and activates only after verified evidence and approved independent verification", async () => {
    if (!pool) return;
    const response = await request("/api/v1/credentials", { method: "POST", body: JSON.stringify({ activityId, trustRootId: `runtime-root-${suffix}`, verificationId, issuerOrganizationId: ownerOrgId, quantity: 100, unit: "kg" }) }, actorToken);
    assert.equal(response.status, 201);
    const result = await body(response);
    assert.equal(result.syntheticData, false);
    credentialId = result.credential.id;
    assert.equal(result.credential.status, "ISSUED");
    const activated = await request(`/api/v1/credentials/${credentialId}/activate`, { method: "POST", body: "{}" }, actorToken);
    assert.equal(activated.status, 200);
    assert.equal((await body(activated)).credential.status, "ACTIVE");
  });

  it("runs settlement through authorization, execution, external confirmation and reconciliation", async () => {
    if (!pool) return;
    const created = await request("/api/v1/settlements", { method: "POST", body: JSON.stringify({ credentialId, payerId: ownerOrgId, payeeId: destinationOrgId, amount: 1250, currency: "INR", externalReference: `payment-${suffix}` }) }, actorToken);
    assert.equal(created.status, 201);
    settlementId = (await body(created)).settlement.id;
    const authorized = await request(`/api/v1/settlements/${settlementId}/authorize`, { method: "POST", body: JSON.stringify({ authorizationReference: `auth-${suffix}` }) }, actorToken);
    assert.equal(authorized.status, 200);
    assert.equal((await body(authorized)).settlement.status, "AUTHORIZED");
    const settled = await request(`/api/v1/settlements/${settlementId}/settle`, { method: "POST", body: JSON.stringify({ externalReference: `payment-${suffix}` }) }, actorToken);
    assert.equal(settled.status, 200);
    assert.equal((await body(settled)).settlement.status, "RECONCILING");
    const premature = await pool.query("update settlements set status='SETTLED' where id=$1", [settlementId]).then(() => null).catch(error => error);
    assert.ok(premature instanceof Error);
    const confirmed = await request(`/api/v1/settlements/${settlementId}/confirm`, { method: "POST", body: JSON.stringify({ confirmationReference: `bank-confirm-${suffix}`, reconciliationReference: `recon-${suffix}` }) }, actorToken);
    assert.equal(confirmed.status, 200);
    const confirmedBody = await body(confirmed);
    assert.equal(confirmedBody.settlement.status, "SETTLED");
    assert.equal(confirmedBody.settlement.external_confirmed_at !== null, true);
    assert.equal(confirmedBody.settlement.reconciliation_reference, `recon-${suffix}`);
    const immutable = await pool.query("update settlements set external_confirmed_at=null where id=$1", [settlementId]).then(() => null).catch(error => error);
    assert.ok(immutable instanceof Error);
    const reauthorize = await request(`/api/v1/settlements/${settlementId}/authorize`, { method: "POST", body: JSON.stringify({ authorizationReference: `auth-repeat-${suffix}` }) }, actorToken);
    assert.equal(reauthorize.status, 409);
    const resettle = await request(`/api/v1/settlements/${settlementId}/settle`, { method: "POST", body: JSON.stringify({ externalReference: `payment-repeat-${suffix}` }) }, actorToken);
    assert.equal(resettle.status, 409);
    const reconfirm = await request(`/api/v1/settlements/${settlementId}/confirm`, { method: "POST", body: JSON.stringify({ confirmationReference: `bank-confirm-repeat-${suffix}`, reconciliationReference: `recon-repeat-${suffix}` }) }, actorToken);
    assert.equal(reconfirm.status, 409);
  });

  it("requires current-owner transfer permission and permits governed retirement", async () => {
    if (!pool) return;
    const denied = await request(`/api/v1/credentials/${credentialId}/transfer`, { method: "POST", body: JSON.stringify({ toOwnerId: destinationOrgId }) }, verifierToken);
    assert.equal(denied.status, 403);
    assert.equal((await body(denied)).code, "HIGH_RISK_PERMISSION_REQUIRED");
    const transferred = await request(`/api/v1/credentials/${credentialId}/transfer`, { method: "POST", body: JSON.stringify({ toOwnerId: destinationOrgId }) }, actorToken);
    assert.equal(transferred.status, 200);
    assert.equal((await body(transferred)).registryEvent.event_type, "TRANSFERRED");
    const staleOwnerTransfer = await request(`/api/v1/credentials/${credentialId}/transfer`, { method: "POST", body: JSON.stringify({ toOwnerId: ownerOrgId }) }, actorToken);
    assert.equal(staleOwnerTransfer.status, 403);
    assert.equal((await body(staleOwnerTransfer)).code, "ORG_FORBIDDEN");
    const destinationRole = (await pool.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,$3::jsonb) returning id", [destinationOrgId, `RETIRE-${suffix}`, JSON.stringify(["RETIRE_CREDENTIAL"])] )).rows[0]!.id;
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [actorId, destinationOrgId, destinationRole]);
    const retired = await request(`/api/v1/credentials/${credentialId}/retire`, { method: "POST", body: "{}" }, actorToken);
    assert.equal(retired.status, 200);
    assert.equal((await body(retired)).registryEvent.event_type, "RETIRED");
    const retiredSettlement = await request("/api/v1/settlements", { method: "POST", body: JSON.stringify({ credentialId, payerId: destinationOrgId, payeeId: ownerOrgId, amount: 1, currency: "INR" }) }, actorToken);
    assert.equal(retiredSettlement.status, 409);
    assert.equal((await body(retiredSettlement)).code, "CREDENTIAL_RETIRED");
    const state = await pool.query<{ status: string }>("select status from credentials where id=$1", [credentialId]);
    assert.equal(state.rows[0]?.status, "RETIRED");
  });
});
