import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

export type MrvSourceSnapshot = {
  id: string;
  activity_id: string;
  verification_id: string;
  evidence_id: string;
  snapshot_version: number;
  source_digest: string;
  source_payload: Record<string, unknown>;
  supersedes_snapshot_id: string | null;
  correction_reason: string | null;
  created_at: Date | string;
};

export type MrvSnapshotCapture = {
  snapshot: MrvSourceSnapshot;
  observations: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
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

function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).filter(key => object[key] !== undefined).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

export function mrvSourceDigest(payload: unknown): string {
  return createHash("sha256").update(canonical(payload)).digest("hex");
}

type ActivityRow = {
  id: string; organization_id: string; geography_id: string | null; activity_type: string;
  status: string; occurred_at: Date | string | null; completed_at: Date | string | null; metadata: Record<string, unknown>;
};
type VerificationRow = {
  id: string; evidence_id: string; decision: string; scope: string; rationale: string | null; decided_at: Date | string;
};
type EvidenceRow = Record<string, unknown> & { id: string; status: string };
type MeasurementRow = Record<string, unknown> & { value: string | number; unit: string };

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
  try {
    await client.query("begin isolation level repeatable read");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`mrv-source:${input.activityId}`]);

    const activityResult = await client.query<ActivityRow>(
      "select id,organization_id,geography_id,activity_type,status::text,occurred_at,completed_at,metadata from activities where id=$1 for share",
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
      "select id,evidence_id,decision::text,scope,rationale,decided_at from verifications where id=$1 and activity_id=$2 for share",
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

    const observationsResult = await client.query<Record<string, unknown>>(
      "select id,parameter_code,observed_value::text observed_value,unit,method,instrument_id,observed_at,uncertainty::text uncertainty,quality_status::text quality_status,metadata from mrv_observations where activity_id=$1 order by observed_at,id",
      [input.activityId],
    );
    const measurementsResult = await client.query<MeasurementRow>(
      "select id,value::text value,unit,method,source,measured_at,quality_status::text quality_status,metadata from measurements where activity_id=$1 order by measured_at,id",
      [input.activityId],
    );
    const evidenceResult = await client.query<EvidenceRow>(
      `select e.id,e.activity_id,e.measurement_id,e.evidence_type,e.status::text status,e.captured_at,
              e.content_uri,e.content_hash,e.metadata,
              v.id artifact_version_id,v.version_number artifact_version_number,v.sha256 artifact_sha256,
              v.size_bytes artifact_size_bytes,v.media_type artifact_media_type,
              coalesce((select jsonb_agg(jsonb_build_object(
                'id',r.id,'artifactVersionId',r.artifact_version_id,'reviewerIdentityId',r.reviewer_identity_id,
                'decision',r.decision,'rationale',r.rationale,'createdAt',r.created_at
              ) order by r.created_at,r.id) from evidence_artifact_reviews r where r.evidence_id=e.id),'[]'::jsonb) reviews
         from evidence e
         left join evidence_artifact_versions v on v.evidence_id=e.id
        where e.activity_id=$1 order by e.captured_at,e.id`,
      [input.activityId],
    );

    const payload = {
      schema: "rupaykg:mrv-source-snapshot:v1",
      activity: {
        id: activity.id, organizationId: activity.organization_id, geographyId: activity.geography_id,
        activityType: activity.activity_type, status: activity.status, occurredAt: activity.occurred_at,
        completedAt: activity.completed_at, metadata: activity.metadata,
      },
      verification: {
        id: verification.id, evidenceId: verification.evidence_id, decision: verification.decision,
        scope: verification.scope, rationale: verification.rationale, decidedAt: verification.decided_at,
      },
      selectedEvidenceId: input.evidenceId,
      guardianPolicyId: input.guardianPolicyId,
      methodologyCode: input.methodologyCode ?? null,
      observations: observationsResult.rows,
      measurements: measurementsResult.rows,
      evidence: evidenceResult.rows,
    };
    const digest = mrvSourceDigest(payload);
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
           snapshot_version,source_digest,source_payload,supersedes_snapshot_id,correction_reason,created_by_identity_id
         ) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11) returning *`,
        [input.activityId,input.verificationId,input.evidenceId,input.guardianPolicyId,input.methodologyCode ?? null,
         version,digest,JSON.stringify(payload),latest?.id ?? null,latest ? correctionReason : null,input.auth.identityId],
      );
      snapshot = inserted.rows[0];
      if (!snapshot) throw new Error("MRV source snapshot insert returned no row");
    }
    await client.query("commit");
    const latestMeasurement = measurementsResult.rows.at(-1);
    return {
      snapshot,
      observations: observationsResult.rows,
      evidence: evidenceResult.rows,
      latestQuantity: latestMeasurement ? Number(latestMeasurement.value) : undefined,
      latestUnit: latestMeasurement?.unit,
      organizationId: activity.organization_id,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
