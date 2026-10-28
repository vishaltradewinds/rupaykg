import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
const suffix = randomUUID();
let settlementId = "";

before(async () => {
  if (!pool) return;
  const owner = (await pool.query<{ id: string }>(
    "insert into organizations(name,organization_type) values($1,'PROCESSOR') returning id",
    [`settlement-reconciliation-owner-${suffix}`],
  )).rows[0]!.id;
  const counterparty = (await pool.query<{ id: string }>(
    "insert into organizations(name,organization_type) values($1,'PROCESSOR') returning id",
    [`settlement-reconciliation-counterparty-${suffix}`],
  )).rows[0]!.id;
  const geography = (await pool.query<{ id: string }>(
    "insert into geography(kind,code,name,source) values('DISTRICT',$1,$2,'test') returning id",
    [`SETTLEMENT-RECON-${suffix}`, `Settlement Reconciliation District ${suffix}`],
  )).rows[0]!.id;
  await pool.query(
    "insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')",
    [owner, geography],
  );
  const actor = (await pool.query<{ id: string }>(
    "insert into identities(external_subject,display_name) values($1,$2) returning id",
    [`settlement-reconciliation-actor-${suffix}`, "Settlement Reconciliation Actor"],
  )).rows[0]!.id;
  const verifier = (await pool.query<{ id: string }>(
    "insert into identities(external_subject,display_name) values($1,$2) returning id",
    [`settlement-reconciliation-verifier-${suffix}`, "Settlement Reconciliation Verifier"],
  )).rows[0]!.id;
  const role = (await pool.query<{ id: string }>(
    "insert into roles(organization_id,name,permissions) values($1,$2,$3::jsonb) returning id",
    [owner, `settlement-reconciliation-role-${suffix}`, JSON.stringify(["VERIFY_EVIDENCE", "ISSUE_CREDENTIAL"])],
  )).rows[0]!.id;
  await pool.query(
    "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
    [verifier, owner, role],
  );

  const activity = (await pool.query<{ id: string }>(
    "insert into activities(organization_id,actor_identity_id,geography_id,activity_type,status,completed_at) values($1,$2,$3,'COLLECTION','COMPLETED',now()) returning id",
    [owner, actor, geography],
  )).rows[0]!.id;
  const evidence = (await pool.query<{ id: string }>(
    "insert into evidence(activity_id,evidence_type,status,captured_at,content_hash) values($1,'SETTLEMENT_RECON','VERIFIED',now(),$2) returning id",
    [activity, `settlement-reconciliation-evidence-${suffix}`],
  )).rows[0]!.id;
  const verification = (await pool.query<{ id: string }>(
    "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','settlement-reconciliation','independent database guard test') returning id",
    [evidence, activity, verifier],
  )).rows[0]!.id;
  const methodologyCode = `TEST-METHODOLOGY-SETTLEMENT-RECON-${suffix}`;
  const methodologyVersionId = (await pool.query<{ id: string }>(
    "insert into methodology_versions(methodology_code,version,rules,source_reference,source_hash,applicability_rules,parameter_dictionary,equation_mapping,reconciliation_evidence,reconciliation_reference,reconciled_at,regression_verified_at) values($1,'test-1','{}'::jsonb,'test-fixture://methodology',repeat('a',64),'{\\"fixture\\":true}'::jsonb,'{\\"fixture\\":true}'::jsonb,'{\\"fixture\\":true}'::jsonb,'[{\\"fixture\\":true}]'::jsonb,$2,now(),now()) returning id",
    [methodologyCode, `settlement-reconciliation-reconciliation-${suffix}`],
  )).rows[0]!.id;
  await pool.query(
    "insert into methodology_governance_evidence(methodology_version_id,evidence_kind,reference,evidence_hash,independent_party,evidence) values($1,'NUMERICAL_RECONCILIATION',$2,repeat('b',64),'TEST_FIXTURE_ONLY','{\\"fixture\\":true}'::jsonb),($1,'REGRESSION_TEST',$3,repeat('c',64),'TEST_FIXTURE_ONLY','{\\"fixture\\":true}'::jsonb)",
    [methodologyVersionId, `settlement-reconciliation-reconciliation-${suffix}`, `settlement-reconciliation-regression-${suffix}`],
  );
  await pool.query("update methodology_versions set governance_status='PRODUCTION_ELIGIBLE' where id=$1", [methodologyVersionId]);
  await pool.query(
    "insert into mrv_provenance_events(activity_id,verification_id,evidence_id,methodology_code,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,metadata,mirror_node_verified_at) values($1,$2,$3,$4,$5,$6,'VERIFIED','CONSENSUS_CONFIRMED','0.0.123',$7,now(),$8,$9::jsonb,clock_timestamp())",
    [activity, verification, evidence, methodologyCode, `settlement-reconciliation-policy-${suffix}`, `settlement-reconciliation-execution-${suffix}`, `settlement-reconciliation-tx-${suffix}`, `settlement-reconciliation-hash-${suffix}`, JSON.stringify({ testFixture: true })],
  );
  await pool.query(
    "insert into activity_registry_eligibility_decisions(activity_id,verification_id,evidence_id,methodology_version_id,geography_id,decision,statutory_basis,permit_and_authority_evidence,applicability_rationale,independent_review_reference,reviewer_identity_id,effective_from) values($1,$2,$3,$4,$5,'APPROVED','{\\"testFixture\\":true}'::jsonb,'[{\\"testFixture\\":true}]'::jsonb,'TEST FIXTURE ONLY - NOT A REGULATORY APPROVAL',$6,$7,current_date)",
    [activity, verification, evidence, methodologyVersionId, geography, `settlement-reconciliation-review-${suffix}`, verifier],
  );
  const credential = (await pool.query<{ id: string }>(
    "insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id,methodology_version_id,quantity,unit,issued_at) values($1,$2,$3,'ELIGIBLE',$4,$5,1,'kg',now()) returning id",
    [activity, owner, `settlement-reconciliation-root-${suffix}`, verification, methodologyVersionId],
  )).rows[0]!.id;
  await pool.query("update credentials set status='ISSUED' where id=$1", [credential]);
  await pool.query(
    "insert into registry_events(credential_id,event_type,to_owner_id,verification_id,recorded_by_identity_id,event_hash) values($1,'ISSUED',$2,$3,$4,$5)",
    [credential, owner, verification, verifier, `settlement-reconciliation-registry-${suffix}`],
  );
  await pool.query("update credentials set status='ACTIVE' where id=$1", [credential]);

  const result = await pool.query<{ id: string }>(
    `insert into settlements (credential_id, payer_id, payee_id, amount, currency, status, authorization_reference, verified_at)
     values ($1, $2, $3, 1, 'INR', 'CREATED', $4, now())
     returning id`,
    [credential, owner, counterparty, randomUUID()],
  );
  settlementId = result.rows[0]!.id;
  await pool.query(`update settlements set status = 'AUTHORIZED' where id = $1`, [settlementId]);
  await pool.query(`update settlements set status = 'EXECUTING' where id = $1`, [settlementId]);
  await pool.query(`update settlements set status = 'RECONCILING' where id = $1`, [settlementId]);
});

after(async () => {
  if (!pool) return;
  if (settlementId) await pool.query("delete from settlements where id = $1", [settlementId]);
  await pool.end();
});

describe("settlement reconciliation invariants", () => {
  it("runs against PostgreSQL in CI", { skip: !pool }, () => {
    assert.ok(pool, "DATABASE_URL is required for settlement integration tests");
    assert.match(settlementId, /^[0-9a-f-]{36}$/i);
  });

  it("rejects reconciliation evidence without external confirmation", async () => {
    if (!pool) return;
    await assert.rejects(
      pool.query(
        `update settlements set reconciliation_reference = $1 where id = $2`,
        [randomUUID(), settlementId],
      ),
      /reconciliation|confirmation/i,
    );
  });

  it("rejects external confirmation without reconciliation evidence", async () => {
    if (!pool) return;
    await assert.rejects(
      pool.query(`update settlements set external_confirmed_at = now() where id = $1`, [settlementId]),
      /reconciliation|confirmation/i,
    );
  });

  it("requires all external evidence before SETTLED", async () => {
    if (!pool) return;
    await assert.rejects(
      pool.query(`update settlements set status = 'SETTLED' where id = $1`, [settlementId]),
      /external settlement reference|external authority confirmation|reconciliation reference|invalid settlement lifecycle transition/i,
    );

    await pool.query(
      `update settlements
          set external_reference = $1,
              external_confirmed_at = now(),
              reconciliation_reference = $2
        where id = $3`,
      [randomUUID(), randomUUID(), settlementId],
    );
    const settled = await pool.query<{ status: string }>(
      `update settlements set status = 'SETTLED' where id = $1 returning status`,
      [settlementId],
    );
    assert.equal(settled.rows[0]!.status, "SETTLED");
  });

  it("rejects mutation or clearing of confirmed reconciliation evidence", async () => {
    if (!pool) return;
    await assert.rejects(
      pool.query(`update settlements set reconciliation_reference = $1 where id = $2`, [randomUUID(), settlementId]),
      /cannot be changed|cannot be cleared|settlement_reconciliation_requires_confirmation|settlement_confirmation_requires_reference/i,
    );
    await assert.rejects(
      pool.query(`update settlements set reconciliation_reference = null where id = $1`, [settlementId]),
      /cannot be changed|cannot be cleared|settlement_reconciliation_requires_confirmation|settlement_confirmation_requires_reference/i,
    );
    await assert.rejects(
      pool.query(`update settlements set external_confirmed_at = now() + interval '1 minute' where id = $1`, [settlementId]),
      /cannot be changed|cannot be cleared|settlement_reconciliation_requires_confirmation|settlement_confirmation_requires_reference/i,
    );
  });
});
