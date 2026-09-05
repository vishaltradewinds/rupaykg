import test from "node:test";
import assert from "node:assert/strict";
import { Pool, type PoolClient } from "pg";

const url = process.env.DATABASE_URL;

test("production lifecycle integration gate", { skip: !url }, async () => {
  assert.ok(url);
  const pool = new Pool({ connectionString: url, max: 1, ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
  const c = await pool.connect();
  try {
    await c.query("begin");
    const org = (await c.query("insert into organizations(name,organization_type) values('integration','COLLECTOR') returning id")).rows[0].id;
    const actor = (await c.query("insert into identities(external_subject,display_name) values('integration-actor','actor') returning id")).rows[0].id;
    const verifier = (await c.query("insert into identities(external_subject,display_name) values('integration-verifier','verifier') returning id")).rows[0].id;
    const role = (await c.query("insert into roles(organization_id,name,permissions) values($1,'VERIFIER','[\"VERIFY_EVIDENCE\",\"ISSUE_CREDENTIAL\"]') returning id", [org])).rows[0].id;
    await c.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [verifier, org, role]);

    const activity = (await c.query("insert into activities(organization_id,actor_identity_id,activity_type,status) values($1,$2,'COLLECTION','SUBMITTED') returning id", [org, actor])).rows[0].id;
    const evidence = (await c.query("insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'FIELD','UNDER_REVIEW',now(),'integration') returning id", [activity])).rows[0].id;
    await reject(c, () => c.query("insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'APPROVED','integration')", [evidence, activity, actor]), /self-approve/);
    const verification = (await c.query("insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'APPROVED','integration') returning id", [evidence, activity, verifier])).rows[0].id;
    await c.query("update evidence set status='VERIFIED' where id=$1", [evidence]);
    await c.query("update activities set status='COMPLETED' where id=$1", [activity]);

    const unauthorizedRole = (await c.query("insert into roles(organization_id,name,permissions) values($1,'READER','[\"dashboard:read\"]') returning id", [org])).rows[0].id;
    const unauthorized = (await c.query("insert into identities(external_subject,display_name) values('integration-unauthorized','unauthorized') returning id")).rows[0].id;
    await c.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')", [unauthorized, org, unauthorizedRole]);
    const credential = (await c.query("insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id,quantity,unit) values($1,$2,'integration-root','ISSUED',$3,100,'kg') returning id", [activity, org, verification])).rows[0].id;
    await reject(c, () => c.query("insert into registry_events(credential_id,event_type,to_owner_id,verification_id,recorded_by_identity_id,event_hash) values($1,'ISSUED',$2,$3,$4,'integration')", [credential, org, verification, unauthorized]), /explicit permission: ISSUE_CREDENTIAL/);
    await c.query("insert into registry_events(credential_id,event_type,to_owner_id,verification_id,recorded_by_identity_id,event_hash) values($1,'ISSUED',$2,$3,$4,'integration')", [credential, org, verification, verifier]);
    await c.query("update credentials set status='ACTIVE' where id=$1", [credential]);
    await reject(c, () => c.query("insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id,quantity,unit) values($1,$2,'integration-root','ISSUED',$3,100,'kg')", [activity, org, verification]), /duplicate key|credentials_activity_verification_unique_idx/);

    const settlement = (await c.query("insert into settlements(credential_id,payer_id,payee_id,amount,currency,status) values($1,$2,$2,1000,'INR','CREATED') returning id", [credential, org])).rows[0].id;
    await c.query("update settlements set status='AUTHORIZED',authorization_reference='auth',verified_at=now() where id=$1", [settlement]);
    await c.query("update settlements set status='EXECUTING',external_reference='bank-1' where id=$1", [settlement]);
    await c.query("update settlements set status='RECONCILING' where id=$1", [settlement]);
    await reject(c, () => c.query("update settlements set status='SETTLED' where id=$1", [settlement]), /external authority confirmation/);
    await c.query("update settlements set status='SETTLED',external_confirmed_at=now(),reconciliation_reference='recon-1',settled_at=now() where id=$1", [settlement]);
    await reject(c, () => c.query("update settlements set external_reference='bank-2' where id=$1", [settlement]), /external settlement reference cannot be changed/);
    await reject(c, () => c.query("update settlements set external_confirmed_at=null where id=$1", [settlement]), /cannot be changed|cannot be cleared/);
    await reject(c, () => c.query("update settlements set reconciliation_reference=null where id=$1", [settlement]), /cannot be changed|cannot be cleared/);
    await reject(c, () => c.query("update registry_events set event_type='TAMPERED' where credential_id=$1", [credential]), /append-only/);

    const state = (await c.query("select a.status activity,e.status evidence,v.decision verification,c.status credential,s.status settlement,s.external_reference,s.external_confirmed_at,s.reconciliation_reference from activities a join evidence e on e.activity_id=a.id join verifications v on v.id=$1 join credentials c on c.id=$2 join settlements s on s.id=$3 where a.id=$4 and e.id=$5", [verification, credential, settlement, activity, evidence])).rows[0];
    assert.deepEqual([state.activity, state.evidence, state.verification, state.credential, state.settlement], ["COMPLETED", "VERIFIED", "APPROVED", "ACTIVE", "SETTLED"]);
    assert.equal(state.external_reference, "bank-1");
    assert.ok(state.external_confirmed_at instanceof Date);
    assert.equal(state.reconciliation_reference, "recon-1");
    await c.query("rollback");
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
    await pool.end();
  }
});

async function reject(c: PoolClient, action: () => Promise<unknown>, expected: RegExp): Promise<void> {
  await c.query("savepoint lifecycle_assertion");
  try {
    await assert.rejects(action, (error: unknown) => {
      assert.match(error instanceof Error ? error.message : String(error), expected);
      return true;
    });
  } finally {
    await c.query("rollback to savepoint lifecycle_assertion");
    await c.query("release savepoint lifecycle_assertion");
  }
}
