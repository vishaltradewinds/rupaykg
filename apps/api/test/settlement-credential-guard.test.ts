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
    const owner = (await c.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'PROCESSOR') returning id",
      [`settlement-guard-owner-${suffix}`],
    )).rows[0]!.id;
    const identity = (await c.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`settlement-guard-identity-${suffix}`, "Settlement Guard Test"],
    )).rows[0]!.id;
    const activity = (await c.query<{ id: string }>(
      "insert into activities(organization_id,actor_identity_id,activity_type,status,completed_at) values($1,$2,'COLLECTION','COMPLETED',now()) returning id",
      [owner, identity],
    )).rows[0]!.id;
    const evidence = (await c.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'SETTLEMENT_GUARD','VERIFIED',now(),$2) returning id",
      [activity, `settlement-guard-${suffix}`],
    )).rows[0]!.id;
    const verification = (await c.query<{ id: string }>(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','settlement-guard','independent database guard test') returning id",
      [evidence, activity, identity],
    )).rows[0]!.id;

    retiredCredentialId = (await c.query<{ id: string }>(
      "insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id,quantity,unit,issued_at) values($1,$2,$3,'RETIRED',$4,1,'kg',now()) returning id",
      [activity, owner, `settlement-guard-root-${suffix}`, verification],
    )).rows[0]!.id;

    openSettlementCredentialId = (await c.query<{ id: string }>(
      "insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id,quantity,unit,issued_at) values($1,$2,$3,'ACTIVE',$4,2,'kg',now()) returning id",
      [activity, owner, `settlement-guard-open-${suffix}`, verification],
    )).rows[0]!.id;

    await c.query("commit");
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
  }
});

after(async () => {
  if (pool) await pool.end();
});

describe("settlement credential lifecycle database guards", () => {
  it("rejects settlement creation for a retired credential", async () => {
    if (!pool) return;
    const error = await pool.query(
      "insert into settlements(credential_id,amount,currency,status) values($1,100,'INR','CREATED')",
      [retiredCredentialId],
    ).then(() => null).catch((value: unknown) => value);
    assert.ok(error instanceof Error);
    assert.match(error.message, /Retired credentials cannot create settlements/i);
  });

  it("prevents retirement while an attached settlement remains open", async () => {
    if (!pool) return;
    await pool.query(
      "insert into settlements(credential_id,amount,currency,status) values($1,200,'INR','CREATED')",
      [openSettlementCredentialId],
    );
    const error = await pool.query(
      "update credentials set status='RETIRED' where id=$1",
      [openSettlementCredentialId],
    ).then(() => null).catch((value: unknown) => value);
    assert.ok(error instanceof Error);
    assert.match(error.message, /Credential cannot be retired while a settlement is open/i);
  });
});
