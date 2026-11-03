import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import type { AuthContext } from "./auth.js";
import { captureMrvSourceSnapshot, MrvSnapshotError } from "./mrv-source-snapshot.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("MRV source snapshots are immutable, idempotent and require explicit correction lineage", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const suffix = randomBytes(8).toString("hex");
  try {
    const organization = await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'COLLECTOR','VERIFIED') returning id",
      ["TEST-MRV-SNAPSHOT-" + suffix],
    );
    const organizationId = organization.rows[0]!.id;
    const geography = await pool.query<{ id: string }>(
      "insert into geography(kind,name,source,source_version) values('STATE_UT',$1,'integration-test','fixture-v1') returning id",
      ["TEST-MRV-GEO-" + suffix],
    );
    await pool.query("insert into organization_geography_scopes(organization_id,geography_id) values($1,$2)", [organizationId, geography.rows[0]!.id]);
    const activity = await pool.query<{ id: string }>(
      "insert into activities(organization_id,geography_id,activity_type,status,occurred_at,completed_at) values($1,$2,'WASTE_WEIGHT_MEASUREMENT','COMPLETED',now()-interval '1 day',now()) returning id",
      [organizationId, geography.rows[0]!.id],
    );
    const identity = await pool.query<{ id: string }>(
      "insert into identities(external_subject,display_name,status) values($1,$2,'VERIFIED') returning id",
      ["test-mrv-snapshot:"+suffix,"MRV Snapshot Actor"],
    );
    const identityId = identity.rows[0]!.id;
    const role = await pool.query<{ id: string }>(
      "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3::jsonb,'[]') returning id",
      [organizationId,"mrv_snapshot_test_"+suffix,JSON.stringify(["guardian:operate","VERIFY_EVIDENCE","ISSUE_CREDENTIAL"])],
    );
    await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    try {
      await pool.query(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
        [identityId,organizationId,role.rows[0]!.id],
      );
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }
    const evidence = await pool.query<{ id: string }>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,'WEIGHBRIDGE_TICKET','VERIFIED',now(),'test://mrv-snapshot',$2,'{}'::jsonb) returning id",
      [activity.rows[0]!.id,"a".repeat(64)],
    );
    const verification = await pool.query<{ id: string }>(
      "insert into verifications(evidence_id,activity_id,verifier_identity_id,decision,scope,rationale) values($1,$2,$3,'APPROVED','MRV_SNAPSHOT_TEST','independent test fixture') returning id",
      [evidence.rows[0]!.id,activity.rows[0]!.id,identityId],
    );
    await pool.query(
      "insert into measurements(activity_id,value,unit,method,source,measured_at,quality_status,metadata) values($1,10,'kg','calibrated-scale','integration-test',now(),'VERIFIED','{}'::jsonb)",
      [activity.rows[0]!.id],
    );
    await pool.query(
      "insert into mrv_observations(activity_id,parameter_code,observed_value,unit,method,observed_at,quality_status,metadata) values($1,'mass',10,'kg','calibrated-scale',now(),'VERIFIED','{}'::jsonb)",
      [activity.rows[0]!.id],
    );

    const auth: AuthContext = {
      identityId,
      activeOrganizationId: organizationId,
      memberships: [{ organization_id: organizationId, role_id: role.rows[0]!.id, status: "VERIFIED" }],
    };
    const input = {
      pool, auth, activityId: activity.rows[0]!.id, verificationId: verification.rows[0]!.id,
      evidenceId: evidence.rows[0]!.id, guardianPolicyId: "test-policy", methodologyCode: "BM WA03.001",
    };
    const golden = await pool.query<{ digest: string }>(
      "select mrv_source_snapshot_digest(jsonb_build_object('b',2,'a',1)) as digest",
    );
    assert.equal(golden.rows[0]?.digest, "d8497d9d82770a70729261095aa98f7ef5154d7af499f8037b6ca250296785a6");

    const first = await captureMrvSourceSnapshot(input);
    assert.equal(first.snapshot.snapshot_version, 1);
    assert.equal(first.snapshot.supersedes_snapshot_id, null);
    assert.equal(first.observations.length, 1);
    assert.equal(first.measurements.length, 1);
    assert.equal(first.evidence.length, 1);

    const replay = await captureMrvSourceSnapshot(input);
    assert.equal(replay.snapshot.id, first.snapshot.id);
    assert.equal(replay.snapshot.snapshot_version, 1);

    await pool.query("update measurements set value=11 where activity_id=$1", [activity.rows[0]!.id]);
    await assert.rejects(
      () => captureMrvSourceSnapshot(input),
      (error: unknown) => error instanceof MrvSnapshotError && error.code === "MRV_CORRECTION_REASON_REQUIRED",
    );

    const corrected = await captureMrvSourceSnapshot({ ...input, correctionReason: "Corrected weighbridge reading against the signed source ticket" });
    assert.equal(corrected.snapshot.snapshot_version, 2);
    assert.equal(corrected.snapshot.supersedes_snapshot_id, first.snapshot.id);
    assert.notEqual(corrected.snapshot.source_digest, first.snapshot.source_digest);
    assert.ok(Number(corrected.snapshot.source_revision) > Number(first.snapshot.source_revision));

    const staleSnapshotDigest = first.snapshot.source_digest;
    await pool.query(
      "insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,metadata,mirror_node_verified_at,source_snapshot_id,source_snapshot_digest,source_snapshot_version) values($1,$2,$3,'test-policy','test-guardian','VERIFIED','CONSENSUS_CONFIRMED','0.0.123','test-tx','test-consensus',$4,'{}'::jsonb,clock_timestamp(),$5,$6,1)",
      [activity.rows[0]!.id, verification.rows[0]!.id, evidence.rows[0]!.id, "e".repeat(64), first.snapshot.id, staleSnapshotDigest],
    );
    const staleCredential = await pool.query<{ id: string }>(
      "insert into credentials(activity_id,issuer_organization_id,trust_root_id,status,verification_id,quantity,unit) values($1,$2,'mrv-snapshot-test-root','ELIGIBLE',$3,10,'kg') returning id",
      [activity.rows[0]!.id, organizationId, verification.rows[0]!.id],
    );
    await assert.rejects(
      () => pool.query("update credentials set status='ISSUED' where id=$1", [staleCredential.rows[0]!.id]),
      /CREDENTIAL_MRV_REQUIRED/,
    );

    await assert.rejects(
      () => pool.query(
        `insert into mrv_source_snapshots(
           activity_id,verification_id,evidence_id,guardian_policy_id,methodology_code,
           snapshot_version,source_revision,source_digest,source_payload,supersedes_snapshot_id,correction_reason,created_by_identity_id
         ) select activity_id,verification_id,evidence_id,guardian_policy_id,methodology_code,
                  99,source_revision,source_digest,jsonb_set(source_payload,'{observations,0,observed_value}','"forged"'::jsonb),
                  id,'Forged payload must be rejected',created_by_identity_id
             from mrv_source_snapshots where id=$1`,
        [first.snapshot.id],
      ),
      /MRV_SOURCE_SNAPSHOT_DIGEST_MISMATCH/,
    );
    await assert.rejects(
      () => pool.query("truncate mrv_source_snapshots"),
      /MRV source snapshots cannot be truncated/,
    );

    await assert.rejects(
      () => pool.query("update mrv_source_snapshots set correction_reason=correction_reason where id=$1", [first.snapshot.id]),
      /MRV source snapshots are immutable/,
    );
  } finally {
    await pool.end();
  }
});
