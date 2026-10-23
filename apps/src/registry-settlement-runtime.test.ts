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
async function waitFor(url: string, status: number): Promise<void> { const start = Date.now(); while (Date.now() - start < 15_000) { if (server?.exitCode !== null) throw new Error(`runtime server exited with ${server?.exitCode}`); try { if ((await fetch(url)).status === status) return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error(`timed out waiting for ${url} => ${status}`); }
async function request(path: string, init: RequestInit = {}, bearer?: string, organizationId?: string): Promise<Response> { const headers = new Headers(init.headers); if (bearer) headers.set("authorization", `Bearer ${bearer}`); if (organizationId) headers.set("x-rupaykg-organization-id", organizationId); if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json"); return fetch(`${baseUrl}${path}`, { ...init, headers }); }
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
    await c.query("update organizations set verification_status='VERIFIED',verified_by_identity_id=$3,verified_at=now() where id in ($1,$2)", [ownerOrgId, destinationOrgId, verifierId]);
    await c.query("insert into organization_verification_evidence(organization_id,evidence_type,document_reference,content_hash,issuer_name,status,verified_by_identity_id,verified_at) values($1,'LEGAL_REGISTRATION','runtime-legal-record-owner-'||$4,'runtime-legal-hash-owner-'||$4,'Runtime Test Authority','VERIFIED',$3,now()),($2,'LEGAL_REGISTRATION','runtime-legal-record-destination-'||$4,'runtime-legal-hash-destination-'||$4,'Runtime Test Authority','VERIFIED',$3,now())", [ownerOrgId, destinationOrgId, verifierId, suffix]);
    const actorRole = (await c.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,$3::jsonb) returning id", [ownerOrgId, `REGISTRY-OPERATOR-${suffix}`, JSON.stringify(["ISSUE_CREDENTIAL","TRANSFER_CREDENTIAL","RETIRE_CREDENTIAL","AUTHORIZE_SETTLEMENT","SETTLE_FUNDS","settlement:authorize","settlement:settle","guardian:read"])] )).rows[0]!.id;
    const verifierRole = (await c.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,'[\"VERIFY_EVIDENCE\"]') returning id", [ownerOrgId, `REGISTRY-VERIFIER-${suffix}`])).rows[0]!.id;
    await c.query("insert into roles(organization_id,name,permissions) values($1,$2,$3::jsonb)", [destinationOrgId, `SETTLEMENT-PARTY-${suffix}`, JSON.stringify(["settlement:authorize","settlement:settle"])]);
    await c.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$2,$5,'VERIFIED')", [actorId, ownerOrgId, actorRole, verifierId, verifierRole]);
    actorToken = token(); verifierToken = token();
    await c.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4)", [actorId, hash(actorToken), verifierId, hash(verifierToken)]);
    activityId = (await c.query<{ id: string }>("insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status,completed_at) values($1,$2,$3,'COLLECTION','COMPLETED',now()) returning id", [ownerOrgId, actorId, geographyId])).rows[0]!.id;
    const measurementId = (await c.query<{ id: string }>("insert into measurements(activity_id,value,unit,method,source,measured_at,quality_status) values($1,100,'kg','WEIGHBRIDGE','FIELD',now(),'VERIFIED') returning id", [activityId])).rows[0]!.id;
    evidenceId = (await c.query<{ id: string }>("insert into evidence(activity_id,measurement_id,evidence_type,status,captured_at,content_hash) values($1,$2,'WEIGHBRIDGE_RECORD','VERIFIED',now(),$3) returning id", [activityId, measurementId, `runtime-${suffix}`])).rows[0]!.id;
    verificationId = (await c.query<{ id: string }>("insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','runtime','independent runtime acceptance') returning id", [evidenceId, activityId, verifierId])).rows[0]!.id;
    await c.query("insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,metadata,mirror_node_verified_at) values($1,$2,$3,'runtime-policy','runtime-guardian','VERIFIED','CONSENSUS_CONFIRMED','0.0.123',$4,$5,$6,'{\"testFixture\":true}',clock_timestamp())", [activityId, verificationId, evidenceId, `runtime-tx-${suffix}`, `runtime-consensus-${suffix}`, `runtime-hash-${suffix}`]);
    await c.query("commit");
  } catch (error) { await c.query("rollback"); throw error; } finally { c.release(); }
  server = spawn(process.execPath, ["dist/src/server.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", DATABASE_URL: databaseUrl, DATABASE_SSL: "false" }, stdio: ["ignore", "ignore", "pipe"] });
  await waitFor(`${baseUrl}/health`, 200);
});

after(async () => { server?.kill("SIGTERM"); if (pool) await pool.end(); });

describe("registry and settlement runtime acceptance", () => {
  it("requires explicit registry permission before issuance", async () => {
    if (!pool) return;
    const deniedRole = (await pool.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,'[\"dashboard:read\"]') returning id", [ownerOrgId, `DENIED-${suffix}`])).rows[0]!.id;
    const deniedIdentity = (await pool.query<{ id: string }>("insert into identities(external_subject,display_name) values($1,$2) returning id", [`runtime-registry-denied-${suffix}`, "Denied Registry Actor"])).rows[0]!.id;
    const deniedToken = token();
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [deniedIdentity, ownerOrgId, deniedRole]);
    await pool.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2)", [deniedIdentity, hash(deniedToken)]);
    const response = await request("/api/v1/credentials", { method: "POST", body: JSON.stringify({ activityId, trustRootId: `runtime-root-${suffix}`, verificationId, issuerOrganizationId: ownerOrgId, quantity: 100, unit: "kg" }) }, deniedToken, ownerOrgId);
    assert.equal(response.status, 403); assert.equal((await body(response)).code, "HIGH_RISK_PERMISSION_REQUIRED");
  });

  it("fails closed when persisted Mirror Node verification is absent", async () => {
    if (!pool) return;
    await pool.query("update mrv_provenance_events set mirror_node_verified_at=null where activity_id=$1 and verification_id=$2", [activityId, verificationId]);
    try {
      const response = await request("/api/v1/credentials", { method: "POST", body: JSON.stringify({ activityId, trustRootId: "runtime-root-missing-mirror-" + suffix, verificationId, issuerOrganizationId: ownerOrgId, quantity: 100, unit: "kg" }) }, actorToken, ownerOrgId);
      assert.equal(response.status, 409);
      assert.equal((await body(response)).code, "MIRROR_NODE_VERIFICATION_REQUIRED");
      const pendingCredential = await pool.query<{ id: string }>(
        "insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id,quantity,unit,issued_at) values($1,$2,$3,'ELIGIBLE',$4,1,'kg',now()) returning id",
        [activityId, ownerOrgId, "runtime-root-db-trigger-" + suffix, verificationId],
      );
      try {
        await assert.rejects(
          pool.query("update credentials set status='ISSUED' where id=$1", [pendingCredential.rows[0]!.id]),
          /CREDENTIAL_MRV_REQUIRED/,
        );
      } finally {
        await pool.query("delete from credentials where id=$1", [pendingCredential.rows[0]!.id]);
      }
    } finally {
      await pool.query("update mrv_provenance_events set mirror_node_verified_at=clock_timestamp() where activity_id=$1 and verification_id=$2", [activityId, verificationId]);
    }
  });

  it("blocks acceptance fixture evidence from becoming a registry credential", async () => {
    if (!pool) return;
    await pool.query(
      "update evidence set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('acceptanceFixture',true) where id=$1",
      [evidenceId],
    );
    let pendingCredentialId = "";
    try {
      const provenanceResponse = await request(`/api/v1/mrv/provenance/${activityId}`, {}, actorToken, ownerOrgId);
      assert.equal(provenanceResponse.status, 200);
      const provenanceBody = await body(provenanceResponse);
      assert.equal(provenanceBody.eligibleForRegistry, false, "MRV API must never present acceptance fixture evidence as registry eligible");
      assert.equal(provenanceBody.registryEligibilityReason, "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE");

      const apiIssuance = await request("/api/v1/credentials", {
        method: "POST",
        body: JSON.stringify({ activityId, trustRootId: "runtime-root-fixture-api-" + suffix, verificationId, issuerOrganizationId: ownerOrgId, quantity: 1, unit: "kg" }),
      }, actorToken, ownerOrgId);
      assert.equal(apiIssuance.status, 409);
      assert.equal((await body(apiIssuance)).code, "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE");

      const pending = await pool.query<{ id: string }>(
        "insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id,quantity,unit,issued_at) values($1,$2,$3,'ELIGIBLE',$4,1,'kg',now()) returning id",
        [activityId, ownerOrgId, "runtime-root-acceptance-fixture-" + suffix, verificationId],
      );
      pendingCredentialId = pending.rows[0]!.id;
      await assert.rejects(
        pool.query("update credentials set status='ISSUED' where id=$1", [pendingCredentialId]),
        /ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE/,
        "database must prevent acceptance fixture evidence from backing an issued credential",
      );
    } finally {
      if (pendingCredentialId) await pool.query("delete from credentials where id=$1", [pendingCredentialId]);
      await pool.query(
        "update evidence set metadata=coalesce(metadata,'{}'::jsonb) - 'acceptanceFixture' where id=$1",
        [evidenceId],
      );
    }
  });

  it("invalidates persisted Mirror Node proof when the anchored provenance tuple changes", async () => {
    if (!pool) return;
    const original = await pool.query<{ hcs_transaction_id: string }>(
      "select hcs_transaction_id from mrv_provenance_events where activity_id=$1 and verification_id=$2",
      [activityId, verificationId],
    );
    const originalTransactionId = original.rows[0]?.hcs_transaction_id;
    assert.ok(originalTransactionId);
    await pool.query("update mrv_provenance_events set hcs_transaction_id=$1 where activity_id=$2 and verification_id=$3", ["changed-anchor-" + suffix, activityId, verificationId]);
    const invalidated = await pool.query<{ mirror_node_verified_at: Date | null }>(
      "select mirror_node_verified_at from mrv_provenance_events where activity_id=$1 and verification_id=$2",
      [activityId, verificationId],
    );
    assert.equal(invalidated.rows[0]?.mirror_node_verified_at, null, "anchor mutation must invalidate prior Mirror Node verification");
    await pool.query("update mrv_provenance_events set hcs_transaction_id=$1 where activity_id=$2 and verification_id=$3", [originalTransactionId, activityId, verificationId]);
    await pool.query("update mrv_provenance_events set mirror_node_verified_at=clock_timestamp() where activity_id=$1 and verification_id=$2", [activityId, verificationId]);
  });

  it("issues and activates only after verified evidence and approved independent verification", async () => {
    if (!pool) return;
    const response = await request("/api/v1/credentials", { method: "POST", body: JSON.stringify({ activityId, trustRootId: `runtime-root-${suffix}`, verificationId, issuerOrganizationId: ownerOrgId, quantity: 100, unit: "kg" }) }, actorToken, ownerOrgId);
    assert.equal(response.status, 201); const result = await body(response); assert.equal(result.syntheticData, false); credentialId = result.credential.id; assert.equal(result.credential.status, "ISSUED");
    const activated = await request(`/api/v1/credentials/${credentialId}/activate`, { method: "POST", body: "{}" }, actorToken, ownerOrgId);
    assert.equal(activated.status, 200); assert.equal((await body(activated)).credential.status, "ACTIVE");
  });

  it("runs settlement through authorization, execution, external confirmation and reconciliation", async () => {
    if (!pool) return;
    const destinationRole = (await pool.query<{ id: string }>("select id from roles where organization_id=$1 and name=$2", [destinationOrgId, `SETTLEMENT-PARTY-${suffix}`])).rows[0]!.id;
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [actorId, destinationOrgId, destinationRole]);
    const created = await request("/api/v1/settlements", { method: "POST", body: JSON.stringify({ credentialId, payerId: ownerOrgId, payeeId: destinationOrgId, amount: 1250, currency: "INR", externalReference: `payment-${suffix}` }) }, actorToken, ownerOrgId);
    assert.equal(created.status, 201); settlementId = (await body(created)).settlement.id;
    const authorized = await request(`/api/v1/settlements/${settlementId}/authorize`, { method: "POST", body: JSON.stringify({ authorizationReference: `auth-${suffix}` }) }, actorToken, ownerOrgId);
    assert.equal(authorized.status, 200); assert.equal((await body(authorized)).settlement.status, "AUTHORIZED");
    const settled = await request(`/api/v1/settlements/${settlementId}/settle`, { method: "POST", body: JSON.stringify({ externalReference: `payment-${suffix}` }) }, actorToken, ownerOrgId);
    assert.equal(settled.status, 200); assert.equal((await body(settled)).settlement.status, "RECONCILING");
    const premature = await pool.query("update settlements set status='SETTLED' where id=$1", [settlementId]).then(() => null).catch(error => error); assert.ok(premature instanceof Error);
    const confirmed = await request(`/api/v1/settlements/${settlementId}/confirm`, { method: "POST", body: JSON.stringify({ confirmationReference: `bank-confirm-${suffix}`, reconciliationReference: `recon-${suffix}` }) }, actorToken, ownerOrgId); assert.equal(confirmed.status, 200); const confirmedBody = await body(confirmed); assert.equal(confirmedBody.settlement.status, "SETTLED"); assert.equal(confirmedBody.settlement.external_confirmed_at !== null, true); assert.equal(confirmedBody.settlement.reconciliation_reference, `recon-${suffix}`);
    const immutable = await pool.query("update settlements set external_confirmed_at=null where id=$1", [settlementId]).then(() => null).catch(error => error); assert.ok(immutable instanceof Error);
    const reauthorize = await request(`/api/v1/settlements/${settlementId}/authorize`, { method: "POST", body: JSON.stringify({ authorizationReference: `auth-repeat-${suffix}` }) }, actorToken, ownerOrgId); assert.equal(reauthorize.status, 409);
    const resettle = await request(`/api/v1/settlements/${settlementId}/settle`, { method: "POST", body: JSON.stringify({ externalReference: `payment-repeat-${suffix}` }) }, actorToken, ownerOrgId); assert.equal(resettle.status, 409);
    const reconfirm = await request(`/api/v1/settlements/${settlementId}/confirm`, { method: "POST", body: JSON.stringify({ confirmationReference: `bank-confirm-repeat-${suffix}`, reconciliationReference: `recon-repeat-${suffix}` }) }, actorToken, ownerOrgId); assert.equal(reconfirm.status, 409);

    const secondCreated = await request("/api/v1/settlements", { method: "POST", body: JSON.stringify({ credentialId, payerId: ownerOrgId, payeeId: destinationOrgId, amount: 500, currency: "INR", externalReference: `payment-second-${suffix}` }) }, actorToken, ownerOrgId);
    assert.equal(secondCreated.status, 201); const secondSettlementId = (await body(secondCreated)).settlement.id;
    const secondAuthorized = await request(`/api/v1/settlements/${secondSettlementId}/authorize`, { method: "POST", body: JSON.stringify({ authorizationReference: `auth-second-${suffix}` }) }, actorToken, ownerOrgId); assert.equal(secondAuthorized.status, 200);
    const secondSettled = await request(`/api/v1/settlements/${secondSettlementId}/settle`, { method: "POST", body: JSON.stringify({ externalReference: `payment-second-${suffix}` }) }, actorToken, ownerOrgId); assert.equal(secondSettled.status, 200);
    const duplicateConfirmation = await request(`/api/v1/settlements/${secondSettlementId}/confirm`, { method: "POST", body: JSON.stringify({ confirmationReference: `bank-confirm-${suffix}`, reconciliationReference: `recon-second-${suffix}` }) }, actorToken, ownerOrgId); assert.equal(duplicateConfirmation.status, 409); assert.equal((await body(duplicateConfirmation)).code, "CONFIRMATION_REFERENCE_EXISTS");
    const duplicateReconciliation = await request(`/api/v1/settlements/${secondSettlementId}/confirm`, { method: "POST", body: JSON.stringify({ confirmationReference: `bank-confirm-second-${suffix}`, reconciliationReference: `recon-${suffix}` }) }, actorToken, ownerOrgId); assert.equal(duplicateReconciliation.status, 409); assert.equal((await body(duplicateReconciliation)).code, "RECONCILIATION_REFERENCE_EXISTS");
    const secondConfirmed = await request(`/api/v1/settlements/${secondSettlementId}/confirm`, { method: "POST", body: JSON.stringify({ confirmationReference: `bank-confirm-second-${suffix}`, reconciliationReference: `recon-second-${suffix}` }) }, actorToken, ownerOrgId); assert.equal(secondConfirmed.status, 200); assert.equal((await body(secondConfirmed)).settlement.status, "SETTLED");
  });

  it("requires current-owner transfer permission and permits governed retirement", async () => {
    if (!pool) return;
    const denied = await request(`/api/v1/credentials/${credentialId}/transfer`, { method: "POST", body: JSON.stringify({ toOwnerId: destinationOrgId }) }, verifierToken, ownerOrgId); assert.equal(denied.status, 403); assert.equal((await body(denied)).code, "HIGH_RISK_PERMISSION_REQUIRED");
    const transferred = await request(`/api/v1/credentials/${credentialId}/transfer`, { method: "POST", body: JSON.stringify({ toOwnerId: destinationOrgId }) }, actorToken, ownerOrgId); assert.equal(transferred.status, 200); assert.equal((await body(transferred)).registryEvent.event_type, "TRANSFERRED");
    const staleOwnerTransfer = await request(`/api/v1/credentials/${credentialId}/transfer`, { method: "POST", body: JSON.stringify({ toOwnerId: ownerOrgId }) }, actorToken, ownerOrgId); assert.equal(staleOwnerTransfer.status, 403); assert.equal((await body(staleOwnerTransfer)).code, "ORG_FORBIDDEN");
    const destinationRole = (await pool.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,$3::jsonb) returning id", [destinationOrgId, `RETIRE-${suffix}`, JSON.stringify(["TRANSFER_CREDENTIAL","RETIRE_CREDENTIAL","settlement:authorize","settlement:settle"])] )).rows[0]!.id;
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [actorId, destinationOrgId, destinationRole]);
    const transferredAgain = await request(`/api/v1/credentials/${credentialId}/transfer`, { method: "POST", body: JSON.stringify({ toOwnerId: ownerOrgId }) }, actorToken, destinationOrgId); assert.equal(transferredAgain.status, 200); assert.equal((await body(transferredAgain)).registryEvent.event_type, "TRANSFERRED");
    const retired = await request(`/api/v1/credentials/${credentialId}/retire`, { method: "POST", body: "{}" }, actorToken, ownerOrgId); assert.equal(retired.status, 200); assert.equal((await body(retired)).registryEvent.event_type, "RETIRED");
    const retiredSettlement = await request("/api/v1/settlements", { method: "POST", body: JSON.stringify({ credentialId, payerId: destinationOrgId, payeeId: ownerOrgId, amount: 1, currency: "INR" }) }, actorToken, ownerOrgId); assert.equal(retiredSettlement.status, 409); assert.equal((await body(retiredSettlement)).code, "CREDENTIAL_RETIRED");
    const state = await pool.query<{ status: string }>("select status from credentials where id=$1", [credentialId]); assert.equal(state.rows[0]?.status, "RETIRED");
  });
});
