import assert from "node:assert/strict";
import { Pool } from "pg";
import test from "node:test";

const testDatabaseUrl = process.env.RUPAYKG_TEST_DATABASE_URL;

test("BM WA03.001 baseline records allow one independent decision and reject later mutation", {
  skip: !testDatabaseUrl ? "RUPAYKG_TEST_DATABASE_URL must point to an isolated migrated test database" : false,
}, async () => {
  const pool = new Pool({ connectionString: testDatabaseUrl, ssl: false, max: 2 });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const organizationId = (await client.query<{id:string}>(
      "insert into organizations(name,organization_type) values('BM WA03.001 Baseline Test','TEST') returning id",
    )).rows[0]!.id;
    const submitterId = (await client.query<{id:string}>(
      "insert into identities(display_name) values('BM WA03.001 Baseline Submitter') returning id",
    )).rows[0]!.id;
    const verifierId = (await client.query<{id:string}>(
      "insert into identities(display_name) values('BM WA03.001 Baseline Verifier') returning id",
    )).rows[0]!.id;
    const activityId = (await client.query<{id:string}>(
      "insert into activities(organization_id,actor_identity_id,activity_type) values($1,$2,'TEST') returning id",
      [organizationId, submitterId],
    )).rows[0]!.id;
    const evidenceId = (await client.query<{id:string}>(
      "insert into evidence(activity_id,evidence_type,captured_at,content_hash,captured_by_identity_id,status) values($1,'TEST',now(),$2,$3,'VERIFIED') returning id",
      [activityId, "a".repeat(64), submitterId],
    )).rows[0]!.id;
    const baselineId = (await client.query<{id:string}>(
      "insert into bm_wa03001_baseline_records(organization_id,activity_id,baseline_fch4_tch4,baseline_period,evidence_ids,record_sha256,submitted_by_identity_id) values($1,$2,12.5,'2025 baseline',$3::uuid[],$4,$5) returning id",
      [organizationId, activityId, [evidenceId], "b".repeat(64), submitterId],
    )).rows[0]!.id;

    await client.query(
      "update bm_wa03001_baseline_records set status='APPROVED',approved_by_identity_id=$2,approved_at=now() where id=$1",
      [baselineId, verifierId],
    );
    const approved = await client.query<{status:string}>(
      "select status from bm_wa03001_baseline_records where id=$1", [baselineId],
    );
    assert.equal(approved.rows[0]?.status, "APPROVED");

    const attestationId = (await client.query<{id:string}>(
      "insert into bm_wa03001_baseline_attestations(baseline_record_id,organization_id,activity_id,credential_jwt,credential_sha256,issuer_did,signing_key_id,public_jwk,issued_by_identity_id,issued_at,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,now(),now()+interval '90 days') returning id",
      [baselineId, organizationId, activityId, "eyJhbGciOiJFZERTQSJ9." + "a".repeat(30) + "." + "b".repeat(80), "f".repeat(64), "did:web:rupaykg.example", "did:web:rupaykg.example#key-1", JSON.stringify({kty:"OKP",crv:"Ed25519",x:"test",kid:"did:web:rupaykg.example#key-1"}), verifierId],
    )).rows[0]!.id;
    assert.ok(attestationId);

    await client.query("savepoint attestation_immutable");
    await assert.rejects(
      client.query("update bm_wa03001_baseline_attestations set credential_sha256=$2 where id=$1", [attestationId, "1".repeat(64)]),
      /append-only/,
    );
    await client.query("rollback to savepoint attestation_immutable");
    await client.query("release savepoint attestation_immutable");

    await client.query("savepoint attestation_delete");
    await assert.rejects(
      client.query("delete from bm_wa03001_baseline_attestations where id=$1", [attestationId]),
      /append-only/,
    );
    await client.query("rollback to savepoint attestation_delete");
    await client.query("release savepoint attestation_delete");

    await client.query("savepoint duplicate_attestation");
    await assert.rejects(
      client.query("insert into bm_wa03001_baseline_attestations(baseline_record_id,organization_id,activity_id,credential_jwt,credential_sha256,issuer_did,signing_key_id,public_jwk,issued_by_identity_id,issued_at,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,now(),now()+interval '90 days')",
        [baselineId, organizationId, activityId, "eyJhbGciOiJFZERTQSJ9." + "c".repeat(30) + "." + "d".repeat(80), "1".repeat(64), "did:web:rupaykg.example", "did:web:rupaykg.example#key-1", JSON.stringify({kty:"OKP"}), verifierId]),
      /duplicate key|unique constraint/i,
    );
    await client.query("rollback to savepoint duplicate_attestation");
    await client.query("release savepoint duplicate_attestation");

    const reconciliationId = (await client.query<{id:string}>(
      "insert into bm_wa03001_reconciliations(organization_id,activity_id,baseline_record_id,monitoring_period_id,equation5_result,equation4_input,equation4_result_tco2e,evidence_ids,provenance_sha256,created_by_identity_id) values($1,$2,$3,'period-test-1',$4::jsonb,$5::jsonb,12.5,$6::uuid[],$7,$8) returning id",
      [organizationId, activityId, baselineId, JSON.stringify({status:"CALCULATED_PENDING_VERIFICATION"}), JSON.stringify({gwp:29.8}), [evidenceId], "d".repeat(64), verifierId],
    )).rows[0]!.id;
    assert.ok(reconciliationId);

    await client.query("savepoint reconciliation_immutable");
    await assert.rejects(
      client.query("update bm_wa03001_reconciliations set equation4_result_tco2e=999 where id=$1", [reconciliationId]),
      /append-only/,
    );
    await client.query("rollback to savepoint reconciliation_immutable");
    await client.query("release savepoint reconciliation_immutable");

    await client.query("savepoint reconciliation_delete");
    await assert.rejects(
      client.query("delete from bm_wa03001_reconciliations where id=$1", [reconciliationId]),
      /append-only/,
    );
    await client.query("rollback to savepoint reconciliation_delete");
    await client.query("release savepoint reconciliation_delete");

    await client.query("savepoint duplicate_period");
    await assert.rejects(
      client.query("insert into bm_wa03001_reconciliations(organization_id,activity_id,baseline_record_id,monitoring_period_id,equation5_result,equation4_input,equation4_result_tco2e,evidence_ids,provenance_sha256,created_by_identity_id) values($1,$2,$3,'period-test-1',$4::jsonb,$5::jsonb,12.5,$6::uuid[],$7,$8)",
        [organizationId, activityId, baselineId, JSON.stringify({status:"CALCULATED_PENDING_VERIFICATION"}), JSON.stringify({gwp:29.8}), [evidenceId], "e".repeat(64), verifierId]),
      /duplicate key|unique constraint/i,
    );
    await client.query("rollback to savepoint duplicate_period");
    await client.query("release savepoint duplicate_period");

    await client.query("savepoint immutable_input");
    await assert.rejects(
      client.query("update bm_wa03001_baseline_records set baseline_fch4_tch4=99 where id=$1", [baselineId]),
      /Baseline data is immutable/,
    );
    await client.query("rollback to savepoint immutable_input");
    await client.query("release savepoint immutable_input");

    await client.query("savepoint second_decision");
    await assert.rejects(
      client.query("update bm_wa03001_baseline_records set status='REJECTED' where id=$1", [baselineId]),
      /Baseline data is immutable/,
    );
    await client.query("rollback to savepoint second_decision");
    await client.query("release savepoint second_decision");

    await client.query("savepoint self_approval");
    await assert.rejects(
      client.query("insert into bm_wa03001_baseline_records(organization_id,activity_id,baseline_fch4_tch4,baseline_period,evidence_ids,record_sha256,submitted_by_identity_id,status,approved_by_identity_id,approved_at) values($1,$2,1,'2025 baseline',$3::uuid[],$4,$5,'APPROVED',$5,now())",
        [organizationId, activityId, [evidenceId], "c".repeat(64), submitterId]),
      /violates check constraint|new row for relation/i,
    );
    await client.query("rollback to savepoint self_approval");
    await client.query("release savepoint self_approval");

    await client.query("savepoint delete_guard");
    await assert.rejects(
      client.query("delete from bm_wa03001_baseline_records where id=$1", [baselineId]),
      /cannot be deleted/,
    );
    await client.query("rollback to savepoint delete_guard");
    await client.query("release savepoint delete_guard");
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
    await pool.end();
  }
});
