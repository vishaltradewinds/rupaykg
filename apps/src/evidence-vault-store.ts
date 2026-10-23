import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

export type PersistEvidenceArtifactInput = {
  client: PoolClient;
  activityId: string;
  organizationId: string;
  identityId: string;
  evidenceType: string;
  fileName: string;
  mediaType: string;
  bytes: Buffer;
  sourceReference?: string | null;
  measurementPeriodStart?: string | null;
  measurementPeriodEnd?: string | null;
  seriesId?: string | null;
  metadata?: Record<string, unknown>;
};

export type PersistedEvidenceArtifact = {
  seriesId: string;
  evidenceId: string;
  artifactVersionId: string;
  versionNumber: number;
  sha256: string;
  sizeBytes: number;
};

/**
 * Shared evidence-vault persistence primitive.
 * Callers must authenticate, authorize organization/geography scope, validate
 * payload bytes/media type, and wrap this operation in a transaction.
 * This stores evidence only; it never creates measurements or approves claims.
 */
export async function persistEvidenceArtifact(input: PersistEvidenceArtifactInput): Promise<PersistedEvidenceArtifact> {
  if (!input.bytes.length || input.bytes.length > 5 * 1024 * 1024) throw new Error("Evidence payload size is invalid");
  if (!input.evidenceType.trim() || input.evidenceType.length > 100) throw new Error("Evidence type is invalid");
  if (!input.fileName.trim() || input.fileName.length > 180) throw new Error("Evidence filename is invalid");

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  let series: { id: string; evidence_type: string } | undefined;

  if (input.seriesId) {
    await input.client.query("select pg_advisory_xact_lock(hashtext($1))", [input.seriesId]);
    const result = await input.client.query<{ id: string; evidence_type: string }>(
      "select id,evidence_type from evidence_artifact_series where id=$1 and organization_id=$2 and activity_id=$3 for update",
      [input.seriesId, input.organizationId, input.activityId],
    );
    series = result.rows[0];
    if (!series || series.evidence_type !== input.evidenceType) {
      throw Object.assign(new Error("Evidence series must match organization, activity and evidence type"), { code: "EVIDENCE_SERIES_SCOPE_MISMATCH" });
    }
  } else {
    const result = await input.client.query<{ id: string; evidence_type: string }>(
      "insert into evidence_artifact_series(organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,$3,$4) returning id,evidence_type",
      [input.organizationId, input.activityId, input.evidenceType, input.identityId],
    );
    series = result.rows[0];
  }
  if (!series) throw new Error("Evidence series creation failed");

  const versionResult = await input.client.query<{ n: number }>(
    "select coalesce(max(version_number),0)+1 n from evidence_artifact_versions where series_id=$1",
    [series.id],
  );
  const versionNumber = Number(versionResult.rows[0]?.n ?? 1);
  const metadata = {
    ...(input.metadata ?? {}),
    fileName: input.fileName,
    mediaType: input.mediaType,
    byteLength: input.bytes.length,
    seriesId: series.id,
    versionNumber,
    sourceReference: input.sourceReference ?? null,
  };

  const evidenceResult = await input.client.query<{ id: string }>(
    "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash,metadata) values($1,$2,'CAPTURED',now(),'db://evidence-vault/pending',$3,$4::jsonb) returning id",
    [input.activityId, input.evidenceType, sha256, JSON.stringify(metadata)],
  );
  const evidenceId = evidenceResult.rows[0]?.id;
  if (!evidenceId) throw new Error("Evidence row creation failed");

  const artifactResult = await input.client.query<{ id: string }>(
    "insert into evidence_artifact_versions(series_id,evidence_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id,source_reference,measurement_period_start,measurement_period_end) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id",
    [
      series.id, evidenceId, versionNumber, input.fileName, input.mediaType, input.bytes.length, sha256, input.bytes,
      input.identityId, input.sourceReference ?? null, input.measurementPeriodStart ?? null, input.measurementPeriodEnd ?? null,
    ],
  );
  const artifactVersionId = artifactResult.rows[0]?.id;
  if (!artifactVersionId) throw new Error("Evidence artifact version creation failed");

  await input.client.query("update evidence set content_uri=$2 where id=$1", [evidenceId, "db://evidence-vault/" + artifactVersionId]);
  return { seriesId: series.id, evidenceId, artifactVersionId, versionNumber, sha256, sizeBytes: input.bytes.length };
}
