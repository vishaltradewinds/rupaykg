import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

const url = process.env.DATABASE_URL;

test("PostgreSQL enforces MRV instrument approval evidence and append-only decisions", { skip: !url }, async () => {
  assert.ok(url);
  const pool = new Pool({ connectionString: url, max: 1, ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
  const client = await pool.connect();
  const suffix = randomUUID();
  try {
    const measurementColumns = await client.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema=current_schema() and table_name='measurements' and column_name in ('mrv_instrument_id','parameter_code')",
    );
    assert.deepEqual(new Set(measurementColumns.rows.map((row) => row.column_name)), new Set(["mrv_instrument_id", "parameter_code"]));

    await client.query("begin");
    const organizationId = (await client.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`mrv-instrument-test-${suffix}`],
    )).rows[0]!.id;
    const geographyId = (await client.query<{ id: string }>(
      "insert into geography(kind,code,name) values('STATE_UT',$1,$2) returning id",
      [`MRV-INSTRUMENT-${suffix}`, `MRV Instrument Test ${suffix}`],
    )).rows[0]!.id;
    await client.query(
      "insert into organization_geography_scopes(organization_id,geography_id) values($1,$2)",
      [organizationId, geographyId],
    );
    const identityId = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`mrv-instrument-test-${suffix}`, "MRV instrument test"],
    )).rows[0]!.id;
    const reviewerIdentityId = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`mrv-instrument-reviewer-${suffix}`, "MRV instrument reviewer"],
    )).rows[0]!.id;
    const reviewerRoleId = (await client.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions) values($1,$2,'[\"VERIFY_EVIDENCE\",\"TRANSFER_CREDENTIAL\"]'::jsonb) returning id",
      [organizationId, `MRV-REVIEWER-${suffix}`],
    )).rows[0]!.id;
    await client.query(
      "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
      [reviewerIdentityId, organizationId, reviewerRoleId],
    );
    const instrumentId = (await client.query<{ id: string; approval_status: string }>(
      "insert into mrv_instruments(organization_id,instrument_code,instrument_type,manufacturer,model,sku_revision,manufacturer_serial_number,asset_tag,intended_use,supported_parameter_codes,registered_by_identity_id) values($1,$2,'GAS_FLOW','Test Manufacturer','Flow Model 1','Rev A',$3,$4,'Landfill methane recovery flow measurement',array['gas_flow'],$5) returning id,approval_status",
      [organizationId, `FLOW-${suffix}`, `SERIAL-FLOW-${suffix}`, `ASSET-FLOW-${suffix}`, identityId],
    )).rows[0]!;
    assert.equal(instrumentId.approval_status, "HOLD");

    await rejectsInSavepoint(
      client,
      () => client.query(
        "insert into mrv_instruments(organization_id,instrument_code,instrument_type,manufacturer,model,sku_revision,manufacturer_serial_number,intended_use,supported_parameter_codes,registered_by_identity_id) values($1,$2,'GAS_FLOW','Test Manufacturer','Flow Model 1','Rev A',$3,'Duplicate serial fixture',array['gas_flow'],$4)",
        [organizationId, `DUPLICATE-SERIAL-${suffix}`, `SERIAL-FLOW-${suffix}`, identityId],
      ),
      /duplicate key/i,
    );

    const activityId = (await client.query<{ id: string }>(
      "insert into activities(organization_id,actor_identity_id,geography_id,activity_type,occurred_at) values($1,$2,$3,'MRV_INSTRUMENT_TEST',now()) returning id",
      [organizationId, identityId, geographyId],
    )).rows[0]!.id;
    const meityArtifact = await createReviewedArtifact(client, organizationId, activityId, identityId, reviewerIdentityId, "MEITY_CERTIFICATE", `MeitY exact model certificate ${suffix}`);
    const calibrationArtifact = await createReviewedArtifact(client, organizationId, activityId, identityId, reviewerIdentityId, "CALIBRATION_CERTIFICATE", `Calibration certificate ${suffix}`);
    const datasheetArtifact = await createReviewedArtifact(client, organizationId, activityId, identityId, reviewerIdentityId, "MANUFACTURER_DATASHEET", `Manufacturer datasheet ${suffix}`);
    const gatewayMeityArtifact = await createReviewedArtifact(client, organizationId, activityId, identityId, reviewerIdentityId, "MEITY_GATEWAY_CERTIFICATE", `Gateway MeitY certificate ${suffix}`);
    const gatewaySecurityArtifact = await createReviewedArtifact(client, organizationId, activityId, identityId, reviewerIdentityId, "SECURITY_REVIEW", `Gateway security review ${suffix}`);
    const reviewOrderArtifact = await createReviewedArtifact(
      client, organizationId, activityId, identityId, reviewerIdentityId,
      "REVIEW_ORDER_TEST", `Review order fixture ${suffix}`,
    );
    // PostgreSQL now() is transaction-stable: both decisions intentionally share a timestamp.
    await client.query(
      "insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale,created_at) values($1,$2,$3,'REJECTED','Later rejection must win',now())",
      [reviewOrderArtifact.evidenceId, reviewOrderArtifact.id, reviewerIdentityId],
    );
    const latestReview = await client.query<{ decision: string }>(
      "select decision from evidence_artifact_reviews where evidence_id=$1 order by review_sequence desc limit 1",
      [reviewOrderArtifact.evidenceId],
    );
    assert.equal(latestReview.rows[0]?.decision, "REJECTED");

    const foreignOrganizationId = (await client.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`foreign-evidence-org-${suffix}`],
    )).rows[0]!.id;
    const foreignActivityId = (await client.query<{ id: string }>(
      "insert into activities(organization_id,actor_identity_id,activity_type,occurred_at) values($1,$2,'MRV_INSTRUMENT_TEST',now()) returning id",
      [foreignOrganizationId, identityId],
    )).rows[0]!.id;
    const foreignMeityArtifact = await createReviewedArtifact(client, foreignOrganizationId, foreignActivityId, identityId, reviewerIdentityId, "MEITY_CERTIFICATE", `Foreign organization certificate ${suffix}`);
    await client.query(
      "insert into mrv_instrument_parameter_specs(instrument_id,parameter_code,unit,minimum_value,maximum_value,resolution,accuracy_absolute,accuracy_basis,source_evidence_artifact_version_id,created_by_identity_id) values($1,'gas_flow','m3/h',0,500,0.1,0.5,'test datasheet accuracy',$2,$3)",
      [instrumentId.id, datasheetArtifact.id, identityId],
    );

    await rejectsInSavepoint(client, () => client.query(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,mrv_instrument_id,parameter_code) values($1,2,'m3/h','test','instrument test',now(),$2,'gas_flow')",
      [activityId, instrumentId.id],
    ), /not VERIFIED/i);

    const initialDecision = await client.query<{ count: string }>(
      "select count(*)::text as count from mrv_instrument_decisions where instrument_id=$1",
      [instrumentId.id],
    );
    assert.equal(Number(initialDecision.rows[0]?.count), 1);

    await rejectsInSavepoint(client, () => client.query(
      "update mrv_instruments set approval_status='VERIFIED',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='must fail without approval evidence' where id=$1",
      [instrumentId.id, identityId],
    ), /exact-model MeitY approval evidence/i);

    const approvalSql = "update mrv_instruments set approval_status='VERIFIED',meity_certificate_id='MEITY-CERT-TEST',meity_issuer='Official authority',meity_certificate_scope='Exact manufacturer/model/SKU revision',meity_verification_url='https://official.example.gov/cert',meity_evidence_reference='evidence://meity-test',meity_evidence_sha256=$3,meity_evidence_artifact_version_id=$5,meity_verified_at=now(),meity_validity_basis='VALID_UNTIL',meity_valid_until=now()+interval '1 year',calibration_required=true,calibration_status='VERIFIED',calibration_certificate_id='CAL-TEST',calibration_evidence_reference='evidence://cal-test',calibration_evidence_sha256=$4,calibration_evidence_artifact_version_id=$6,calibration_lab='Traceable lab',calibration_traceability='National standard traceability',calibration_uncertainty=0.2,calibration_valid_until=now()+interval '1 year',security_review_status='NOT_APPLICABLE_WITH_JUSTIFICATION',security_not_applicable_reason='Test fixture uses no firmware; test-only written rationale',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='test exact-model approval and calibration evidence',calibration_serial_number=$7 where id=$1 returning approval_status";
    await rejectsInSavepoint(client, () => client.query(approvalSql, [instrumentId.id, identityId, "a".repeat(64), calibrationArtifact.sha256, meityArtifact.id, calibrationArtifact.id, `SERIAL-FLOW-${suffix}`]), /matching recomputed SHA-256/i);
    await rejectsInSavepoint(client, () => client.query(approvalSql, [instrumentId.id, identityId, meityArtifact.sha256, calibrationArtifact.sha256, meityArtifact.id, calibrationArtifact.id, "MISMATCHED-CALIBRATION-SERIAL"]), /calibration certificate serial must exactly match/i);
    await rejectsInSavepoint(client, () => client.query(approvalSql, [instrumentId.id, identityId, foreignMeityArtifact.sha256, calibrationArtifact.sha256, foreignMeityArtifact.id, calibrationArtifact.id, `SERIAL-FLOW-${suffix}`]), /same-organization evidence-vault artifact/i);
    const approved = await client.query<{ approval_status: string }>(
      approvalSql,
      [instrumentId.id, identityId, meityArtifact.sha256, calibrationArtifact.sha256, meityArtifact.id, calibrationArtifact.id, `SERIAL-FLOW-${suffix}`],
    );
    assert.equal(approved.rows[0]?.approval_status, "VERIFIED");
    await rejectsInSavepoint(
      client,
      () => client.query("update mrv_instruments set manufacturer_serial_number='CHANGED-SERIAL' where id=$1", [instrumentId.id]),
      /physical unit identity and calibration serial are immutable/i,
    );

    const validMeasurement = await client.query<{ id: string }>(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,mrv_instrument_id,parameter_code) values($1,2,'m3/h','test','instrument test',now(),$2,'gas_flow') returning id",
      [activityId, instrumentId.id],
    );
    assert.ok(validMeasurement.rows[0]?.id);

    // The MRV submission query must be able to consume direct/field-sync measurements
    // through the canonical instrument_code, not only mrv_observations rows.
    const submissionQuery = `select m.id, m.parameter_code, m.value::text as observed_value, i.instrument_code as instrument_id
         from measurements m join mrv_instruments i on i.id=m.mrv_instrument_id
        where m.activity_id=$1 and m.mrv_instrument_id is not null and m.parameter_code is not null
          and not exists (select 1 from mrv_observations mo where mo.activity_id=m.activity_id and mo.measurement_id=m.id)`;
    const submissionReading = await client.query<{ id: string; parameter_code: string; observed_value: string; instrument_id: string }>(submissionQuery, [activityId]);
    assert.ok(submissionReading.rows.some((reading) =>
      reading.id === validMeasurement.rows[0]?.id
      && reading.parameter_code === "gas_flow"
      && Number(reading.observed_value) === 2
      && reading.instrument_id === `FLOW-${suffix}`,
    ));

    // A measurement already represented by mrv_observations must not be forwarded twice.
    await client.query(
      "insert into mrv_observations(activity_id,measurement_id,parameter_code,observed_value,unit,method,instrument_id,observed_at) values($1,$2,'gas_flow',2,'m3/h','test', $3, now())",
      [activityId, validMeasurement.rows[0]!.id, `FLOW-${suffix}`],
    );
    const deduplicatedSubmission = await client.query(submissionQuery, [activityId]);
    assert.ok(!deduplicatedSubmission.rows.some((reading) => reading.id === validMeasurement.rows[0]?.id));
    const deduplicatedCount = await client.query<{ count: string }>(
      `select ((select count(*) from mrv_observations mo where mo.activity_id=$1)
          + (select count(*) from measurements mm where mm.activity_id=$1
              and mm.mrv_instrument_id is not null and mm.parameter_code is not null
              and not exists (select 1 from mrv_observations mo where mo.activity_id=mm.activity_id and mo.measurement_id=mm.id)))::text as count`,
      [activityId],
    );
    assert.equal(Number(deduplicatedCount.rows[0]?.count), 1);

    await client.query(
      "insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale) values($1,$2,$3,'REJECTED','Test rejection invalidates approval')",
      [meityArtifact.evidenceId, meityArtifact.id, reviewerIdentityId],
    );
    await rejectsInSavepoint(client, () => client.query(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,mrv_instrument_id,parameter_code) values($1,2,'m3/h','test','instrument test',now(),$2,'gas_flow')",
      [activityId, instrumentId.id],
    ), /no longer currently verified in the evidence vault/i);
    await client.query(
      "insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale) values($1,$2,$3,'APPROVED','New independent review restores approval')",
      [meityArtifact.evidenceId, meityArtifact.id, reviewerIdentityId],
    );

    await rejectsInSavepoint(client, () => client.query(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,mrv_instrument_id,parameter_code) values($1,2,'L/min','test','instrument test',now(),$2,'gas_flow')",
      [activityId, instrumentId.id],
    ), /no exact registered instrument specification/i);
    await rejectsInSavepoint(client, () => client.query(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,mrv_instrument_id,parameter_code) values($1,2,'M3/h','test','instrument test',now(),$2,'gas_flow')",
      [activityId, instrumentId.id],
    ), /no exact registered instrument specification/i);
    await rejectsInSavepoint(client, () => client.query(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,mrv_instrument_id,parameter_code) values($1,501,'m3/h','test','instrument test',now(),$2,'gas_flow')",
      [activityId, instrumentId.id],
    ), /outside the registered instrument parameter range/i);
    await rejectsInSavepoint(client, () => client.query(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,mrv_instrument_id,parameter_code) values($1,2.05,'m3/h','test','instrument test',now(),$2,'gas_flow')",
      [activityId, instrumentId.id],
    ), /exceeds the registered instrument resolution/i);
    await rejectsInSavepoint(client, () => client.query(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,mrv_instrument_id,parameter_code) values($1,2,'m3/h','test','instrument test',now(),$2,'methane_content')",
      [activityId, instrumentId.id],
    ), /not supported/i);

    const incompleteInstrumentId = (await client.query<{ id: string }>(
      "insert into mrv_instruments(organization_id,instrument_code,instrument_type,manufacturer,model,sku_revision,intended_use,supported_parameter_codes,registered_by_identity_id) values($1,$2,'GAS_ANALYSER','Test Manufacturer','Analyzer Model 1','Rev A','Methane-content measurement',array['gas_flow','methane_content'],$3) returning id",
      [organizationId, `INCOMPLETE-SPECS-${suffix}`, identityId],
    )).rows[0]!.id;
    await client.query(
      "insert into mrv_instrument_parameter_specs(instrument_id,parameter_code,unit,minimum_value,maximum_value,resolution,accuracy_absolute,accuracy_basis,source_evidence_artifact_version_id,created_by_identity_id) values($1,'gas_flow','m3/h',0,500,0.1,0.5,'test datasheet accuracy',$2,$3)",
      [incompleteInstrumentId, datasheetArtifact.id, identityId],
    );
    await rejectsInSavepoint(client, () => client.query(
      approvalSql,
      [incompleteInstrumentId, identityId, meityArtifact.sha256, calibrationArtifact.sha256, meityArtifact.id, calibrationArtifact.id, `SERIAL-INCOMPLETE-${suffix}`],
    ), /structured unit\/range\/resolution\/accuracy specification for every supported parameter/i);

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
      "update mrv_instrument_parameter_specs set maximum_value=600 where instrument_id=$1",
      [instrumentId.id],
    ), /parameter specifications are immutable/i);
    await rejectsInSavepoint(client, () => client.query(
      "update mrv_instruments set meity_evidence_artifact_version_id=$2 where id=$1",
      [instrumentId.id, calibrationArtifact.id],
    ), /immutable after first verification/i);

    await rejectsInSavepoint(client, () => client.query(
      "update mrv_instrument_decisions set decision_note='tampered' where instrument_id=$1",
      [instrumentId.id],
    ), /append-only/i);

    const gatewayId = (await client.query<{ id: string }>(
      "insert into mrv_instruments(organization_id,instrument_code,instrument_type,manufacturer,model,sku_revision,manufacturer_serial_number,asset_tag,intended_use,measurement_instrument,non_measurement_reason,supported_parameter_codes,firmware_version,firmware_support_until,registered_by_identity_id) values($1,$2,'INDUSTRIAL_GATEWAY','Test Manufacturer','Gateway Model 1','Rev A',$3,$4,'Authenticated MRV data transport',false,'Gateway transports data but does not measure a physical parameter','{}','1.0.0',now()+interval '1 year',$5) returning id",
      [organizationId, `GATEWAY-${suffix}`, `SERIAL-GATEWAY-${suffix}`, `ASSET-GATEWAY-${suffix}`, identityId],
    )).rows[0]!.id;

    const gatewayApprovalWithoutSecurity = "update mrv_instruments set approval_status='VERIFIED',meity_certificate_id='MEITY-GW-TEST',meity_issuer='Official authority',meity_certificate_scope='Exact gateway model and revision',meity_verification_url='https://official.example.gov/gateway',meity_evidence_reference='evidence://meity-gateway',meity_evidence_sha256=$3,meity_verified_at=now(),meity_validity_basis='VALID_UNTIL',meity_valid_until=now()+interval '1 year',calibration_required=false,calibration_status='NOT_APPLICABLE_WITH_JUSTIFICATION',calibration_not_required_reason='Gateway does not perform a physical measurement',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='test gateway without security evidence' where id=$1";
    await rejectsInSavepoint(client, () => client.query(gatewayApprovalWithoutSecurity, [gatewayId, identityId, "d".repeat(64)]), /Firmware-enabled instrument requires current support and reviewed security lifecycle evidence/i);

    const gatewayApproved = await client.query<{ approval_status: string }>(
      "update mrv_instruments set approval_status='VERIFIED',meity_certificate_id='MEITY-GW-TEST',meity_issuer='Official authority',meity_certificate_scope='Exact gateway model and revision',meity_verification_url='https://official.example.gov/gateway',meity_evidence_reference='evidence://meity-gateway',meity_evidence_sha256=$3,meity_evidence_artifact_version_id=$5,meity_verified_at=now(),meity_validity_basis='VALID_UNTIL',meity_valid_until=now()+interval '1 year',calibration_required=false,calibration_status='NOT_APPLICABLE_WITH_JUSTIFICATION',calibration_not_required_reason='Gateway does not perform a physical measurement',security_review_status='VERIFIED',security_evidence_reference='evidence://gateway-security-review',security_evidence_sha256=$4,security_evidence_artifact_version_id=$6,security_reviewed_at=now(),reviewed_by_identity_id=$2,reviewed_at=now(),review_note='test gateway with reviewed security evidence' where id=$1 returning approval_status",
      [gatewayId, identityId, gatewayMeityArtifact.sha256, gatewaySecurityArtifact.sha256, gatewayMeityArtifact.id, gatewaySecurityArtifact.id],
    );
    assert.equal(gatewayApproved.rows[0]?.approval_status, "VERIFIED");

    // Once authoritative MRV provenance exists, all measurement mutations must fail closed.
    const verificationId = (await client.query<{ id: string }>(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope) values($1,$2,$3,'APPROVED','MRV measurement freeze regression') returning id",
      [meityArtifact.evidenceId, activityId, reviewerIdentityId],
    )).rows[0]!.id;
    await client.query(
      "insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,methodology_code,metadata) values($1,$2,$3,'TEST-POLICY','TEST-EXECUTION','VERIFIED','CONSENSUS_CONFIRMED','0.0.12345','TEST-TX','2026-10-26T09:00:00.000Z',$4,'TEST-METHODOLOGY','{\"testFixture\":\"true\"}'::jsonb)",
      [activityId, verificationId, meityArtifact.evidenceId, "e".repeat(64)],
    );
    await rejectsInSavepoint(client, () => client.query(
      "insert into measurements(activity_id,value,unit,method,source,measured_at) values($1,3,'kg','test','late reading',now())",
      [activityId],
    ), /MRV_INPUT_IMMUTABLE_AFTER_SUBMISSION/i);
    await rejectsInSavepoint(client, () => client.query(
      "update measurements set value=3 where id=$1",
      [validMeasurement.rows[0]!.id],
    ), /MRV_INPUT_IMMUTABLE_AFTER_SUBMISSION/i);
    await rejectsInSavepoint(client, () => client.query(
      "delete from measurements where id=$1",
      [validMeasurement.rows[0]!.id],
    ), /MRV_INPUT_IMMUTABLE_AFTER_SUBMISSION/i);
    await rejectsInSavepoint(client, () => client.query(
      "insert into mrv_observations(activity_id,parameter_code,observed_value,unit,method,instrument_id,observed_at) values($1,'gas_flow',3,'m3/h','test', $2, now())",
      [activityId, `FLOW-${suffix}`],
    ), /MRV_INPUT_IMMUTABLE_AFTER_SUBMISSION/i);
    await rejectsInSavepoint(client, () => client.query(
      "update mrv_observations set observed_value=3 where activity_id=$1 and measurement_id=$2",
      [activityId, validMeasurement.rows[0]!.id],
    ), /MRV_INPUT_IMMUTABLE_AFTER_SUBMISSION/i);
    await rejectsInSavepoint(client, () => client.query(
      "delete from mrv_observations where activity_id=$1 and measurement_id=$2",
      [activityId, validMeasurement.rows[0]!.id],
    ), /MRV_INPUT_IMMUTABLE_AFTER_SUBMISSION/i);

    // Existing credentials must not be transferred or settled when evidence is later rejected.
    const credentialId = (await client.query<{ id: string }>(
      "insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id) values($1,$2,'MRV-TEST-ROOT','ELIGIBLE',$3) returning id",
      [activityId, organizationId, verificationId],
    )).rows[0]!.id;
    const evidenceCurrentBeforeRejection = await client.query<{ current: boolean }>(
      "select credential_has_current_mrv_instrument_evidence($1) as current",
      [credentialId],
    );
    assert.equal(evidenceCurrentBeforeRejection.rows[0]?.current, true);

    await client.query(
      "insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale) values($1,$2,$3,'REJECTED','Regression: later rejection blocks registry use')",
      [meityArtifact.evidenceId, meityArtifact.id, reviewerIdentityId],
    );
    const evidenceCurrentAfterRejection = await client.query<{ current: boolean }>(
      "select credential_has_current_mrv_instrument_evidence($1) as current",
      [credentialId],
    );
    assert.equal(evidenceCurrentAfterRejection.rows[0]?.current, false);

    // A caller-controlled provenance metadata marker must not bypass current-evidence
    // checks when an existing eligible credential is promoted into a value-bearing state.
    await rejectsInSavepoint(client, () => client.query(
      "update credentials set status='ISSUED' where id=$1",
      [credentialId],
    ), /CREDENTIAL_MRV_INSTRUMENT_EVIDENCE_REQUIRED/i);

    await rejectsInSavepoint(client, () => client.query(
      "insert into registry_events(credential_id,event_type,event_hash,from_owner_id,to_owner_id,recorded_by_identity_id) values($1,'TRANSFERRED',$2,$3,$4,$5)",
      [credentialId, "f".repeat(64), organizationId, foreignOrganizationId, reviewerIdentityId],
    ), /REGISTRY_MRV_EVIDENCE_STALE/i);

    await rejectsInSavepoint(client, () => client.query(
      "insert into settlements(credential_id,payer_id,payee_id,amount,currency,status,authorization_reference,verified_at) values($1,$2,$3,1,'INR','EXECUTING','TEST-AUTH',now())",
      [credentialId, organizationId, foreignOrganizationId],
    ), /SETTLEMENT_MRV_EVIDENCE_STALE/i);

    // Demotion must not make the same physical instrument identity editable again.
    await client.query(
      "update mrv_instruments set approval_status='HOLD',reviewed_by_identity_id=$2,reviewed_at=now(),review_note='test demotion after verification' where id=$1",
      [instrumentId.id, reviewerIdentityId],
    );
    await rejectsInSavepoint(client, () => client.query(
      "update mrv_instrument_parameter_specs set maximum_value=600 where instrument_id=$1",
      [instrumentId.id],
    ), /immutable after first verification/i);
    await rejectsInSavepoint(client, () => client.query(
      "update mrv_instruments set model='substituted after demotion' where id=$1",
      [instrumentId.id],
    ), /immutable after first verification/i);
    await rejectsInSavepoint(client, () => client.query(
      "update mrv_instruments set meity_evidence_artifact_version_id=$2 where id=$1",
      [instrumentId.id, calibrationArtifact.id],
    ), /immutable after first verification/i);

    await rejectsInSavepoint(client, () => client.query(
      "update mrv_instruments set security_evidence_artifact_version_id=$2 where id=$1",
      [instrumentId.id, meityArtifact.id],
    ), /immutable after first verification/i);

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


async function createReviewedArtifact(
  client: PoolClient,
  organizationId: string,
  activityId: string,
  uploaderIdentityId: string,
  reviewerIdentityId: string,
  evidenceType: string,
  contentText: string,
): Promise<{ id: string; sha256: string; evidenceId: string }> {
  const bytes = Buffer.from(contentText, "utf8");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const seriesId = (await client.query<{ id: string }>(
    "insert into evidence_artifact_series(organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,$3,$4) returning id",
    [organizationId, activityId, evidenceType, uploaderIdentityId],
  )).rows[0]!.id;
  const evidenceId = (await client.query<{ id: string }>(
    "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,$2,'VERIFIED',now(),'db://evidence-vault/pending',$3,'{}'::jsonb) returning id",
    [activityId, evidenceType, sha256],
  )).rows[0]!.id;
  const artifactId = (await client.query<{ id: string }>(
    "insert into evidence_artifact_versions(series_id,evidence_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id,source_reference) values($1,$2,1,$3,'text/plain',$4,$5,$6,$7,$8) returning id",
    [seriesId, evidenceId, `${evidenceType.toLowerCase()}-test.txt`, bytes.length, sha256, bytes, uploaderIdentityId, "https://official.example.gov/test-evidence"],
  )).rows[0]!.id;
  await client.query("update evidence set content_uri=$2 where id=$1", [evidenceId, `db://evidence-vault/${artifactId}`]);
  await client.query(
    "insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale) values($1,$2,$3,'APPROVED','Independent test fixture review')",
    [evidenceId, artifactId, reviewerIdentityId],
  );
  return { id: artifactId, sha256, evidenceId };
}
