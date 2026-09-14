import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 2 }) : null;
const suffix = randomUUID();

let retiredCredentialId = "";
let openSettlementCredentialId = "";

before(async () => {
  if (!pool) return;
  const c = await pool.connect();
  try {
    await c.query("begin");
    const owner = (await c.query<{ id: string }>("insert into organizations(name,organization_type) values($1,'PROCESSOR') returning id", [`settlement-guard-owner-${suffix}`])).rows[0]!.id;
    const geography = (await c.query<{ id: string }>("insert into geography(kind,code,name,source) values('DISTRICT',$1,$2,'test') returning id", [`SETTLEMENT-GUARD-${suffix}`, `Settlement Guard District ${suffix}`])).rows[0]!.id;
    await c.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')", [owner, geography]);
    const actor = (await c.query<{ id: string }>("insert into identities(external_subject,display_name) values($1,$2) returning id", [`settlement-guard-actor-${suffix}`, "Settlement Guard Actor"])).rows[0]!.id;
    const verifier = (await c.query<{ id: string }>("insert into identities(external_subject,display_name) values($1,$2) returning id", [`settlement-guard-verifier-${suffix}`, "Settlement Guard Independent Verifier"])).rows[0]!.id;
    const verifierRole = (await c.query<{ id: string }>("insert into roles(organization_id,name,permissions) values($1,$2,$3::jsonb) returning id", [owner, `settlement-guard-verifier-role-${suffix}`, JSON.stringify(["VERIFY_EVIDENCE", "ISSUE_CREDENTIAL"])] )).rows[0]!.id;
    await c.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [verifier, owner, verifierRole]);

    const retiredActivity = (await c.query<{ id: string }>("insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status,completed_at) values($1,$2,$3,'COLLECTION','COMPLETED',now()) returning id", [owner, actor, geography])).rows[0]!.id;
    const retiredEvidence = (await c.query<{ id: string }>("insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'SETTLEMENT_GUARD','VERIFIED',now(),$2) returning id", [retiredActivity, `settlement-guard-retired-${suffix}`])).rows[0]!.id;
    const retiredVerification = (await c.query<{ id: string }>("insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','settlement-guard','independent database guard test') returning id", [retiredEvidence, retiredActivity, verifier])).rows[0]!.id;
    await c.query("insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,metadata) values($1,$2,$3,'settlement-guard-policy','settlement-guard-guardian','VERIFIED','CONSENSUS_CONFIRMED','0.0.123',$4,$5,$6,'{\"testFixture\":true}')", [retiredActivity, retiredVerification, retiredEvidence, `retired-tx-${suffix}`, `retired-consensus-${suffix}`, `retired-hash-${suffix}`]);
    retiredCredentialId = (await c.query<{ id: string }>("insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id,quantity,unit,issued_at) values($1,$2,$3,'ELIGIBLE',$4,1,'kg',now()) returning id", [retiredActivity, owner, `settlement-guard-retired-root-${suffix}`, retiredVerification])).rows[0]!.id;
    await c.query("update credentials set status='ISSUED' where id=$1", [retiredCredentialId]);
    await c.query("insert into registry_events(credential_id,event_type,to_owner_id,verification_id,recorded_by_identity_id,event_hash) values($1,'ISSUED',$2,$3,$4,$5)", [retiredCredentialId, owner, retiredVerification, verifier, `settlement-guard-retired-registry-${suffix}`]);
    await c.query("update credentials set status='ACTIVE' where id=$1", [retiredCredentialId]);
    await c.query("update credentials set status='RETIRED' where id=$1", [retiredCredentialId]);

    const openActivity = (await c.query<{ id: string }>("insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status,completed_at) values($1,$2,$3,'COLLECTION','COMPLETED',now()) returning id", [owner, actor, geography])).rows[0]!.id;
    const openEvidence = (await c.query<{ id: string }>("insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'SETTLEMENT_GUARD','VERIFIED',now(),$2) returning id", [openActivity, `settlement-guard-open-${suffix}`])).rows[0]!.id;
    const openVerification = (await c.query<{ id: string }>("insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','settlement-guard','independent database guard test') returning id", [openEvidence, openActivity, verifier])).rows[0]!.id;
    await c.query("insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,metadata) values($1,$2,$3,'settlement-guard-policy','settlement-guard-guardian','VERIFIED','CONSENSUS_CONFIRMED','0.0.123',$4,$5,$6,'{\"testFixture\":true}')", [openActivity, openVerification, openEvidence, `open-tx-${suffix}`, `open-consensus-${suffix}`, `open-hash-${suffix}`]);
    openSettlementCredentialId = (await c.query<{ id: string }>("insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id,quantity,unit,issued_at) values($1,$2,$3,'ELIGIBLE',$4,2,'kg',now()) returning id", [openActivity, owner, `settlement-guard-open-root-${suffix}`, openVerification])).rows[0]!.id;
    await c.query("update credentials set status='ISSUED' where id=$1", [openSettlementCredentialId]);
    await c.query("insert into registry_events(credential_id,event_type,to_owner_id,verification_id,recorded_by_identity_id,event_hash) values($1,'ISSUED',$2,$3,$4,$5)", [openSettlementCredentialId, owner, openVerification, verifier, `settlement-guard-open-registry-${suffix}`]);
    await c.query("update credentials set status='ACTIVE' where id=$1", [openSettlementCredentialId]);

    await c.query("commit");
  } catch (error) { await c.query("rollback"); throw error; } finally { c.release(); }
});

after(async () => { if (pool) await pool.end(); });

describe("settlement credential lifecycle database guards", () => {
  it("rejects settlement creation for a retired credential", async () => {
    if (!pool) return;
    const error = await pool.query("insert into settlements(credential_id,amount,currency,status) values($1,100,'INR','CREATED')", [retiredCredentialId]).then(() => null).catch((value: unknown) => value);
    assert.ok(error instanceof Error);
    assert.match(error.message, /Settlement requires an active or transferred credential/i);
  });

  it("prevents retirement while an attached settlement remains open", async () => {
    if (!pool) return;
    await pool.query("insert into settlements(credential_id,payer_id,payee_id,amount,currency,status) values($1,$2,$3,200,'INR','CREATED')", [openSettlementCredentialId, (await pool.query<{ id: string }>("select to_owner_id as id from registry_events where credential_id=$1 order by created_at desc limit 1", [openSettlementCredentialId])).rows[0]!.id, (await pool.query<{ id: string }>("select id from organizations where name=$1", [`settlement-guard-owner-${suffix}`])).rows[0]!.id]);
    const error = await pool.query("update credentials set status='RETIRED' where id=$1", [openSettlementCredentialId]).then(() => null).catch((value: unknown) => value);
    assert.ok(error instanceof Error);
    assert.match(error.message, /Credential cannot be retired while a settlement is open/i);
  });
});
