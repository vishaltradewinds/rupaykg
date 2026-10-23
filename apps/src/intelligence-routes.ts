import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { canActForOrganization } from "./auth.js";
import { persistEvidenceArtifact } from "./evidence-vault-store.js";
import { validateWasteLogExtraction } from "./intelligence-evidence-intake.js";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";

function orgIds(auth: AuthContext): string[] {
  return auth.activeOrganizationId ? [auth.activeOrganizationId] : [...new Set(auth.memberships.map((m) => m.organization_id))];
}

function requestedGeography(request: { query: unknown }): string | null {
  const q = request.query && typeof request.query === "object" ? request.query as Record<string, unknown> : {};
  return typeof q.geographyId === "string" && q.geographyId.trim() ? q.geographyId.trim() : null;
}

export type WasteLogExtractionProvider = {
  providerId: string;
  modelId: string;
  promptVersion: string;
  extract(input: { rawLog: string; activityId: string }): Promise<unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LOG_BYTES = 1024 * 1024;

/** Atomic cross-instance fixed-window limiter; returns false once 10 attempts are consumed. */
export async function consumeAiIntakeRateLimit(pool: Pool, identityId: string, organizationId: string): Promise<boolean> {
  const result = await pool.query<{ request_count: number }>(
    `with cleanup as (
       delete from ai_intake_rate_limits
        where window_start < clock_timestamp() - interval '48 hours'
     )
     insert into ai_intake_rate_limits (identity_id, organization_id, window_start, request_count)
     values ($1, $2, date_trunc('minute', clock_timestamp()), 1)
     on conflict (identity_id, organization_id, window_start)
     do update set request_count = ai_intake_rate_limits.request_count + 1
     where ai_intake_rate_limits.request_count < 10
     returning request_count`,
    [identityId, organizationId],
  );
  return result.rows.length === 1;
}

export async function registerIntelligenceRoutes(
  app: FastifyInstance,
  pool: Pool | null,
  extractionProvider?: WasteLogExtractionProvider,
): Promise<void> {
  app.post("/api/v1/intelligence/evidence-intake", { bodyLimit: 1400 * 1024 }, async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); }
    catch (error) { request.log.error({ errorType: error instanceof Error ? error.name : "unknown" }, "Intelligence intake authentication failed"); return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); }
    if (!auth) return reply.code(401).send(bearerChallenge());

    const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
      ? request.body as Record<string, unknown> : {};
    const activityId = typeof body.activityId === "string" ? body.activityId.trim() : "";
    const rawLog = typeof body.rawLog === "string" ? body.rawLog : "";
    const sourceReference = typeof body.sourceReference === "string" && body.sourceReference.trim()
      ? body.sourceReference.trim().slice(0, 500) : null;
    if (!UUID.test(activityId) || !rawLog.trim()) {
      return reply.code(400).send({ error: "Valid activityId and non-empty rawLog are required", code: "AI_INTAKE_FIELDS_REQUIRED" });
    }
    if (rawLog.includes("\u0000") || rawLog.includes("\ufffd")) return reply.code(400).send({ error: "rawLog must be valid text without NUL or replacement characters", code: "AI_INTAKE_SOURCE_INVALID_TEXT" });
    if (Buffer.byteLength(rawLog, "utf8") > MAX_LOG_BYTES) {
      return reply.code(413).send({ error: "rawLog exceeds 1 MiB", code: "AI_INTAKE_SOURCE_TOO_LARGE" });
    }

    try {
      const activity = await pool.query<{ organization_id: string; geography_id: string | null }>(
        "select organization_id, geography_id from activities where id=$1", [activityId],
      );
      const row = activity.rows[0];
      if (!row || !row.geography_id || !canActForOrganization(auth, row.organization_id)) {
        return reply.code(403).send({ error: "Activity outside active organization scope", code: "AI_INTAKE_SCOPE_FORBIDDEN" });
      }
      const geography = await pool.query<{ ok: boolean }>(
        "select organization_has_explicit_geography_scope($1::uuid,$2::uuid) as ok", [row.organization_id, row.geography_id],
      );
      if (!geography.rows[0]?.ok) return reply.code(403).send({ error: "Activity geography outside authorized scope", code: "AI_INTAKE_GEOGRAPHY_FORBIDDEN" });
      if (!await hasOrganizationPermission(pool, auth, row.organization_id, ["evidence:upload"])) {
        return reply.code(403).send({ error: "Evidence upload permission required", code: "EVIDENCE_UPLOAD_FORBIDDEN" });
      }

      const idempotencyKey = request.headers["idempotency-key"];
      if (typeof idempotencyKey !== "string" || !idempotencyKey.trim() || idempotencyKey.length > 200 || /[\r\n\u0000]/.test(idempotencyKey)) {
        return reply.code(400).send({ error: "A valid Idempotency-Key header (1-200 characters) is required", code: "AI_INTAKE_IDEMPOTENCY_KEY_REQUIRED" });
      }
      const requestSha256 = createHash("sha256").update(JSON.stringify({ activityId, rawLog, sourceReference })).digest("hex");
      const jobIdentity = auth.identityId;
      const jobOrganization = row.organization_id;
      const insertJob = await pool.query<{ id: string; lease_token: string }>(
        `insert into ai_evidence_intake_jobs(identity_id,organization_id,idempotency_key,request_sha256)
         values($1,$2,$3,$4) on conflict(identity_id,organization_id,idempotency_key) do nothing
         returning id, lease_token`,
        [jobIdentity, jobOrganization, idempotencyKey, requestSha256],
      );
      const createdJob = Boolean(insertJob.rows[0]);
      let jobId = insertJob.rows[0]?.id;
      let leaseToken = insertJob.rows[0]?.lease_token;
      let existingSourceId: string | null = null;
      if (!jobId) {
        const existing = await pool.query<{
          id: string; request_sha256: string; status: string; source_evidence_id: string | null;
          response_json: unknown; lease_expires_at: Date | string; lease_token: string;
        }>(
          `select id, request_sha256, status, source_evidence_id, response_json, lease_expires_at, lease_token
             from ai_evidence_intake_jobs
            where identity_id=$1 and organization_id=$2 and idempotency_key=$3`,
          [jobIdentity, jobOrganization, idempotencyKey],
        );
        const prior = existing.rows[0];
        if (!prior) return reply.code(503).send({ error: "Idempotency ledger unavailable", code: "AI_INTAKE_IDEMPOTENCY_UNAVAILABLE" });
        if (prior.request_sha256 !== requestSha256) {
          return reply.code(409).send({ error: "Idempotency-Key was already used for different request content", code: "AI_INTAKE_IDEMPOTENCY_CONFLICT" });
        }
        if (prior.status === "COMPLETED" && prior.response_json && typeof prior.response_json === "object") {
          return reply.code(200).send({ ...(prior.response_json as Record<string, unknown>), idempotentReplay: true });
        }
        const takeover = await pool.query<{ id: string; lease_token: string; source_evidence_id: string | null }>(
          `update ai_evidence_intake_jobs
              set status='PROCESSING', attempt_count=least(attempt_count+1,100),
                  lease_token=$3::uuid, lease_expires_at=now()+interval '5 minutes',
                  updated_at=now(), last_error_code=null
            where id=$1 and request_sha256=$2
              and (status='RETRYABLE_FAILED' or (status='PROCESSING' and lease_expires_at < now()))
            returning id, lease_token, source_evidence_id`,
          [prior.id, requestSha256, randomUUID()],
        );
        if (!takeover.rows[0]) {
          return reply.code(202).send({ jobId: prior.id, status: "PROCESSING", retryAfterSeconds: 5, authoritativeMutation: false });
        }
        jobId = takeover.rows[0].id;
        leaseToken = takeover.rows[0].lease_token;
        existingSourceId = takeover.rows[0].source_evidence_id;
      }

      const markRetryable = async (errorCode: string) => {
        if (!jobId || !leaseToken) return;
        await pool.query(
          `update ai_evidence_intake_jobs set status='RETRYABLE_FAILED', last_error_code=$3,
             lease_expires_at=now(), updated_at=now()
            where id=$1 and lease_token=$2::uuid and status='PROCESSING'`,
          [jobId, leaseToken, errorCode],
        );
      };

      // Database-backed fixed-window limit is shared across API instances. Count attempts before
      // evidence persistence/provider calls so clients cannot bypass the limit by retrying failures.
      const allowed = await consumeAiIntakeRateLimit(pool, auth.identityId, row.organization_id);
      if (!allowed) {
        if (createdJob && jobId && leaseToken) {
          // Do not let rate-limited requests fill the durable job ledger with empty rows.
          await pool.query(
            `delete from ai_evidence_intake_jobs
              where id=$1 and lease_token=$2::uuid and status='PROCESSING'
                and source_evidence_id is null`,
            [jobId, leaseToken],
          );
        } else {
          await markRetryable("AI_INTAKE_RATE_LIMITED");
        }
        return reply.code(429).send({
          error: "Evidence intake rate limit exceeded; retry after the current minute window",
          code: "AI_INTAKE_RATE_LIMITED",
          retryAfterSeconds: 60,
          authoritativeMutation: false,
        });
      }

      // Preserve the original log first. Model output is never a replacement for source evidence.
      let source: Awaited<ReturnType<typeof persistEvidenceArtifact>>;
      if (existingSourceId) {
        const stored = await pool.query<{ evidence_id: string; artifact_version_id: string; series_id: string; version_number: number; sha256: string; size_bytes: number }>(
          `select e.id evidence_id, v.id artifact_version_id, v.series_id, v.version_number, v.sha256, v.size_bytes
             from evidence e join evidence_artifact_versions v on v.evidence_id=e.id
            where e.id=$1 and e.activity_id=$2 and e.evidence_type='AI_SOURCE_LOG'
            order by v.version_number desc limit 1`,
          [existingSourceId, activityId],
        );
        const s = stored.rows[0];
        if (!s) {
          await markRetryable("AI_INTAKE_SOURCE_RECOVERY_FAILED");
          return reply.code(503).send({ error: "Previously captured source evidence could not be recovered", code: "AI_INTAKE_SOURCE_RECOVERY_FAILED", authoritativeMutation: false });
        }
        source = { evidenceId: s.evidence_id, artifactVersionId: s.artifact_version_id, seriesId: s.series_id, versionNumber: Number(s.version_number), sha256: s.sha256, sizeBytes: Number(s.size_bytes) };
      } else {
        const sourceClient = await pool.connect();
        try {
          await sourceClient.query("begin");
          source = await persistEvidenceArtifact({
            client: sourceClient, activityId, organizationId: row.organization_id, identityId: auth.identityId,
            evidenceType: "AI_SOURCE_LOG", fileName: "source-log.txt", mediaType: "text/plain",
            bytes: Buffer.from(rawLog, "utf8"), sourceReference,
            metadata: { intakeType: "AI_ASSISTED_UNSTRUCTURED_LOG", trustLevel: "UNTRUSTED_SOURCE", extractionStatus: "NOT_STARTED" },
          });
          const linked = await sourceClient.query(
            `update ai_evidence_intake_jobs set source_evidence_id=$3, updated_at=now()
              where id=$1 and lease_token=$2::uuid and status='PROCESSING'`,
            [jobId, leaseToken, source.evidenceId],
          );
          if (linked.rowCount !== 1) throw new Error("AI intake job lease lost before source commit");
          await sourceClient.query("commit");
        } catch (error) {
          await sourceClient.query("rollback").catch(() => undefined);
          await markRetryable("EVIDENCE_VAULT_UNAVAILABLE");
          request.log.error({ errorType: error instanceof Error ? error.name : "unknown" }, "AI intake source evidence persistence failed");
          return reply.code(503).send({ error: "Source evidence could not be stored", code: "EVIDENCE_VAULT_UNAVAILABLE" });
        } finally { sourceClient.release(); }
      }

      if (!extractionProvider) {
        await markRetryable("AI_PROVIDER_NOT_CONFIGURED");
        return reply.code(503).send({
          error: "Source log captured; no extraction provider is configured",
          code: "AI_PROVIDER_NOT_CONFIGURED",
          sourceEvidenceId: source.evidenceId,
          extractionStatus: "NOT_STARTED",
          authoritativeMutation: false,
        });
      }

      let untrustedOutput: unknown;
      try {
        untrustedOutput = await extractionProvider.extract({ rawLog, activityId });
      } catch (error) {
        await markRetryable("AI_EXTRACTION_FAILED");
        request.log.error({ providerId: extractionProvider.providerId, errorType: error instanceof Error ? error.name : "unknown" }, "AI extraction provider failed");
        return reply.code(502).send({
          error: "Source log captured, but extraction failed",
          code: "AI_EXTRACTION_FAILED",
          sourceEvidenceId: source.evidenceId,
          extractionStatus: "FAILED",
          authoritativeMutation: false,
        });
      }
      const extraction = validateWasteLogExtraction(untrustedOutput);
      if (!extraction) {
        await markRetryable("AI_EXTRACTION_SCHEMA_INVALID");
        return reply.code(422).send({
          error: "Source log captured; model output failed strict schema validation",
          code: "AI_EXTRACTION_SCHEMA_INVALID",
          sourceEvidenceId: source.evidenceId,
          extractionStatus: "REJECTED_SCHEMA",
          authoritativeMutation: false,
        });
      }

      const proposalClient = await pool.connect();
      try {
        await proposalClient.query("begin");
        const proposal = await persistEvidenceArtifact({
          client: proposalClient, activityId, organizationId: row.organization_id, identityId: auth.identityId,
          evidenceType: "AI_EXTRACTION_PROPOSAL", fileName: "extraction-proposal.json", mediaType: "application/json",
          bytes: Buffer.from(JSON.stringify(extraction), "utf8"), sourceReference,
          metadata: {
            intakeType: "AI_ASSISTED_UNSTRUCTURED_LOG",
            trustLevel: "UNVERIFIED_MODEL_OUTPUT",
            sourceEvidenceId: source.evidenceId,
            providerId: extractionProvider.providerId,
            modelId: extractionProvider.modelId,
            promptVersion: extractionProvider.promptVersion,
            validationStatus: extraction.validationStatus,
            reviewStatus: "PENDING_HUMAN_REVIEW",
          },
        });
        const responseBody = {
          jobId,
          source: "postgresql", syntheticData: false,
          data: {
            sourceEvidenceId: source.evidenceId,
            proposalEvidenceId: proposal.evidenceId,
            proposalArtifactVersionId: proposal.artifactVersionId,
            sourceSha256: source.sha256,
            proposalSha256: proposal.sha256,
            extraction,
            reviewStatus: "PENDING_HUMAN_REVIEW",
            authoritativeMutation: false,
            guardianSubmission: false,
            carbonCreditCreated: false,
          },
        };
        const completed = await proposalClient.query(
          `update ai_evidence_intake_jobs
              set status='COMPLETED', proposal_evidence_id=$3, response_json=$4::jsonb,
                  completed_at=now(), updated_at=now(), lease_expires_at=now(), last_error_code=null
            where id=$1 and lease_token=$2::uuid and status='PROCESSING'`,
          [jobId, leaseToken, proposal.evidenceId, JSON.stringify(responseBody)],
        );
        if (completed.rowCount !== 1) throw new Error("AI intake job lease lost before completion");
        await proposalClient.query("commit");
        return reply.code(201).send(responseBody);
      } catch (error) {
        await proposalClient.query("rollback").catch(() => undefined);
        await markRetryable("EVIDENCE_VAULT_UNAVAILABLE");
        request.log.error({ errorType: error instanceof Error ? error.name : "unknown" }, "AI intake proposal persistence failed");
        return reply.code(503).send({
          error: "Source log captured, but extraction proposal could not be stored",
          code: "EVIDENCE_VAULT_UNAVAILABLE",
          sourceEvidenceId: source.evidenceId,
          authoritativeMutation: false,
        });
      } finally { proposalClient.release(); }
    } catch (error) {
      request.log.error({ errorType: error instanceof Error ? error.name : "unknown" }, "AI evidence intake failed");
      return reply.code(503).send({ error: "AI evidence intake unavailable", code: "AI_INTAKE_UNAVAILABLE", syntheticData: false });
    }
  });
  app.get("/api/v1/workspaces/intelligence", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try { auth = await authenticate(request, pool); } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false }); }
    if (!auth) return reply.code(401).send(bearerChallenge());
    const ids = orgIds(auth);
    if (!ids.length) return { source: "postgresql", syntheticData: false, findings: [] };
    for (const organizationId of ids) {
      if (!await hasOrganizationPermission(pool, auth, organizationId, ["audit:read", "projects:manage"])) {
        return reply.code(403).send({ error: "Intelligence workspace read permission required", code: "WORKSPACE_READ_FORBIDDEN", workspace: "intelligence" });
      }
    }
    const geographyId = requestedGeography(request);
    if (geographyId) {
      const scope = await pool.query<{ ok: boolean }>(
        `select exists (
           select 1 from organization_memberships om
            where om.identity_id=$1 and om.status='VERIFIED'
              and ($3::uuid is null or om.organization_id=$3::uuid)
              and organization_has_explicit_geography_scope(om.organization_id,$2)
         ) as ok`,
        [auth.identityId, geographyId, auth.activeOrganizationId ?? null],
      );
      if (!scope.rows[0]?.ok) return reply.code(403).send({ error: "Geography outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
    }
    try {
      const params: unknown[] = [ids];
      const geographyClause = geographyId ? " and a.geography_id = $2" : "";
      if (geographyId) params.push(geographyId);
      const rows = await pool.query(`
        select a.id as source_record_id, 'ACTIVITY' as source_type,
               a.activity_type, a.status, a.geography_id, g.name as geography_name,
               a.occurred_at, a.created_at
        from activities a
        left join geography g on g.id = a.geography_id
        where a.organization_id = any($1::uuid[])
          and organization_has_explicit_geography_scope(a.organization_id, a.geography_id)
          ${geographyClause}
        order by a.created_at desc limit 100`, params);
      const findings = rows.rows.map((row) => ({
        kind: "OPERATIONAL_REVIEW",
        sourceRecordIds: [row.source_record_id],
        sourceType: row.source_type,
        title: `Review ${row.activity_type}`,
        status: row.status,
        geographyId: row.geography_id,
        geographyName: row.geography_name,
        occurredAt: row.occurred_at,
        action: "REVIEW",
        authoritativeMutation: false,
      }));
      return { source: "postgresql", syntheticData: false, advisory: true, findings };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Intelligence workspace unavailable", syntheticData: false }); }
  });
}
