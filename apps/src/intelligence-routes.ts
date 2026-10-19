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
        "select organization_has_geography_scope($1::uuid,$2::uuid) as ok", [row.organization_id, row.geography_id],
      );
      if (!geography.rows[0]?.ok) return reply.code(403).send({ error: "Activity geography outside authorized scope", code: "AI_INTAKE_GEOGRAPHY_FORBIDDEN" });
      if (!await hasOrganizationPermission(pool, auth, row.organization_id, ["evidence:upload"])) {
        return reply.code(403).send({ error: "Evidence upload permission required", code: "EVIDENCE_UPLOAD_FORBIDDEN" });
      }

      // Preserve the original log first. Model output is never a replacement for source evidence.
      const sourceClient = await pool.connect();
      let source: Awaited<ReturnType<typeof persistEvidenceArtifact>>;
      try {
        await sourceClient.query("begin");
        source = await persistEvidenceArtifact({
          client: sourceClient, activityId, organizationId: row.organization_id, identityId: auth.identityId,
          evidenceType: "AI_SOURCE_LOG", fileName: "source-log.txt", mediaType: "text/plain",
          bytes: Buffer.from(rawLog, "utf8"), sourceReference,
          metadata: { intakeType: "AI_ASSISTED_UNSTRUCTURED_LOG", trustLevel: "UNTRUSTED_SOURCE", extractionStatus: "NOT_STARTED" },
        });
        await sourceClient.query("commit");
      } catch (error) {
        await sourceClient.query("rollback").catch(() => undefined);
        request.log.error({ errorType: error instanceof Error ? error.name : "unknown" }, "AI intake source evidence persistence failed");
        return reply.code(503).send({ error: "Source evidence could not be stored", code: "EVIDENCE_VAULT_UNAVAILABLE" });
      } finally { sourceClient.release(); }

      if (!extractionProvider) {
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
        await proposalClient.query("commit");
        return reply.code(201).send({
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
        });
      } catch (error) {
        await proposalClient.query("rollback").catch(() => undefined);
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
              and organization_has_geography_scope(om.organization_id,$2)
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
          and organization_has_geography_scope(a.organization_id, a.geography_id)
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
