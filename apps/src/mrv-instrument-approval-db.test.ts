import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

const url = process.env.DATABASE_URL;

test("PostgreSQL enforces MRV instrument approval evidence and append-only decisions", { skip: !url }, async () => {
  assert.ok(url);
  const pool = new Pool({ connectionString: url, max: 1, ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
  const client = await pool.connect();
  const suffix = randomUUID();
  try {
    await client.query("begin");
    const organizationId = (await client.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`mrv-instrument-test-${suffix}`],
    )).rows[0]!.id;
    const identityId = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`mrv-instrument-test-${suffix}`, "MRV instrument test"],
    )).rows[0]!.id;
    const instrumentId = (await client.query<{ id: string; approval_status: string }>(
      "insert into mrv_instruments(organization_id,instrument_code,instrument_type,manufacturer,model,sku_revision,intended_use,registered_by_identity_id) values($1,$2,'GAS_FLOW','Test Manufacturer','Flow Model 1','Rev A','Landfill methane recovery flow measurement',$3) returning id,approval_status",
      [organizationId, `FLOW-${suffix}`, identityId],
    )).rows[0]!;
    assert.equal(instrumentId.approval_status, "HOLD");

    const initialDecision = await client.query<{ count: string }>(
      "select count(*)::text as count from mrv_instrument_decisions where instrument_id=$1",
      [instrumentId.id],
    );
    assert.equal(Number(initialDecision.rows[0]?.count), 1);

    await rejectsInSavepoint(client, () => client.query(
      "update mrv_instruments set approval_status='VERIFIED',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='must fail without approval evidence' where id=$1",
      [instrumentId.id, identityId],
    ), /exact-model MeitY approval evidence/i);

    const approved = await client.query<{ approval_status: string }>(
      "update mrv_instruments set approval_status='VERIFIED',meity_certificate_id='MEITY-CERT-TEST',meity_issuer='Official authority',meity_certificate_scope='Exact manufacturer/model/SKU revision',meity_verification_url='https://official.example.gov/cert',meity_evidence_reference='evidence://meity-test',meity_evidence_sha256=$3,meity_verified_at=now(),meity_validity_basis='VALID_UNTIL',meity_valid_until=now()+interval '1 year',calibration_required=true,calibration_status='VERIFIED',calibration_certificate_id='CAL-TEST',calibration_evidence_reference='evidence://cal-test',calibration_evidence_sha256=$4,calibration_lab='Traceable lab',calibration_traceability='National standard traceability',calibration_uncertainty=0.2,calibration_valid_until=now()+interval '1 year',security_review_status='NOT_APPLICABLE_WITH_JUSTIFICATION',security_not_applicable_reason='Test fixture uses no firmware; test-only written rationale',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='test exact-model approval and calibration evidence' where id=$1 returning approval_status",
      [instrumentId.id, identityId, "a".repeat(64), "b".repeat(64)],
    );
    assert.equal(approved.rows[0]?.approval_status, "VERIFIED");

    const decisionCount = await client.query<{ count: string }>(
      "select count(*)::text as count from mrv_instrument_decisions where instrument_id=$1",
      [instrumentId.id],
    );
    assert.equal(Number(decisionCount.rows[0]?.count), 2);

    await rejectsInSavepoint(client, () => client.query(
      "update mrv_instruments set model='substituted model' where id=$1",
      [instrumentId.id],
    ), /immutable/i);

    await rejectsInSavepoint(client, () => client.query(
      "update mrv_instrument_decisions set decision_note='tampered' where instrument_id=$1",
      [instrumentId.id],
    ), /append-only/i);

    const gatewayId = (await client.query<{ id: string }>(
      "insert into mrv_instruments(organization_id,instrument_code,instrument_type,manufacturer,model,sku_revision,intended_use,firmware_version,firmware_support_until,registered_by_identity_id) values($1,$2,'INDUSTRIAL_GATEWAY','Test Manufacturer','Gateway Model 1','Rev A','Authenticated MRV data transport','1.0.0',now()+interval '1 year',$3) returning id",
      [organizationId, `GATEWAY-${suffix}`, identityId],
    )).rows[0]!.id;

    const gatewayApprovalWithoutSecurity = "update mrv_instruments set approval_status='VERIFIED',meity_certificate_id='MEITY-GW-TEST',meity_issuer='Official authority',meity_certificate_scope='Exact gateway model and revision',meity_verification_url='https://official.example.gov/gateway',meity_evidence_reference='evidence://meity-gateway',meity_evidence_sha256=$3,meity_verified_at=now(),meity_validity_basis='VALID_UNTIL',meity_valid_until=now()+interval '1 year',calibration_required=false,calibration_status='NOT_APPLICABLE_WITH_JUSTIFICATION',calibration_not_required_reason='Gateway does not perform a physical measurement',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='test gateway without security evidence' where id=$1";
    await rejectsInSavepoint(client, () => client.query(gatewayApprovalWithoutSecurity, [gatewayId, identityId, "d".repeat(64)]), /Firmware-enabled instrument requires current support and reviewed security lifecycle evidence/i);

    const gatewayApproved = await client.query<{ approval_status: string }>(
      "update mrv_instruments set approval_status='VERIFIED',meity_certificate_id='MEITY-GW-TEST',meity_issuer='Official authority',meity_certificate_scope='Exact gateway model and revision',meity_verification_url='https://official.example.gov/gateway',meity_evidence_reference='evidence://meity-gateway',meity_evidence_sha256=$3,meity_verified_at=now(),meity_validity_basis='VALID_UNTIL',meity_valid_until=now()+interval '1 year',calibration_required=false,calibration_status='NOT_APPLICABLE_WITH_JUSTIFICATION',calibration_not_required_reason='Gateway does not perform a physical measurement',security_review_status='VERIFIED',security_evidence_reference='evidence://gateway-security-review',security_evidence_sha256=$4,security_reviewed_at=now(),reviewed_by_identity_id=$2,reviewed_at=now(),review_note='test gateway with reviewed security evidence' where id=$1 returning approval_status",
      [gatewayId, identityId, "e".repeat(64), "f".repeat(64)],
    );
    assert.equal(gatewayApproved.rows[0]?.approval_status, "VERIFIED");

    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});

async function rejectsInSavepoint(client: PoolClient, action: () => Promise<unknown>, expected: RegExp): Promise<void> {
  await client.query("savepoint instrument_assertion");
  try {
    await assert.rejects(action, (error: unknown) => {
      assert.match(error instanceof Error ? error.message : String(error), expected);
      return true;
    });
  } finally {
    await client.query("rollback to savepoint instrument_assertion");
    await client.query("release savepoint instrument_assertion");
  }
}
