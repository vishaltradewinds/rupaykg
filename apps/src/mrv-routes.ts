import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { executeGuardianMrv, guardianStatus } from "./guardian-mrv.js";
import { hederaStatus, integrityHash, submitHcsAnchor, verifyHcsMessage } from "./hedera-anchor.js";
import { registerStatutoryRoutes } from "./statutory-routes.js";
import { createTenantTransaction, tenantDatabaseContextFromAuth } from "./database-context.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void } };
type ExistingProvenanceRow = { activity_id: string; verification_id: string; evidence_id: string; guardian_policy_id: string; guardian_execution_id: string | null; guardian_status: string; hcs_status: string; hcs_topic_id: string | null; hcs_transaction_id: string | null; hcs_consensus_timestamp: string | null; mirror_node_verified_at: Date | string | null; integrity_hash: string; [key: string]: unknown };
const bodyOf = (r: Request): Record<string, unknown> => r.body && typeof r.body === "object" ? r.body as Record<string, unknown> : {};
const str = (b: Record<string, unknown>, k: string): string | null => typeof b[k] === "string" && b[k].trim() ? b[k].trim() : null;

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
  const withTenantTransaction = pool ? createTenantTransaction(pool) : null;
  app.get("/api/v1/mrv/status", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    if (!withTenantTransaction) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
    try {
      const allowed = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) =>
        hasOrganizationPermission(client, auth, auth.activeOrganizationId!, ["guardian:read"]));
      if (!allowed) return reply.code(403).send({ error: "Guardian read permission required", code: "MRV_PERMISSION_REQUIRED" });
      return {
        source: "runtime", syntheticData: false, guardian: guardianStatus(), hedera: hederaStatus(),
        registryEligibility: "REQUIRES_GUARDIAN_VERIFIED_AND_HCS_CONSENSUS_CONFIRMED_PROVENANCE",
      };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "MRV status unavailable", code: "MRV_UNAVAILABLE" }); }
  });

  app.post("/api/v1/mrv/activities/:activityId/submit", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const activityId = (request.params as { activityId: string }).activityId;
    const body = bodyOf(request as never);
    const verificationId = str(body, "verificationId");
    const evidenceId = str(body, "evidenceId");
    const policyId = str(body, "guardianPolicyId") || process.env.GUARDIAN_MRV_POLICY_ID || null;
    const methodologyCode = str(body, "methodologyCode") || undefined;
    if (!verificationId || !evidenceId || !policyId) return reply.code(400).send({ error: "verificationId, evidenceId and guardianPolicyId (or GUARDIAN_MRV_POLICY_ID) are required" });
    let lockClient: PoolClient | null = null;
    let lockAcquired = false;
    const idempotencyLockKey = [activityId, verificationId, evidenceId, policyId, methodologyCode ?? ""].join("|");
    try {
      lockClient = await pool.connect();
      await lockClient.query("select pg_advisory_lock(hashtext($1))", [idempotencyLockKey]);
      lockAcquired = true;
      const context = await pool.query<{ organization_id: string; activity_status: string; decision: string; evidence_status: string; evidence_activity_id: string | null; evidence_count: string; observation_count: string }>(
        `select a.organization_id, a.status activity_status, v.decision, e.status evidence_status, e.activity_id evidence_activity_id,
                (select count(*)::text from evidence e2 where e2.activity_id=a.id) evidence_count,
                (select count(*)::text from mrv_observations mo where mo.activity_id=a.id) observation_count
           from activities a join verifications v on v.id=$2 and v.activity_id=a.id join evidence e on e.id=$3 and e.activity_id=a.id where a.id=$1`,
        [activityId, verificationId, evidenceId]);
      const row = context.rows[0];
      if (!row) return reply.code(409).send({ error: "Activity, verification and evidence must be bound to the same activity", code: "MRV_BINDING_INVALID" });
      if (!canActForOrganization(auth, row.organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await requirePermission(pool, auth, row.organization_id, ["guardian:operate"])) return reply.code(403).send({ error: "Guardian MRV operation permission required", code: "MRV_PERMISSION_REQUIRED" });
      if (!await activityInAuthorizedGeography(pool, auth, activityId, row.organization_id)) return reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
      if (row.activity_status !== "COMPLETED" || row.decision !== "APPROVED" || row.evidence_status !== "VERIFIED" || row.evidence_activity_id !== activityId) return reply.code(409).send({ error: "Completed activity, approved verification and VERIFIED evidence are required before Guardian MRV", code: "MRV_PRECONDITION_FAILED" });

      const observations = await pool.query("select id, parameter_code, observed_value, unit, method, instrument_id, observed_at, uncertainty, quality_status, metadata from mrv_observations where activity_id=$1 order by observed_at", [activityId]);
      const evidence = await pool.query("select id, evidence_type, content_uri, content_hash, captured_at, status, metadata from evidence where activity_id=$1 order by captured_at", [activityId]);
      const quantityRow = await pool.query<{ value: string | null; unit: string | null }>("select value::text value, unit from measurements where activity_id=$1 order by measured_at desc limit 1", [activityId]);
      const quantity = quantityRow.rows[0]?.value ? Number(quantityRow.rows[0].value) : undefined;
      const unit = quantityRow.rows[0]?.unit || undefined;

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
        return integrityHash({ schema: "rupaykg:mrv:v1", activityId, verificationId, evidenceId, guardianPolicyId: policyId, guardianExecutionId: record.guardian_execution_id, mrvStatus: "VERIFIED", methodologyCode, quantity, unit, metadata: { guardianStatus: "VERIFIED" } }) === record.integrity_hash;
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

      const anchor = await submitHcsAnchor({ schema: "rupaykg:mrv:v1", activityId, verificationId, evidenceId, guardianPolicyId: policyId, guardianExecutionId: guardian.executionId, mrvStatus: "VERIFIED", methodologyCode, quantity, unit, metadata: { guardianStatus: guardian.status } });
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
    if (!withTenantTransaction) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
    try {
      const outcome = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
        const owner = await client.query<{ organization_id: string; geography_id: string | null }>(
          "select organization_id, geography_id from activities where id=$1", [activityId]);
        const activity = owner.rows[0];
        if (!activity || !activity.geography_id || activity.organization_id !== auth.activeOrganizationId) {
          return { status: 404 as const, body: { error: "MRV activity not found", code: "MRV_ACTIVITY_NOT_FOUND" } };
        }
        const scope = await client.query<{ ok: boolean }>(
          "select organization_has_geography_scope($1::uuid,$2::uuid) ok", [activity.organization_id, activity.geography_id]);
        if (!scope.rows[0]?.ok || !await hasOrganizationPermission(client, auth, activity.organization_id, ["guardian:read"])) {
          return { status: 403 as const, body: { error: "Guardian read permission and geography scope required", code: "MRV_PERMISSION_REQUIRED" } };
        }
        const rows = await client.query(
          "select * from mrv_provenance_events where activity_id=$1 order by created_at desc", [activityId]);
        const fixture = await client.query<{ is_fixture: boolean }>(
          "select exists(select 1 from activities where id=$1 and metadata->>'acceptanceFixture'='true') or exists(select 1 from evidence where activity_id=$1 and metadata->>'acceptanceFixture'='true') is_fixture",
          [activityId]);
        const acceptanceFixture = fixture.rows[0]?.is_fixture === true;
        return { status: 200 as const, body: {
          source: "postgresql", syntheticData: false,
          eligibleForRegistry: !acceptanceFixture && rows.rows.some((r: Record<string, unknown>) => r.guardian_status === "VERIFIED" && r.hcs_status === "CONSENSUS_CONFIRMED" && r.mirror_node_verified_at != null),
          ...(acceptanceFixture ? { registryEligibilityReason: "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE" } : {}),
          provenance: rows.rows,
        }};
      });
      return reply.code(outcome.status).send(outcome.body);
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "MRV provenance unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/mrv/hedera/verify/:consensusTimestamp", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const timestamp = (request.params as { consensusTimestamp: string }).consensusTimestamp;
    if (!withTenantTransaction) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
    try {
      const preflight = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
        const q = await client.query<{ id: string; activity_id: string; organization_id: string; geography_id: string | null; verification_id: string; evidence_id: string; guardian_execution_id: string; integrity_hash: string; hcs_topic_id: string | null }>(
          "select p.id,p.activity_id,a.organization_id,a.geography_id,p.verification_id,p.evidence_id,p.guardian_execution_id,p.integrity_hash,p.hcs_topic_id from mrv_provenance_events p join activities a on a.id=p.activity_id where p.hcs_consensus_timestamp=$1 order by p.created_at desc limit 1",
          [timestamp]);
        const row = q.rows[0];
        if (!row) return { status: 404 as const, body: { error: "No persisted MRV provenance is bound to this Hedera consensus timestamp", code: "HCS_PROVENANCE_NOT_FOUND" } };
        if (row.organization_id !== auth.activeOrganizationId) return { status: 404 as const, body: { error: "MRV provenance not found", code: "HCS_PROVENANCE_NOT_FOUND" } };
        if (!row.geography_id) return { status: 403 as const, body: { error: "Activity geography is unavailable", code: "GEOGRAPHY_FORBIDDEN" } };
        const scope = await client.query<{ ok: boolean }>("select organization_has_geography_scope($1::uuid,$2::uuid) ok", [row.organization_id,row.geography_id]);
        if (!scope.rows[0]?.ok || !await hasOrganizationPermission(client,auth,row.organization_id,["guardian:read"])) return { status: 403 as const, body: { error: "Guardian read permission and geography scope required", code: "MRV_PERMISSION_REQUIRED" } };
        if (!row.hcs_topic_id || row.hcs_topic_id !== (process.env.HEDERA_TOPIC_ID || "")) return { status: 409 as const, body: { error: "Persisted MRV provenance topic does not match the configured Hedera topic", code: "HCS_TOPIC_MISMATCH" } };
        return { status: 200 as const, row };
      });
      if (preflight.status !== 200) return reply.code(preflight.status).send(preflight.body);
      const row = preflight.row;
      const verification = await verifyHcsMessage(timestamp,row.hcs_topic_id!,row.integrity_hash,row.activity_id,row.verification_id,row.evidence_id,row.guardian_execution_id);
      if (!verification.verified) return { source: "hedera-mirror-node", syntheticData: false, ...verification, eligibleForRegistry: false };
      const persisted = await withTenantTransaction(tenantDatabaseContextFromAuth(auth), async (client) => {
        const recheck = await client.query<{ organization_id: string; geography_id: string | null }>(
          "select organization_id,geography_id from activities where id=$1", [row.activity_id]);
        if (recheck.rows[0]?.organization_id !== auth.activeOrganizationId || !recheck.rows[0]?.geography_id) return null;
        const scope = await client.query<{ ok: boolean }>("select organization_has_geography_scope($1::uuid,$2::uuid) ok",[recheck.rows[0].organization_id,recheck.rows[0].geography_id]);
        if (!scope.rows[0]?.ok || !await hasOrganizationPermission(client,auth,recheck.rows[0].organization_id,["guardian:read"])) return null;
        const update = await client.query<{ mirror_node_verified_at: Date }>(
          "update mrv_provenance_events set mirror_node_verified_at=clock_timestamp() where id=$1 and activity_id=$2 and hcs_consensus_timestamp=$3 and hcs_topic_id=$4 and integrity_hash=$5 and guardian_execution_id=$6 and guardian_status='VERIFIED' and hcs_status='CONSENSUS_CONFIRMED' returning mirror_node_verified_at",
          [row.id,row.activity_id,timestamp,row.hcs_topic_id,row.integrity_hash,row.guardian_execution_id]);
        if (!update.rows[0]?.mirror_node_verified_at) return null;
        const fixture = await client.query<{ is_fixture: boolean }>(
          "select exists(select 1 from activities where id=$1 and metadata->>'acceptanceFixture'='true') or exists(select 1 from evidence where activity_id=$1 and metadata->>'acceptanceFixture'='true') is_fixture",
          [row.activity_id]);
        return { verifiedAt: update.rows[0].mirror_node_verified_at, acceptanceFixture: fixture.rows[0]?.is_fixture === true };
      });
      if (!persisted) return { source: "hedera-mirror-node", syntheticData: false, verified: false, eligibleForRegistry: false, error: "MRV provenance changed or authorization expired during Mirror Node verification; retry against the current record" };
      return {
        source: "hedera-mirror-node", syntheticData: false, ...verification,
        eligibleForRegistry: !persisted.acceptanceFixture,
        ...(persisted.acceptanceFixture ? { registryEligibilityReason: "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE" } : {}),
        persistedVerificationAt: persisted.verifiedAt,
      };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Hedera mirror-node verification unavailable", code: "HCS_VERIFY_UNAVAILABLE", syntheticData: false }); }
  });

  await registerStatutoryRoutes(app, pool);
}
