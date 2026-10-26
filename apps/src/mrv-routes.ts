import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { executeGuardianMrv, guardianStatus } from "./guardian-mrv.js";
import { explicitAnchorQuantity, hederaStatus, integrityHash, submitHcsAnchor, verifyHcsMessage } from "./hedera-anchor.js";
import { registerStatutoryRoutes } from "./statutory-routes.js";
import { instrumentApprovalFailure, instrumentParameterFailure, type MrvInstrumentApprovalEvidence, type MrvInstrumentParameterSpec } from "./mrv-instrument-approval.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void } };
type ExistingProvenanceRow = { activity_id: string; verification_id: string; evidence_id: string; guardian_policy_id: string; guardian_execution_id: string | null; guardian_status: string; hcs_status: string; hcs_topic_id: string | null; hcs_transaction_id: string | null; hcs_consensus_timestamp: string | null; mirror_node_verified_at: Date | string | null; integrity_hash: string; [key: string]: unknown };
const bodyOf = (r: Request): Record<string, unknown> => r.body && typeof r.body === "object" ? r.body as Record<string, unknown> : {};
const str = (b: Record<string, unknown>, k: string): string | null => typeof b[k] === "string" && b[k].trim() ? b[k].trim() : null;

export function normalizeMrvActivityId(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

function canonicalizeObservationValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeObservationValue);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalizeObservationValue(record[key])]));
  }
  return value;
}

export function mrvObservationSetHash(rows: Array<Record<string, unknown>>): string {
  const observationSet = rows.map((o) => ({
    id: String(o.id ?? ""),
    parameterCode: String(o.parameter_code ?? ""),
    value: String(o.observed_value ?? ""),
    unit: String(o.unit ?? ""),
    method: String(o.method ?? ""),
    instrumentId: String(o.instrument_id ?? ""),
    observedAt: o.observed_at == null ? "" : new Date(o.observed_at as string | number | Date).toISOString(),
    uncertainty: o.uncertainty == null ? null : String(o.uncertainty),
    qualityStatus: String(o.quality_status ?? ""),
    metadata: canonicalizeObservationValue(o.metadata ?? null),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify(observationSet)).digest("hex");
}

async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" }); return null; }
  try { const auth = await authenticate(request as never, pool); if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; } return auth; }
  catch (error) { request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); return null; }
}

async function requirePermission(pool: Pool, auth: AuthContext, organizationId: string, permissions: readonly string[]): Promise<boolean> {
  return hasOrganizationPermission(pool, auth, organizationId, permissions);
}

async function activityInAuthorizedGeography(pool: Pool, auth: AuthContext, activityId: string, organizationId: string): Promise<boolean> {
  const result = await pool.query<{ ok: boolean }>(
    `select exists(
       select 1 from activities a
       where a.id=$1 and a.organization_id=$2 and a.geography_id is not null
         and organization_has_geography_scope(a.organization_id,a.geography_id)
     ) as ok`,
    [activityId, organizationId],
  );
  if (result.rows[0]?.ok !== true) return false;
  const membership = await pool.query<{ ok: boolean }>(
    `select exists(
       select 1 from organization_memberships om
       join activities a on a.organization_id=om.organization_id
       where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED'
         and a.id=$3 and a.geography_id is not null
         and organization_has_geography_scope(om.organization_id,a.geography_id)
     ) as ok`,
    [auth.identityId, organizationId, activityId],
  );
  return membership.rows[0]?.ok === true;
}

/**
 * Acceptance fixtures may exercise the real external trust rail, but they are
 * never evidence of a real carbon project and must not be presented as registry eligible.
 */
async function isAcceptanceFixture(pool: Pool, activityId: string): Promise<boolean> {
  const result = await pool.query<{ is_fixture: boolean }>(
    `select
       exists(select 1 from activities a where a.id=$1 and a.metadata->>'acceptanceFixture'='true')
       or exists(select 1 from evidence e where e.activity_id=$1 and e.metadata->>'acceptanceFixture'='true')
       as is_fixture`,
    [activityId],
  );
  return result.rows[0]?.is_fixture === true;
}

export async function registerMrvRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/mrv/status", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const organizationId = auth.activeOrganizationId || auth.memberships[0]?.organization_id;
    if (!organizationId || !await requirePermission(pool, auth, organizationId, ["guardian:read"])) return reply.code(403).send({ error: "Guardian read permission required", code: "MRV_PERMISSION_REQUIRED" });
    const guardian = guardianStatus();
    const hedera = hederaStatus();
    return {
      source: "runtime",
      syntheticData: false,
      guardian,
      hedera,
      registryEligibility: "REQUIRES_GUARDIAN_VERIFIED_AND_HCS_CONSENSUS_CONFIRMED_PROVENANCE",
    };
  });

  app.post("/api/v1/mrv/activities/:activityId/submit", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const rawActivityId = (request.params as { activityId: string }).activityId;
    const activityId = normalizeMrvActivityId(rawActivityId);
    if (!activityId) return reply.code(400).send({ error: "Valid activityId UUID is required", code: "MRV_ACTIVITY_ID_INVALID" });
    // Normalize UUID casing so equivalent PostgreSQL UUID spellings share one advisory lock.
    const body = bodyOf(request as never);
    const verificationId = str(body, "verificationId");
    const evidenceId = str(body, "evidenceId");
    const policyId = str(body, "guardianPolicyId") || process.env.GUARDIAN_MRV_POLICY_ID || null;
    const methodologyCode = str(body, "methodologyCode") || undefined;
    if (!verificationId || !evidenceId || !policyId) return reply.code(400).send({ error: "verificationId, evidenceId and guardianPolicyId (or GUARDIAN_MRV_POLICY_ID) are required" });
    let lockClient: PoolClient | null = null;
    let lockAcquired = false;
    const idempotencyLockKey = `rupaykg:mrv-activity:${activityId}`;
    try {
      lockClient = await pool.connect();
      await lockClient.query("select pg_advisory_lock(hashtext($1))", [idempotencyLockKey]);
      lockAcquired = true;
      const context = await pool.query<{ organization_id: string; activity_status: string; decision: string; evidence_status: string; evidence_activity_id: string | null; evidence_count: string; observation_count: string }>(
        `select a.organization_id, a.status activity_status, v.decision, e.status evidence_status, e.activity_id evidence_activity_id,
                (select count(*)::text from evidence e2 where e2.activity_id=a.id) evidence_count,
                ((select count(*) from mrv_observations mo where mo.activity_id=a.id) + (select count(*) from measurements mm where mm.activity_id=a.id and mm.mrv_instrument_id is not null and mm.parameter_code is not null and not exists (select 1 from mrv_observations mo where mo.activity_id=mm.activity_id and mo.measurement_id=mm.id)))::text observation_count
           from activities a join verifications v on v.id=$2 and v.activity_id=a.id join evidence e on e.id=$3 and e.activity_id=a.id where a.id=$1`,
        [activityId, verificationId, evidenceId]);
      const row = context.rows[0];
      if (!row) return reply.code(409).send({ error: "Activity, verification and evidence must be bound to the same activity", code: "MRV_BINDING_INVALID" });
      if (!canActForOrganization(auth, row.organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await requirePermission(pool, auth, row.organization_id, ["guardian:operate"])) return reply.code(403).send({ error: "Guardian MRV operation permission required", code: "MRV_PERMISSION_REQUIRED" });
      if (!await activityInAuthorizedGeography(pool, auth, activityId, row.organization_id)) return reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
      if (row.activity_status !== "COMPLETED" || row.decision !== "APPROVED" || row.evidence_status !== "VERIFIED" || row.evidence_activity_id !== activityId) return reply.code(409).send({ error: "Completed activity, approved verification and VERIFIED evidence are required before Guardian MRV", code: "MRV_PRECONDITION_FAILED" });

      const observations = await pool.query("select id, parameter_code, observed_value, unit, method, instrument_id, observed_at, uncertainty, quality_status, metadata from mrv_observations where activity_id=$1 order by observed_at", [activityId]);
      // Direct and offline field-sync MEASUREMENT_CREATE persist to measurements.
      // Include only readings with an explicit instrument+parameter binding; never infer
      // a physical source from legacy free-text source fields.
      const instrumentMeasurements = await pool.query(
        `select m.id, m.parameter_code, m.value::text as observed_value, m.unit, m.method,
                i.instrument_code as instrument_id, m.measured_at as observed_at,
                null::numeric as uncertainty, null::text as quality_status, m.metadata
           from measurements m
           join mrv_instruments i on i.id = m.mrv_instrument_id
          where m.activity_id=$1 and m.mrv_instrument_id is not null
            and m.parameter_code is not null
            and not exists (
              select 1 from mrv_observations mo
               where mo.activity_id=m.activity_id and mo.measurement_id=m.id
            )
          order by m.measured_at`,
        [activityId],
      );
      observations.rows.push(...instrumentMeasurements.rows);
      const instrumentCodes = [...new Set(observations.rows.map((observation) => typeof observation.instrument_id === "string" ? observation.instrument_id.trim() : "").filter(Boolean))];
      const registeredInstruments = instrumentCodes.length
        ? await pool.query<MrvInstrumentApprovalEvidence>(
            "select instrument_code,supported_parameter_codes,approval_status,meity_certificate_id,meity_issuer,meity_certificate_scope,meity_verification_url,meity_evidence_reference,meity_evidence_sha256,meity_verified_at,meity_validity_basis,meity_valid_until,calibration_required,calibration_status,calibration_certificate_id,calibration_evidence_reference,calibration_evidence_sha256,calibration_lab,calibration_traceability,calibration_uncertainty,calibration_valid_until,calibration_not_required_reason,firmware_version,firmware_support_until,security_review_status,security_evidence_reference,security_evidence_sha256,security_reviewed_at,security_not_applicable_reason from mrv_instruments where organization_id=$1 and instrument_code=any($2::text[])",
            [row.organization_id, instrumentCodes],
          )
        : { rows: [] as MrvInstrumentApprovalEvidence[] };
      const instrumentFailure = instrumentApprovalFailure(
        methodologyCode,
        observations.rows.map((observation) => ({ instrument_id: typeof observation.instrument_id === "string" ? observation.instrument_id : null, parameter_code: typeof observation.parameter_code === "string" ? observation.parameter_code : null })),
        registeredInstruments.rows,
      );
      if (instrumentFailure) {
        return reply.code(409).send({ error: instrumentFailure, code: "MRV_INSTRUMENT_APPROVAL_REQUIRED", eligibleForRegistry: false, syntheticData: false });
      }
      const staleEvidenceInstruments = instrumentCodes.length
        ? await pool.query<{ instrument_code: string }>(
            "select instrument_code from mrv_instruments where organization_id=$1 and instrument_code=any($2::text[]) and not mrv_instrument_evidence_is_current(id)",
            [row.organization_id, instrumentCodes],
          )
        : { rows: [] as Array<{ instrument_code: string }> };
      if (staleEvidenceInstruments.rows.length) {
        return reply.code(409).send({ error: "One or more MRV instruments reference missing, changed or no-longer-approved evidence-vault artifacts.", code: "MRV_INSTRUMENT_EVIDENCE_INVALID", eligibleForRegistry: false, syntheticData: false });
      }
      const parameterSpecs = instrumentCodes.length
        ? await pool.query<MrvInstrumentParameterSpec>(
            "select i.instrument_code,s.parameter_code,s.unit,s.minimum_value::text,s.maximum_value::text,s.resolution::text,s.accuracy_absolute::text,s.accuracy_relative_percent::text from mrv_instrument_parameter_specs s join mrv_instruments i on i.id=s.instrument_id where i.organization_id=$1 and i.instrument_code=any($2::text[])",
            [row.organization_id, instrumentCodes],
          )
        : { rows: [] as MrvInstrumentParameterSpec[] };
      for (const observation of observations.rows) {
        const code = typeof observation.instrument_id === "string" ? observation.instrument_id.trim() : "";
        const parameterCode = typeof observation.parameter_code === "string" ? observation.parameter_code.trim() : "";
        const observationUnit = typeof observation.unit === "string" ? observation.unit.trim() : "";
        const observedValue = observation.observed_value === null || observation.observed_value === undefined ? Number.NaN : Number(observation.observed_value);
        const parameterFailure = instrumentParameterFailure(code, parameterCode, observationUnit, observedValue, parameterSpecs.rows);
        if (parameterFailure) {
          return reply.code(409).send({ error: parameterFailure, code: "MRV_PARAMETER_SPEC_REQUIRED", eligibleForRegistry: false, syntheticData: false });
        }
      }
      const evidence = await pool.query("select id, evidence_type, content_uri, content_hash, captured_at, status, metadata from evidence where activity_id=$1 order by captured_at", [activityId]);
      // No methodology-specific activity-quantity parameter is configured yet.
      // Never hash an arbitrary latest measurement (which could be unbound or unrelated).
      // The optional anchor quantity is populated only when an explicit mapping selects
      // exactly one observation from the already instrument/evidence/parameter-validated set.
      const { quantity, unit } = explicitAnchorQuantity(observations.rows, null);
      // Replay identity must include every validated reading, not just activity IDs.
      // Sort by stable reading ID so query ordering cannot change the digest.
      const observationSetHash = mrvObservationSetHash(observations.rows as Array<Record<string, unknown>>);

      // Reuse an exact, already-persisted external anchor on sequential retries.
      // Match the full payload hash so changed measurements/methodology cannot reuse stale provenance.
      const prior = await pool.query<ExistingProvenanceRow>(
        `select * from mrv_provenance_events
          where activity_id=$1 and verification_id=$2 and evidence_id=$3 and guardian_policy_id=$4
            and guardian_status='VERIFIED' and hcs_status='CONSENSUS_CONFIRMED'
            and guardian_execution_id is not null and btrim(guardian_execution_id)<>''
            and hcs_topic_id is not null and btrim(hcs_topic_id)<>''
            and hcs_transaction_id is not null and btrim(hcs_transaction_id)<>''
            and hcs_consensus_timestamp is not null and btrim(hcs_consensus_timestamp)<>''
          order by created_at desc`,
        [activityId, verificationId, evidenceId, policyId],
      );
      const existing = prior.rows.find(record => {
        if (!record.guardian_execution_id) return false;
        return integrityHash({ schema: "rupaykg:mrv:v1", activityId, verificationId, evidenceId, guardianPolicyId: policyId, guardianExecutionId: record.guardian_execution_id, mrvStatus: "VERIFIED", methodologyCode, quantity, unit, metadata: { guardianStatus: "VERIFIED", observationSetHash } }) === record.integrity_hash;
      });
      if (existing?.guardian_execution_id && existing.hcs_topic_id && existing.hcs_transaction_id && existing.hcs_consensus_timestamp) {
        const acceptanceFixture = await isAcceptanceFixture(pool, activityId);
        return reply.code(200).send({
          source: "postgresql+guardian+hedera", syntheticData: false, replay: true,
          guardian: { status: "VERIFIED", executionId: existing.guardian_execution_id, policyId: existing.guardian_policy_id, message: "Reused persisted Guardian execution; no duplicate provider submission." },
          hedera: { status: "CONSENSUS_CONFIRMED", transactionId: existing.hcs_transaction_id, consensusTimestamp: existing.hcs_consensus_timestamp, topicId: existing.hcs_topic_id, network: hederaStatus().network, integrityHash: existing.integrity_hash, message: "Reused persisted HCS anchor; no duplicate consensus message submitted." },
          provenance: existing,
          eligibleForRegistry: !acceptanceFixture && Boolean(existing.mirror_node_verified_at),
          ...(acceptanceFixture ? { registryEligibilityReason: "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE" } : {}),
        });
      }

      const guardian = await executeGuardianMrv({ activityId, verificationId, evidenceId, policyId, methodologyCode, observations: observations.rows, evidence: evidence.rows, metadata: { evidenceCount: Number(row.evidence_count), observationCount: Number(row.observation_count) } });
      if (guardian.status !== "VERIFIED" || !guardian.executionId) return reply.code(503).send({ source: "guardian", syntheticData: false, guardian, eligibleForRegistry: false });

      const anchor = await submitHcsAnchor({ schema: "rupaykg:mrv:v1", activityId, verificationId, evidenceId, guardianPolicyId: policyId, guardianExecutionId: guardian.executionId, mrvStatus: "VERIFIED", methodologyCode, quantity, unit, metadata: { guardianStatus: guardian.status, observationSetHash } });
      const persisted = await pool.query(`insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,methodology_code,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict(activity_id,verification_id,integrity_hash) do update set guardian_execution_id=excluded.guardian_execution_id,guardian_status=excluded.guardian_status,hcs_status=excluded.hcs_status,hcs_topic_id=excluded.hcs_topic_id,hcs_transaction_id=excluded.hcs_transaction_id,hcs_consensus_timestamp=excluded.hcs_consensus_timestamp,metadata=excluded.metadata,mirror_node_verified_at=null returning *`, [activityId, verificationId, evidenceId, policyId, guardian.executionId, guardian.status, anchor.status, anchor.topicId || null, anchor.transactionId, anchor.consensusTimestamp, anchor.integrityHash, methodologyCode || null, JSON.stringify({ guardian: guardian.raw ?? null })]);
      return reply.code(anchor.status === "CONSENSUS_CONFIRMED" ? 201 : 503).send({ source: "postgresql+guardian+hedera", syntheticData: false, guardian, hedera: anchor, provenance: persisted.rows[0], eligibleForRegistry: false });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authoritative MRV submission unavailable", code: "MRV_UNAVAILABLE", syntheticData: false }); }
    finally {
      if (lockClient) {
        if (lockAcquired) await lockClient.query("select pg_advisory_unlock(hashtext($1))", [idempotencyLockKey]).catch(() => undefined);
        lockClient.release();
      }
    }
  });

  app.get("/api/v1/mrv/provenance/:activityId", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const activityId = (request.params as { activityId: string }).activityId;
    try {
      const owner = await pool.query<{ organization_id: string }>("select organization_id from activities where id=$1", [activityId]);
      if (!owner.rows[0] || !canActForOrganization(auth, owner.rows[0].organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await requirePermission(pool, auth, owner.rows[0].organization_id, ["guardian:read"])) return reply.code(403).send({ error: "Guardian read permission required", code: "MRV_PERMISSION_REQUIRED" });
      if (!await activityInAuthorizedGeography(pool, auth, activityId, owner.rows[0].organization_id)) return reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
      const rows = await pool.query("select * from mrv_provenance_events where activity_id=$1 order by created_at desc", [activityId]);
      const acceptanceFixture = await isAcceptanceFixture(pool, activityId);
      return {
        source: "postgresql",
        syntheticData: false,
        eligibleForRegistry: !acceptanceFixture && rows.rows.some(r => r.guardian_status === "VERIFIED" && r.hcs_status === "CONSENSUS_CONFIRMED" && r.mirror_node_verified_at != null),
        ...(acceptanceFixture ? { registryEligibilityReason: "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE" } : {}),
        provenance: rows.rows,
      };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "MRV provenance unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/mrv/hedera/verify/:consensusTimestamp", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const timestamp = (request.params as { consensusTimestamp: string }).consensusTimestamp;
    try {
      const provenance = await pool.query<{ id: string; activity_id: string; verification_id: string; evidence_id: string; guardian_execution_id: string; integrity_hash: string; hcs_topic_id: string | null; mirror_node_verified_at: Date | null }>(
        "select id, activity_id, verification_id, evidence_id, guardian_execution_id, integrity_hash, hcs_topic_id, mirror_node_verified_at from mrv_provenance_events where hcs_consensus_timestamp=$1 order by created_at desc limit 1",
        [timestamp],
      );
      const row = provenance.rows[0];
      if (!row) return reply.code(404).send({ error: "No persisted MRV provenance is bound to this Hedera consensus timestamp", code: "HCS_PROVENANCE_NOT_FOUND" });
      if (!row.hcs_topic_id || row.hcs_topic_id !== (process.env.HEDERA_TOPIC_ID || "")) return reply.code(409).send({ error: "Persisted MRV provenance topic does not match the configured Hedera topic", code: "HCS_TOPIC_MISMATCH" });
      const owner = await pool.query<{ organization_id: string }>("select organization_id from activities where id=$1", [row.activity_id]);
      if (!owner.rows[0] || !canActForOrganization(auth, owner.rows[0].organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await requirePermission(pool, auth, owner.rows[0].organization_id, ["guardian:read"])) return reply.code(403).send({ error: "Guardian read permission required", code: "MRV_PERMISSION_REQUIRED" });
      if (!await activityInAuthorizedGeography(pool, auth, row.activity_id, owner.rows[0].organization_id)) return reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
      const verification = await verifyHcsMessage(timestamp, row.hcs_topic_id, row.integrity_hash, row.activity_id, row.verification_id, row.evidence_id, row.guardian_execution_id);
      if (!verification.verified) return { source: "hedera-mirror-node", syntheticData: false, ...verification, eligibleForRegistry: false };
      const persisted = await pool.query<{ mirror_node_verified_at: Date }>(
        "update mrv_provenance_events set mirror_node_verified_at=clock_timestamp() where id=$1 and hcs_consensus_timestamp=$2 and hcs_topic_id=$3 and integrity_hash=$4 and guardian_execution_id=$5 and guardian_status='VERIFIED' and hcs_status='CONSENSUS_CONFIRMED' returning mirror_node_verified_at",
        [row.id, timestamp, row.hcs_topic_id, row.integrity_hash, row.guardian_execution_id],
      );
      if (!persisted.rows[0]?.mirror_node_verified_at) return { source: "hedera-mirror-node", syntheticData: false, verified: false, eligibleForRegistry: false, error: "MRV provenance changed during Mirror Node verification; retry against the current record" };
      const acceptanceFixture = await isAcceptanceFixture(pool, row.activity_id);
      return {
        source: "hedera-mirror-node",
        syntheticData: false,
        ...verification,
        eligibleForRegistry: !acceptanceFixture,
        ...(acceptanceFixture ? { registryEligibilityReason: "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE" } : {}),
        persistedVerificationAt: persisted.rows[0].mirror_node_verified_at,
      };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Hedera mirror-node verification unavailable", code: "HCS_VERIFY_UNAVAILABLE", syntheticData: false }); }
  });

  await registerStatutoryRoutes(app, pool);
}
