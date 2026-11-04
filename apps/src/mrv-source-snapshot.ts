import type { Pool, PoolClient } from "pg";
import { canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

export type MrvSourceSnapshot = {
  id: string;
  activity_id: string;
  verification_id: string;
  evidence_id: string;
  snapshot_version: number;
  source_revision: number | string;
  source_digest: string;
  source_payload: Record<string, unknown>;
  supersedes_snapshot_id: string | null;
  correction_reason: string | null;
  created_at: Date | string;
};

export type MrvSnapshotCapture = {
  snapshot: MrvSourceSnapshot;
  observations: Record<string, unknown>[];
  measurements: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  artifactSeries: Record<string, unknown>[];
  latestQuantity: number | undefined;
  latestUnit: string | undefined;
  organizationId: string;
};

export class MrvSnapshotError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus = 409) {
    super(message);
    this.name = "MrvSnapshotError";
  }
}


type ActivityRow = {
  id: string; organization_id: string; actor_identity_id: string | null; geography_id: string | null; activity_type: string;
  status: string; occurred_at: Date | string | null; completed_at: Date | string | null; created_at: Date | string; mrv_source_revision: number | string; metadata: Record<string, unknown>; snapshot_record_json: string;
};
type VerificationRow = {
  id: string; evidence_id: string; verifier_identity_id: string; decision: string; scope: string; rationale: string | null; decided_at: Date | string; snapshot_record_json: string;
};
type EvidenceRow = Record<string, unknown> & { id: string; status: string; evidence_snapshot_record_json: string; artifact_version_snapshot_record_json: string | null; artifact_series_snapshot_record_json: string | null; reviews_snapshot_records_json: string };
type MeasurementRow = Record<string, unknown> & { value: string | number; unit: string; snapshot_record_json: string };

export async function captureMrvSourceSnapshot(input: {
  pool: Pool;
  auth: AuthContext;
  activityId: string;
  verificationId: string;
  evidenceId: string;
  guardianPolicyId: string;
  methodologyCode?: string;
  correctionReason?: string | null;
}): Promise<MrvSnapshotCapture> {
  const client: PoolClient = await input.pool.connect();
  const snapshotLockKey = `mrv-source:${input.activityId}`;
  let lockAcquired = false;
  let transactionOpen = false;
  try {
    // Acquire the session lock before BEGIN so a waiting REPEATABLE READ transaction
    // does not retain a stale snapshot taken before the preceding writer committed.
    await client.query("select pg_advisory_lock(hashtext($1))", [snapshotLockKey]);
    lockAcquired = true;
    await client.query("begin isolation level repeatable read");
    transactionOpen = true;

    const activityResult = await client.query<ActivityRow>(
      "select a.id,a.organization_id,a.actor_identity_id,a.geography_id,a.activity_type,a.status::text,a.occurred_at,a.completed_at,a.created_at,a.mrv_source_revision,a.metadata,to_jsonb(a)::text snapshot_record_json from activities a where a.id=$1 for share",
      [input.activityId],
    );
    const activity = activityResult.rows[0];
    if (!activity) throw new MrvSnapshotError("MRV_BINDING_INVALID", "Activity was not found", 404);
    if (!canActForOrganization(input.auth, activity.organization_id)) {
      throw new MrvSnapshotError("ORG_FORBIDDEN", "Active organization does not match the activity organization", 403);
    }
    if (!await hasOrganizationPermission(client, input.auth, activity.organization_id, ["guardian:operate"])) {
      throw new MrvSnapshotError("MRV_PERMISSION_REQUIRED", "Guardian MRV operation permission required", 403);
    }
    if (!activity.geography_id) throw new MrvSnapshotError("GEOGRAPHY_FORBIDDEN", "Activity has no authorized geography", 403);
    const geography = await client.query<{ ok: boolean }>(
      `select exists(
         select 1 from organization_memberships om
         where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED'
           and organization_has_geography_scope(om.organization_id,$3)
       ) as ok`,
      [input.auth.identityId, activity.organization_id, activity.geography_id],
    );
    if (geography.rows[0]?.ok !== true) throw new MrvSnapshotError("GEOGRAPHY_FORBIDDEN", "Activity geography is outside organization authorization scope", 403);

    const verificationResult = await client.query<VerificationRow>(
      "select v.id,v.evidence_id,v.verifier_identity_id,v.decision::text,v.scope,v.rationale,v.decided_at,to_jsonb(v)::text snapshot_record_json from verifications v where v.id=$1 and v.activity_id=$2 for share",
      [input.verificationId, input.activityId],
    );
    const verification = verificationResult.rows[0];
    if (!verification || verification.decision !== "APPROVED" || verification.evidence_id !== input.evidenceId) {
      throw new MrvSnapshotError("MRV_BINDING_INVALID", "Approved verification must bind the selected evidence to this activity");
    }
    const selectedEvidence = await client.query<{ id: string; status: string; activity_id: string | null }>(
      "select id,status::text,activity_id from evidence where id=$1 and activity_id=$2 for share",
      [input.evidenceId, input.activityId],
    );
    if (selectedEvidence.rows[0]?.status !== "VERIFIED") {
      throw new MrvSnapshotError("MRV_PRECONDITION_FAILED", "Selected evidence must be VERIFIED");
    }
    if (activity.status !== "COMPLETED") {
      throw new MrvSnapshotError("MRV_PRECONDITION_FAILED", "Activity must be COMPLETED before Guardian MRV");
    }

    const observationsResult = await client.query<Record<string, unknown> & { snapshot_record_json: string }>(
      "select mo.id,mo.parameter_code,mo.observed_value::text observed_value,mo.unit,mo.method,mo.instrument_id,mo.observed_at,mo.uncertainty::text uncertainty,mo.quality_status::text quality_status,mo.metadata,to_jsonb(mo)::text snapshot_record_json from mrv_observations mo where mo.activity_id=$1 order by mo.observed_at,mo.id",
      [input.activityId],
    );
    const measurementsResult = await client.query<MeasurementRow>(
      "select m.id,m.value::text value,m.unit,m.method,m.source,m.measured_at,m.quality_status::text quality_status,m.metadata,to_jsonb(m)::text snapshot_record_json from measurements m where m.activity_id=$1 order by m.measured_at,m.id",
      [input.activityId],
    );
    const evidenceResult = await client.query<EvidenceRow>(
      `select e.id,e.activity_id,e.measurement_id,e.evidence_type,e.status::text status,e.captured_at,
              e.content_uri,e.content_hash,e.metadata,
              v.id artifact_version_id,v.series_id artifact_series_id,v.version_number artifact_version_number,v.sha256 artifact_sha256,
              v.file_name artifact_file_name,v.size_bytes artifact_size_bytes,v.media_type artifact_media_type,
              v.uploaded_by_identity_id artifact_uploaded_by_identity_id,v.source_reference artifact_source_reference,
              v.measurement_period_start artifact_measurement_period_start,v.measurement_period_end artifact_measurement_period_end,
              v.created_at artifact_version_created_at,
              to_jsonb(e)::text evidence_snapshot_record_json,
              case when v.id is null then null else (to_jsonb(v) - 'content')::text end artifact_version_snapshot_record_json,
              case when s.id is null then null else to_jsonb(s)::text end artifact_series_snapshot_record_json,
              s.organization_id artifact_series_organization_id,s.activity_id artifact_series_activity_id,
              s.evidence_type artifact_series_evidence_type,s.created_by_identity_id artifact_series_created_by_identity_id,
              s.created_at artifact_series_created_at,
              coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.id) from evidence_artifact_reviews r where r.evidence_id=e.id),'[]'::jsonb)::text reviews_snapshot_records_json
         from evidence e
         left join evidence_artifact_versions v on v.evidence_id=e.id
         left join evidence_artifact_series s on s.id=v.series_id
        where e.activity_id=$1 order by e.captured_at,e.id,v.version_number,v.id`,
      [input.activityId],
    );

    const artifactSeriesResult = await client.query<{ record_json: string }>(
      "select to_jsonb(s)::text record_json from evidence_artifact_series s where s.activity_id=$1 order by s.created_at,s.id",
      [input.activityId],
    );

    const payload = {
      schema: "rupaykg:mrv-source-snapshot:v1",
      activity: { id: activity.id, sourceRevision: activity.mrv_source_revision, recordJson: activity.snapshot_record_json },
      verification: { id: verification.id, recordJson: verification.snapshot_record_json },
      selectedEvidenceId: input.evidenceId,
      guardianPolicyId: input.guardianPolicyId,
      methodologyCode: input.methodologyCode ?? null,
      observations: observationsResult.rows.map(row => ({ recordJson: row.snapshot_record_json, observedValue: row.observed_value, uncertainty: row.uncertainty })),
      measurements: measurementsResult.rows.map(row => ({ recordJson: row.snapshot_record_json, value: row.value, unit: row.unit })),
      evidence: evidenceResult.rows.map(row => ({ evidenceRecordJson: row.evidence_snapshot_record_json, artifactVersionRecordJson: row.artifact_version_snapshot_record_json, artifactSeriesRecordJson: row.artifact_series_snapshot_record_json, reviewRecordsJson: row.reviews_snapshot_records_json })),
      artifactSeries: artifactSeriesResult.rows.map(row => row.record_json),
    };
    const digestResult = await client.query<{ digest: string }>(
      "select mrv_source_snapshot_digest($1::jsonb) as digest",
      [JSON.stringify(payload)],
    );
    const digest = digestResult.rows[0]?.digest;
    if (!digest) throw new Error("PostgreSQL did not return the canonical MRV source digest");
    const latestResult = await client.query<MrvSourceSnapshot>(
      "select * from mrv_source_snapshots where activity_id=$1 order by snapshot_version desc limit 1 for update",
      [input.activityId],
    );
    const latest = latestResult.rows[0];
    let snapshot: MrvSourceSnapshot;
    if (latest?.source_digest === digest) {
      snapshot = latest;
    } else {
      const correctionReason = input.correctionReason?.trim() || null;
      if (latest && (!correctionReason || correctionReason.length < 10 || correctionReason.length > 2000)) {
        throw new MrvSnapshotError(
          "MRV_CORRECTION_REASON_REQUIRED",
          "MRV source data changed since the previous snapshot. Supply a 10–2000 character correctionReason to create an auditable superseding snapshot.",
        );
      }
      const version = (latest?.snapshot_version ?? 0) + 1;
      const inserted = await client.query<MrvSourceSnapshot>(
        `insert into mrv_source_snapshots(
           activity_id,verification_id,evidence_id,guardian_policy_id,methodology_code,
           snapshot_version,source_revision,source_digest,source_payload,supersedes_snapshot_id,correction_reason,created_by_identity_id
         ) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12) returning *`,
        [input.activityId,input.verificationId,input.evidenceId,input.guardianPolicyId,input.methodologyCode ?? null,
         version,activity.mrv_source_revision,digest,JSON.stringify(payload),latest?.id ?? null,latest ? correctionReason : null,input.auth.identityId],
      );
      const insertedSnapshot = inserted.rows[0];
      if (!insertedSnapshot) throw new Error("MRV source snapshot insert returned no row");
      snapshot = insertedSnapshot;
    }
    await client.query("commit");
    transactionOpen = false;
    const latestMeasurement = measurementsResult.rows.at(-1);
    return {
      snapshot,
      observations: observationsResult.rows.map(({ snapshot_record_json, ...row }) => ({ ...row, sourceRecordJson: snapshot_record_json })),
      measurements: measurementsResult.rows.map(({ snapshot_record_json, ...row }) => ({ ...row, sourceRecordJson: snapshot_record_json })),
      evidence: evidenceResult.rows.map(({ evidence_snapshot_record_json, artifact_version_snapshot_record_json, artifact_series_snapshot_record_json, reviews_snapshot_records_json, ...row }) => ({ ...row, sourceRecordJson: evidence_snapshot_record_json, artifactVersionRecordJson: artifact_version_snapshot_record_json, artifactSeriesRecordJson: artifact_series_snapshot_record_json, reviewRecordsJson: reviews_snapshot_records_json })),
      artifactSeries: artifactSeriesResult.rows.map(row => ({ sourceRecordJson: row.record_json })),
      latestQuantity: latestMeasurement ? Number(latestMeasurement.value) : undefined,
      latestUnit: latestMeasurement?.unit,
      organizationId: activity.organization_id,
    };
  } catch (error) {
    if (transactionOpen) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    if (lockAcquired) await client.query("select pg_advisory_unlock(hashtext($1))", [snapshotLockKey]).catch(() => undefined);
    client.release();
  }
}
