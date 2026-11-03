import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { executeGuardianMrv, guardianStatus } from "./guardian-mrv.js";
import { hederaStatus, integrityHash, submitHcsAnchor, verifyHcsMessage } from "./hedera-anchor.js";
import { registerStatutoryRoutes } from "./statutory-routes.js";
import { captureMrvSourceSnapshot, MrvSnapshotError } from "./mrv-source-snapshot.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void } };
type ExistingProvenanceRow = { activity_id: string; verification_id: string; evidence_id: string; guardian_policy_id: string; guardian_execution_id: string | null; guardian_status: string; hcs_status: string; hcs_topic_id: string | null; hcs_transaction_id: string | null; hcs_consensus_timestamp: string | null; mirror_node_verified_at: Date | string | null; integrity_hash: string; source_snapshot_id: string | null; source_snapshot_digest: string | null; source_snapshot_version: number | null; [key: string]: unknown };
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
      registryEligibility: "REQUIRES_GUARDIAN_VERIFIED_HCS_CONSENSUS_MIRROR_NODE_VERIFIED_AND_CURRENT_IMMUTABLE_SOURCE_SNAPSHOT",
    };
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
      const captured = await captureMrvSourceSnapshot({
        pool, auth, activityId, verificationId, evidenceId, guardianPolicyId: policyId,
        ...(methodologyCode !== undefined ? { methodologyCode } : {}), correctionReason: str(body, "correctionReason"),
      });
      const { snapshot } = captured;
      const observations = captured.observations;
      const measurements = captured.measurements;
      const evidence = captured.evidence;
      const quantity = captured.latestQuantity;
      const unit = captured.latestUnit;

      // A retry may reuse only an anchor bound to this exact immutable source snapshot.
      const prior = await pool.query<ExistingProvenanceRow>(
        `select * from mrv_provenance_events
          where activity_id=$1 and verification_id=$2 and evidence_id=$3 and guardian_policy_id=$4
            and source_snapshot_id=$5 and source_snapshot_digest=$6 and source_snapshot_version=$7
            and guardian_status='VERIFIED' and hcs_status='CONSENSUS_CONFIRMED'
            and guardian_execution_id is not null and btrim(guardian_execution_id)<>''
            and hcs_topic_id is not null and btrim(hcs_topic_id)<>''
            and hcs_transaction_id is not null and btrim(hcs_transaction_id)<>''
            and hcs_consensus_timestamp is not null and btrim(hcs_consensus_timestamp)<>''
          order by created_at desc`,
        [activityId, verificationId, evidenceId, policyId, snapshot.id, snapshot.source_digest, snapshot.snapshot_version],
      );
      const existing = prior.rows.find(record => {
        if (!record.guardian_execution_id) return false;
        return integrityHash({
          schema: "rupaykg:mrv:v2", activityId, verificationId, evidenceId,
          guardianPolicyId: policyId, guardianExecutionId: record.guardian_execution_id,
          mrvStatus: "VERIFIED", methodologyCode, quantity, unit,
          sourceSnapshotId: snapshot.id, sourceSnapshotDigest: snapshot.source_digest,
          sourceSnapshotVersion: snapshot.snapshot_version,
          metadata: { guardianStatus: "VERIFIED" },
        }) === record.integrity_hash;
      });
      if (existing?.guardian_execution_id && existing.hcs_topic_id && existing.hcs_transaction_id && existing.hcs_consensus_timestamp) {
        const acceptanceFixture = await isAcceptanceFixture(pool, activityId);
        return reply.code(200).send({
          source: "postgresql+guardian+hedera", syntheticData: false, replay: true,
          guardian: { status: "VERIFIED", executionId: existing.guardian_execution_id, policyId: existing.guardian_policy_id, message: "Reused persisted Guardian execution; no duplicate provider submission." },
          hedera: { status: "CONSENSUS_CONFIRMED", transactionId: existing.hcs_transaction_id, consensusTimestamp: existing.hcs_consensus_timestamp, topicId: existing.hcs_topic_id, network: hederaStatus().network, integrityHash: existing.integrity_hash, message: "Reused persisted HCS anchor; no duplicate consensus message submitted." },
          provenance: existing,
          sourceSnapshot: { id: snapshot.id, version: snapshot.snapshot_version, digest: snapshot.source_digest, supersedesSnapshotId: snapshot.supersedes_snapshot_id },
          eligibleForRegistry: !acceptanceFixture && Boolean(existing.mirror_node_verified_at),
          ...(acceptanceFixture ? { registryEligibilityReason: "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE" } : {}),
        });
      }

      const guardian = await executeGuardianMrv({ activityId, verificationId, evidenceId, policyId, methodologyCode, observations, measurements, evidence, metadata: { evidenceCount: evidence.length, observationCount: observations.length, sourceSnapshotId: snapshot.id, sourceSnapshotVersion: snapshot.snapshot_version, sourceSnapshotDigest: snapshot.source_digest } });
      if (guardian.status !== "VERIFIED" || !guardian.executionId) return reply.code(503).send({ source: "guardian", syntheticData: false, guardian, eligibleForRegistry: false });

      const anchor = await submitHcsAnchor({ schema: "rupaykg:mrv:v2", activityId, verificationId, evidenceId, guardianPolicyId: policyId, guardianExecutionId: guardian.executionId, mrvStatus: "VERIFIED", methodologyCode, quantity, unit, sourceSnapshotId: snapshot.id, sourceSnapshotDigest: snapshot.source_digest, sourceSnapshotVersion: snapshot.snapshot_version, metadata: { guardianStatus: guardian.status } });
      const persistClient = await pool.connect();
      let persistedRow: Record<string, unknown> | undefined;
      try {
        await persistClient.query("begin");
        if (!canActForOrganization(auth, captured.organizationId) || !await hasOrganizationPermission(persistClient, auth, captured.organizationId, ["guardian:operate"])) {
          await persistClient.query("rollback");
          return reply.code(403).send({ error: "Authorization changed during MRV provider execution; the external anchor is not accepted as persisted provenance", code: "MRV_AUTHORIZATION_CHANGED", syntheticData: false, hederaTransactionId: anchor.transactionId, hederaConsensusTimestamp: anchor.consensusTimestamp, sourceSnapshotId: snapshot.id });
        }
        const scope = await persistClient.query<{ ok: boolean }>(
          `select exists(select 1 from organization_memberships om join activities a on a.organization_id=om.organization_id
            where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and a.id=$3
              and a.geography_id is not null and organization_has_geography_scope(om.organization_id,a.geography_id)) ok`,
          [auth.identityId, captured.organizationId, activityId],
        );
        if (scope.rows[0]?.ok !== true) {
          await persistClient.query("rollback");
          return reply.code(403).send({ error: "Activity geography authorization changed during MRV provider execution", code: "GEOGRAPHY_FORBIDDEN", syntheticData: false, hederaTransactionId: anchor.transactionId, hederaConsensusTimestamp: anchor.consensusTimestamp, sourceSnapshotId: snapshot.id });
        }
        const snapshotStillExists = await persistClient.query<{ ok: boolean }>("select exists(select 1 from mrv_source_snapshots where id=$1 and source_digest=$2 and snapshot_version=$3) ok", [snapshot.id, snapshot.source_digest, snapshot.snapshot_version]);
        if (snapshotStillExists.rows[0]?.ok !== true) throw new Error("Immutable MRV source snapshot disappeared before provenance persistence");
        const persisted = await persistClient.query(`insert into mrv_provenance_events(activity_id,verification_id,evidence_id,guardian_policy_id,guardian_execution_id,guardian_status,hcs_status,hcs_topic_id,hcs_transaction_id,hcs_consensus_timestamp,integrity_hash,methodology_code,metadata,source_snapshot_id,source_snapshot_digest,source_snapshot_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) on conflict(activity_id,verification_id,integrity_hash) do update set guardian_execution_id=excluded.guardian_execution_id,guardian_status=excluded.guardian_status,hcs_status=excluded.hcs_status,hcs_topic_id=excluded.hcs_topic_id,hcs_transaction_id=excluded.hcs_transaction_id,hcs_consensus_timestamp=excluded.hcs_consensus_timestamp,metadata=excluded.metadata,source_snapshot_id=excluded.source_snapshot_id,source_snapshot_digest=excluded.source_snapshot_digest,source_snapshot_version=excluded.source_snapshot_version,mirror_node_verified_at=null returning *`, [activityId, verificationId, evidenceId, policyId, guardian.executionId, guardian.status, anchor.status, anchor.topicId || null, anchor.transactionId, anchor.consensusTimestamp, anchor.integrityHash, methodologyCode || null, JSON.stringify({ guardian: guardian.raw ?? null, sourceSnapshotDigest: snapshot.source_digest }), snapshot.id, snapshot.source_digest, snapshot.snapshot_version]);
        persistedRow = persisted.rows[0] as Record<string, unknown> | undefined;
        await persistClient.query("commit");
      } catch (error) {
        await persistClient.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        persistClient.release();
      }
      return reply.code(anchor.status === "CONSENSUS_CONFIRMED" ? 201 : 503).send({ source: "postgresql+guardian+hedera", syntheticData: false, guardian, hedera: anchor, provenance: persistedRow, sourceSnapshot: { id: snapshot.id, version: snapshot.snapshot_version, digest: snapshot.source_digest, supersedesSnapshotId: snapshot.supersedes_snapshot_id }, eligibleForRegistry: false });
    } catch (error) {
      if (error instanceof MrvSnapshotError) return reply.code(error.httpStatus).send({ error: error.message, code: error.code, syntheticData: false });
      request.log.error(error); return reply.code(503).send({ error: "Authoritative MRV submission unavailable", code: "MRV_UNAVAILABLE", syntheticData: false });
    }
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
      const rows = await pool.query("select m.*, (m.source_snapshot_id is not null and exists(select 1 from mrv_source_snapshots current_snapshot join activities current_activity on current_activity.id=current_snapshot.activity_id where current_snapshot.id=m.source_snapshot_id and current_snapshot.source_digest=m.source_snapshot_digest and current_snapshot.snapshot_version=m.source_snapshot_version and current_snapshot.source_revision=current_activity.mrv_source_revision) and not exists(select 1 from mrv_source_snapshots newer where newer.activity_id=m.activity_id and newer.snapshot_version>m.source_snapshot_version)) as source_snapshot_current from mrv_provenance_events m where m.activity_id=$1 order by m.created_at desc", [activityId]);
      const acceptanceFixture = await isAcceptanceFixture(pool, activityId);
      return {
        source: "postgresql",
        syntheticData: false,
        eligibleForRegistry: !acceptanceFixture && rows.rows.some(r => r.guardian_status === "VERIFIED" && r.hcs_status === "CONSENSUS_CONFIRMED" && r.mirror_node_verified_at != null && r.source_snapshot_current === true),
        ...(acceptanceFixture ? { registryEligibilityReason: "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE" } : rows.rows.some(r => r.mirror_node_verified_at != null && r.source_snapshot_current !== true) ? { registryEligibilityReason: "SOURCE_SNAPSHOT_NOT_CURRENT_OR_LEGACY" } : {}),
        provenance: rows.rows,
      };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "MRV provenance unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/mrv/hedera/verify/:consensusTimestamp", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const timestamp = (request.params as { consensusTimestamp: string }).consensusTimestamp;
    try {
      const provenance = await pool.query<{ id: string; activity_id: string; verification_id: string; evidence_id: string; guardian_execution_id: string; integrity_hash: string; hcs_topic_id: string | null; source_snapshot_id: string | null; source_snapshot_digest: string | null; source_snapshot_version: number | null; mirror_node_verified_at: Date | null }>(
        "select id, activity_id, verification_id, evidence_id, guardian_execution_id, integrity_hash, hcs_topic_id, source_snapshot_id, source_snapshot_digest, source_snapshot_version, mirror_node_verified_at from mrv_provenance_events where hcs_consensus_timestamp=$1 order by created_at desc limit 1",
        [timestamp],
      );
      const row = provenance.rows[0];
      if (!row) return reply.code(404).send({ error: "No persisted MRV provenance is bound to this Hedera consensus timestamp", code: "HCS_PROVENANCE_NOT_FOUND" });
      if (!row.hcs_topic_id || row.hcs_topic_id !== (process.env.HEDERA_TOPIC_ID || "")) return reply.code(409).send({ error: "Persisted MRV provenance topic does not match the configured Hedera topic", code: "HCS_TOPIC_MISMATCH" });
      const owner = await pool.query<{ organization_id: string }>("select organization_id from activities where id=$1", [row.activity_id]);
      if (!owner.rows[0] || !canActForOrganization(auth, owner.rows[0].organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!await requirePermission(pool, auth, owner.rows[0].organization_id, ["guardian:read"])) return reply.code(403).send({ error: "Guardian read permission required", code: "MRV_PERMISSION_REQUIRED" });
      if (!await activityInAuthorizedGeography(pool, auth, row.activity_id, owner.rows[0].organization_id)) return reply.code(403).send({ error: "Activity geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
      const verification = await verifyHcsMessage(timestamp, row.hcs_topic_id, row.integrity_hash, row.activity_id, row.verification_id, row.evidence_id, row.guardian_execution_id, row.source_snapshot_id ?? undefined, row.source_snapshot_digest ?? undefined, row.source_snapshot_version ?? undefined);
      if (!verification.verified) return { source: "hedera-mirror-node", syntheticData: false, ...verification, eligibleForRegistry: false };
      const verifyClient = await pool.connect();
      let persistedAt: Date | null = null;
      try {
        await verifyClient.query("begin");
        if (!canActForOrganization(auth, owner.rows[0].organization_id)
            || !await hasOrganizationPermission(verifyClient, auth, owner.rows[0].organization_id, ["guardian:read"])) {
          await verifyClient.query("rollback");
          return reply.code(403).send({ error: "Authorization changed during Mirror Node verification", code: "MRV_AUTHORIZATION_CHANGED", syntheticData: false });
        }
        const scope = await verifyClient.query<{ ok: boolean }>(
          `select exists(select 1 from organization_memberships om join activities a on a.organization_id=om.organization_id
            where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and a.id=$3
              and a.geography_id is not null and organization_has_geography_scope(om.organization_id,a.geography_id)) ok`,
          [auth.identityId, owner.rows[0].organization_id, row.activity_id],
        );
        if (scope.rows[0]?.ok !== true) {
          await verifyClient.query("rollback");
          return reply.code(403).send({ error: "Activity geography authorization changed during Mirror Node verification", code: "GEOGRAPHY_FORBIDDEN", syntheticData: false });
        }
        const persisted = await verifyClient.query<{ mirror_node_verified_at: Date }>(
          "update mrv_provenance_events set mirror_node_verified_at=clock_timestamp() where id=$1 and hcs_consensus_timestamp=$2 and hcs_topic_id=$3 and integrity_hash=$4 and guardian_execution_id=$5 and source_snapshot_id is not distinct from $6 and source_snapshot_digest is not distinct from $7 and source_snapshot_version is not distinct from $8 and guardian_status='VERIFIED' and hcs_status='CONSENSUS_CONFIRMED' returning mirror_node_verified_at",
          [row.id, timestamp, row.hcs_topic_id, row.integrity_hash, row.guardian_execution_id, row.source_snapshot_id, row.source_snapshot_digest, row.source_snapshot_version],
        );
        persistedAt = persisted.rows[0]?.mirror_node_verified_at ?? null;
        await verifyClient.query("commit");
      } catch (error) {
        await verifyClient.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        verifyClient.release();
      }
      if (!persistedAt) return { source: "hedera-mirror-node", syntheticData: false, verified: false, eligibleForRegistry: false, error: "MRV provenance or source snapshot binding changed during Mirror Node verification; retry against the current record" };
      const acceptanceFixture = await isAcceptanceFixture(pool, row.activity_id);
      const currentSnapshot = row.source_snapshot_id && row.source_snapshot_version !== null
        ? await pool.query<{ current: boolean }>("select exists(select 1 from mrv_source_snapshots current_snapshot join activities current_activity on current_activity.id=current_snapshot.activity_id where current_snapshot.id=$1 and current_snapshot.source_digest=row.source_snapshot_digest and current_snapshot.snapshot_version=row.source_snapshot_version and current_snapshot.source_revision=current_activity.mrv_source_revision and not exists(select 1 from mrv_source_snapshots newer where newer.activity_id=current_snapshot.activity_id and newer.snapshot_version>current_snapshot.snapshot_version)) current", [row.source_snapshot_id])
        : { rows: [{ current: false }] };
      const sourceSnapshotCurrent = currentSnapshot.rows[0]?.current === true;
      return {
        source: "hedera-mirror-node",
        syntheticData: false,
        ...verification,
        eligibleForRegistry: !acceptanceFixture && sourceSnapshotCurrent,
        ...(acceptanceFixture ? { registryEligibilityReason: "ACCEPTANCE_FIXTURE_NOT_REGISTRY_ELIGIBLE" } : !sourceSnapshotCurrent ? { registryEligibilityReason: "SOURCE_SNAPSHOT_NOT_CURRENT_OR_LEGACY" } : {}),
        persistedVerificationAt: persistedAt,
      };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Hedera mirror-node verification unavailable", code: "HCS_VERIFY_UNAVAILABLE", syntheticData: false }); }
  });

  await registerStatutoryRoutes(app, pool);
}
