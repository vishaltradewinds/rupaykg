import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

/**
 * Creates a fully evidence-bound instrument and one instrument-linked reading for
 * database integration fixtures. This is test data only; it is not real hardware
 * qualification, MeitY certification, calibration evidence, or project eligibility.
 */
export async function createCurrentInstrumentReading(
  client: PoolClient,
  input: {
    organizationId: string;
    activityId: string;
    uploaderIdentityId: string;
    reviewerIdentityId: string;
    label: string;
  },
): Promise<{ instrumentId: string; instrumentCode: string }> {
  const suffix = randomUUID();
  const createArtifact = async (evidenceType: string, text: string) => {
    const bytes = Buffer.from(text, "utf8");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const seriesId = (await client.query<{ id: string }>(
      "insert into evidence_artifact_series(organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,$3,$4) returning id",
      [input.organizationId, input.activityId, evidenceType, input.uploaderIdentityId],
    )).rows[0]!.id;
    const evidenceId = (await client.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,$2,'VERIFIED',now(),'db://evidence-vault/pending',$3,'{}'::jsonb) returning id",
      [input.activityId, evidenceType, sha256],
    )).rows[0]!.id;
    const artifactId = (await client.query<{ id: string }>(
      "insert into evidence_artifact_versions(series_id,evidence_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id,source_reference) values($1,$2,1,$3,'text/plain',$4,$5,$6,$7,$8) returning id",
      [seriesId, evidenceId, `${evidenceType.toLowerCase()}-${suffix}.txt`, bytes.length, sha256, bytes, input.uploaderIdentityId, "https://official.example.gov/test-evidence"],
    )).rows[0]!.id;
    await client.query("update evidence set content_uri=$2 where id=$1", [evidenceId, `db://evidence-vault/${artifactId}`]);
    await client.query(
      "insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale) values($1,$2,$3,'APPROVED','Independent test-fixture review only')",
      [evidenceId, artifactId, input.reviewerIdentityId],
    );
    return { id: artifactId, sha256 };
  };

  const meity = await createArtifact("MEITY_CERTIFICATE", `TEST ONLY MeitY evidence ${suffix}`);
  const calibration = await createArtifact("CALIBRATION_CERTIFICATE", `TEST ONLY calibration evidence ${suffix}`);
  const datasheet = await createArtifact("MANUFACTURER_DATASHEET", `TEST ONLY parameter source ${suffix}`);
  const instrumentCode = `TEST-FLOW-${suffix}`;
  const instrumentId = (await client.query<{ id: string }>(
    "insert into mrv_instruments(organization_id,instrument_code,instrument_type,manufacturer,model,sku_revision,manufacturer_serial_number,asset_tag,intended_use,supported_parameter_codes,registered_by_identity_id) values($1,$2,'GAS_FLOW','Test-only fixture manufacturer','Test-only flow model','fixture-rev-1',$3,$4,'Database integration fixture only',array['gas_flow'],$5) returning id",
    [input.organizationId, instrumentCode, `SERIAL-${suffix}`, `ASSET-${suffix}`, input.uploaderIdentityId],
  )).rows[0]!.id;
  await client.query(
    "insert into mrv_instrument_parameter_specs(instrument_id,parameter_code,unit,minimum_value,maximum_value,resolution,accuracy_absolute,accuracy_basis,source_evidence_artifact_version_id,created_by_identity_id) values($1,'gas_flow','m3/h',0,500,0.1,0.5,'test-fixture-only',$2,$3)",
    [instrumentId, datasheet.id, input.uploaderIdentityId],
  );
  await client.query(
    "update mrv_instruments set approval_status='VERIFIED',meity_certificate_id=$2,meity_issuer='Test fixture only',meity_certificate_scope='Test fixture only; not an actual approval',meity_verification_url='https://official.example.gov/test-fixture-only',meity_evidence_reference='test-fixture://meity',meity_evidence_sha256=$3,meity_evidence_artifact_version_id=$4,meity_verified_at=now(),meity_validity_basis='VALID_UNTIL',meity_valid_until=now()+interval '1 year',calibration_required=true,calibration_status='VERIFIED',calibration_certificate_id='TEST-CALIBRATION',calibration_evidence_reference='test-fixture://calibration',calibration_evidence_sha256=$5,calibration_evidence_artifact_version_id=$6,calibration_lab='Test fixture only',calibration_traceability='Test fixture only',calibration_uncertainty=0.1,calibration_valid_until=now()+interval '1 year',security_review_status='NOT_APPLICABLE_WITH_JUSTIFICATION',security_not_applicable_reason='Test fixture only; no physical instrument exists',reviewed_by_identity_id=$7,reviewed_at=now(),review_note='Synthetic test fixture only',calibration_serial_number=$8 where id=$1",
    [instrumentId, `TEST-CERT-${suffix}`, meity.sha256, meity.id, calibration.sha256, calibration.id, input.reviewerIdentityId, `SERIAL-${suffix}`],
  );
  await client.query(
    "insert into mrv_observations(activity_id,parameter_code,observed_value,unit,method,instrument_id,observed_at,metadata) values($1,'gas_flow',2,'m3/h','database-test-fixture',$2,now(),jsonb_build_object('testFixture',true,'label',$3::text))",
    [input.activityId, instrumentCode, input.label],
  );
  return { instrumentId, instrumentCode };
}
