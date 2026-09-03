import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, bearerChallenge } from "./auth.js";
import { validateConflictResolution, validateSyncEnvelope } from "./sync-validation.js";

type AuthContext = Awaited<ReturnType<typeof authenticate>>;
type OperationPayload = Record<string, unknown> & { operationType?: string };

function bodyOf(request: { body: unknown }): Record<string, unknown> {
  return (request.body && typeof request.body === "object" ? request.body : {}) as Record<string, unknown>;
}
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function payloadHash(payload: unknown): string { return createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }
function stringValue(payload: OperationPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function positiveNumber(payload: OperationPayload, key: string): number | null {
  const value = Number(payload[key]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
function dateValue(payload: OperationPayload, key: string): string | null {
  const value = stringValue(payload, key);
  return value && !Number.isNaN(Date.parse(value)) ? value : null;
}

async function requireFieldDevice(pool: Pool, auth: NonNullable<AuthContext>, deviceId: string): Promise<{ id: string } | null> {
  const result = await pool.query<{ id: string }>(`select id from field_devices where id = $1 and identity_id = $2 and status = 'VERIFIED'`, [deviceId, auth.identityId]);
  return result.rows[0] ?? null;
}
async function nextServerCursor(client: PoolClient, deviceId: string): Promise<number> {
  await client.query(`insert into field_sync_cursors (device_id, acknowledged_cursor) values ($1, 0) on conflict (device_id) do nothing`, [deviceId]);
  const cursor = await client.query<{ acknowledged_cursor: string }>(`select acknowledged_cursor from field_sync_cursors where device_id = $1 for update`, [deviceId]);
  const next = Number(cursor.rows[0]?.acknowledged_cursor ?? 0) + 1;
  await client.query(`update field_sync_cursors set acknowledged_cursor = $2, updated_at = now() where device_id = $1`, [deviceId, next]);
  return next;
}
async function verifiedOrganizationAccess(client: PoolClient, identityId: string, organizationId: string): Promise<boolean> {
  const result = await client.query<{ ok: boolean }>(`select exists (select 1 from organization_memberships where identity_id = $1 and organization_id = $2 and status = 'VERIFIED') as ok`, [identityId, organizationId]);
  return result.rows[0]?.ok === true;
}
async function authorizedGeography(client: PoolClient, identityId: string, geographyId: string, organizationId?: string): Promise<boolean> {
  if (!isUuid(geographyId)) return false;
  const result = await client.query<{ ok: boolean }>(`select exists(
    select 1 from organization_memberships om
    where om.identity_id = $1 and om.status = 'VERIFIED'
      ${organizationId ? "and om.organization_id = $3" : ""}
      and organization_has_geography_scope(om.organization_id, $2)
  ) as ok`, organizationId ? [identityId, geographyId, organizationId] : [identityId, geographyId]);
  return result.rows[0]?.ok === true;
}
async function activityGeographyAccess(client: PoolClient, identityId: string, activityId: string): Promise<boolean> {
  const result = await client.query<{ geography_id: string | null }>(`select a.geography_id from activities a where a.id = $1 and exists(
    select 1 from organization_memberships om where om.organization_id = a.organization_id and om.identity_id = $2 and om.status = 'VERIFIED'
  )`, [activityId, identityId]);
  const geographyId = result.rows[0]?.geography_id;
  if (!geographyId) return false;
  return authorizedGeography(client, identityId, geographyId);
}

async function applyOperation(client: PoolClient, identityId: string, payload: OperationPayload): Promise<{ entityType: string; entityId: string }> {
  const operationType = stringValue(payload, "operationType");
  if (!operationType) throw Object.assign(new Error("operationType is required"), { code: "INVALID_OPERATION" });

  if (operationType === "ACTIVITY_CREATE") {
    const organizationId = stringValue(payload, "organizationId");
    const activityType = stringValue(payload, "activityType");
    const occurredAt = dateValue(payload, "occurredAt");
    const geographyId = stringValue(payload, "geographyId");
    if (!organizationId || !activityType || (payload.occurredAt !== undefined && !occurredAt) || !geographyId || !isUuid(geographyId)) throw Object.assign(new Error("ACTIVITY_CREATE requires organizationId, activityType, valid optional occurredAt and an authorized geographyId"), { code: "INVALID_OPERATION" });
    if (!await verifiedOrganizationAccess(client, identityId, organizationId)) throw Object.assign(new Error("No verified membership for activity organization"), { code: "OPERATION_FORBIDDEN" });
    if (!await authorizedGeography(client, identityId, geographyId, organizationId)) throw Object.assign(new Error("Activity geography is outside organization authorization scope"), { code: "OPERATION_FORBIDDEN" });
    const result = await client.query<{ id: string }>(`insert into activities (organization_id, actor_identity_id, geography_id, activity_type, status, occurred_at, metadata) values ($1,$2,$3,$4,'DRAFT',$5,$6) returning id`, [organizationId, identityId, geographyId, activityType, occurredAt, payload.metadata ?? {}]);
    return { entityType: "activity", entityId: result.rows[0]!.id };
  }

  if (operationType === "MEASUREMENT_CREATE") {
    const activityId = stringValue(payload, "activityId");
    const value = positiveNumber(payload, "value");
    const unit = stringValue(payload, "unit");
    const method = stringValue(payload, "method");
    const source = stringValue(payload, "source");
    const measuredAt = dateValue(payload, "measuredAt");
    if (!activityId || !isUuid(activityId) || value === null || !unit || !method || !source || !measuredAt) throw Object.assign(new Error("MEASUREMENT_CREATE requires activityId, positive value, unit, method, source and valid measuredAt"), { code: "INVALID_OPERATION" });
    if (!await activityGeographyAccess(client, identityId, activityId)) throw Object.assign(new Error("Activity is outside organization authorization scope or has no authorized geography"), { code: "OPERATION_FORBIDDEN" });
    const result = await client.query<{ id: string }>(`insert into measurements (activity_id, value, unit, method, source, measured_at, metadata) values ($1,$2,$3,$4,$5,$6,$7) returning id`, [activityId, value, unit, method, source, measuredAt, payload.metadata ?? {}]);
    return { entityType: "measurement", entityId: result.rows[0]!.id };
  }

  if (operationType === "EVIDENCE_CREATE") {
    const activityId = stringValue(payload, "activityId");
    const evidenceType = stringValue(payload, "evidenceType");
    const capturedAt = dateValue(payload, "capturedAt");
    const contentUri = stringValue(payload, "contentUri");
    const contentHash = stringValue(payload, "contentHash");
    const measurementId = payload.measurementId == null ? null : stringValue(payload, "measurementId");
    if (!activityId || !isUuid(activityId) || !evidenceType || !capturedAt || (!contentUri && !contentHash) || (measurementId && !isUuid(measurementId))) throw Object.assign(new Error("EVIDENCE_CREATE requires activityId, evidenceType, valid capturedAt and contentUri or contentHash"), { code: "INVALID_OPERATION" });
    if (!await activityGeographyAccess(client, identityId, activityId)) throw Object.assign(new Error("Activity is outside organization authorization scope or has no authorized geography"), { code: "OPERATION_FORBIDDEN" });
    if (measurementId) {
      const measurement = await client.query<{ ok: boolean }>(`select exists (select 1 from measurements where id = $1 and activity_id = $2) as ok`, [measurementId, activityId]);
      if (!measurement.rows[0]?.ok) throw Object.assign(new Error("Measurement does not belong to activity"), { code: "INVALID_OPERATION" });
    }
    const result = await client.query<{ id: string }>(`insert into evidence (activity_id, measurement_id, evidence_type, captured_at, content_uri, content_hash, metadata) values ($1,$2,$3,$4,$5,$6,$7) returning id`, [activityId, measurementId, evidenceType, capturedAt, contentUri, contentHash, payload.metadata ?? {}]);
    return { entityType: "evidence", entityId: result.rows[0]!.id };
  }

  if (operationType === "RESOURCE_FLOW_CREATE") {
    const organizationId = stringValue(payload, "organizationId");
    const originType = stringValue(payload, "originType");
    const resourceForm = stringValue(payload, "resourceForm");
    const materialCode = stringValue(payload, "materialCode");
    const unit = stringValue(payload, "unit");
    const quantity = positiveNumber(payload, "quantity");
    const sourceGeographyId = payload.sourceGeographyId == null ? null : stringValue(payload, "sourceGeographyId");
    const destinationGeographyId = payload.destinationGeographyId == null ? null : stringValue(payload, "destinationGeographyId");
    if (!organizationId || !originType || !resourceForm || !materialCode || !unit || quantity === null || (sourceGeographyId && !isUuid(sourceGeographyId)) || (destinationGeographyId && !isUuid(destinationGeographyId))) throw Object.assign(new Error("RESOURCE_FLOW_CREATE requires organizationId, originType, resourceForm, materialCode, positive quantity and unit"), { code: "INVALID_OPERATION" });
    if (!await verifiedOrganizationAccess(client, identityId, organizationId)) throw Object.assign(new Error("No verified membership for resource-flow organization"), { code: "OPERATION_FORBIDDEN" });
    if (sourceGeographyId && !await authorizedGeography(client, identityId, sourceGeographyId, organizationId)) throw Object.assign(new Error("Source geography is outside organization authorization scope"), { code: "OPERATION_FORBIDDEN" });
    if (destinationGeographyId && !await authorizedGeography(client, identityId, destinationGeographyId, organizationId)) throw Object.assign(new Error("Destination geography is outside organization authorization scope"), { code: "OPERATION_FORBIDDEN" });
    const result = await client.query<{ id: string }>(`insert into resource_flows (organization_id, origin_type, resource_form, material_code, declared_quantity, unit, source_geography_id, destination_geography_id) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`, [organizationId, originType, resourceForm, materialCode, quantity, unit, sourceGeographyId, destinationGeographyId]);
    return { entityType: "resource_flow", entityId: result.rows[0]!.id };
  }

  throw Object.assign(new Error(`Unsupported operationType: ${operationType}`), { code: "UNSUPPORTED_OPERATION" });
}

export async function registerSyncRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/field-sync/envelopes", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Field sync unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext;
    try { auth = await authenticate(request, pool); if (!auth) return reply.code(401).send(bearerChallenge()); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); }
    const validation = validateSyncEnvelope(bodyOf(request));
    if (!validation.ok) return reply.code(400).send({ error: validation.error, code: validation.code });
    const { idempotencyKey, deviceId, capturedAt, clientSequence, payload } = validation;
    try {
      const device = await requireFieldDevice(pool, auth, deviceId);
      if (!device) return reply.code(403).send({ error: "Field device is not verified for this identity", code: "DEVICE_FORBIDDEN" });
      const hash = payloadHash(payload), client = await pool.connect();
      try {
        await client.query("BEGIN");
        const replay = await client.query<{ id: string; status: string; payload_hash: string; server_cursor: string | null; applied_entity_type: string | null; applied_entity_id: string | null }>(`select id, status, payload_hash, server_cursor, applied_entity_type, applied_entity_id from field_sync_envelopes where device_id = $1 and idempotency_key = $2 for update`, [deviceId, idempotencyKey]);
        if (replay.rows[0]) {
          const existing = replay.rows[0];
          if (existing.payload_hash !== hash) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "Idempotency key was already used with a different payload", code: "IDEMPOTENCY_CONFLICT" }); }
          await client.query("COMMIT"); return reply.code(200).send({ source: "postgresql", syntheticData: false, replay: true, envelope: existing });
        }
        const sequenceReplay = await client.query<{ id: string; idempotency_key: string; payload_hash: string; status: string; server_cursor: string | null }>(`select id, idempotency_key, payload_hash, status, server_cursor from field_sync_envelopes where device_id = $1 and client_sequence = $2 for update`, [deviceId, clientSequence]);
        if (sequenceReplay.rows[0]) {
          const existing = sequenceReplay.rows[0];
          if (existing.payload_hash === hash && existing.idempotency_key === idempotencyKey) { await client.query("COMMIT"); return reply.code(200).send({ source: "postgresql", syntheticData: false, replay: true, envelope: existing }); }
          const conflict = await client.query(`insert into field_sync_conflicts (envelope_id, entity_type, conflict_type, client_version, resolution_status) values ($1, 'field_sync_envelope', 'CLIENT_SEQUENCE_COLLISION', $2, 'OPEN') returning id`, [existing.id, JSON.stringify({ idempotencyKey, clientSequence, payloadHash: hash })]);
          const conflictRow = conflict.rows[0];
          if (!conflictRow) { await client.query("ROLLBACK"); throw new Error("Conflict record was not created"); }
          await client.query("COMMIT"); return reply.code(409).send({ source: "postgresql", syntheticData: false, code: "CLIENT_SEQUENCE_CONFLICT", conflictId: conflictRow.id, envelopeId: existing.id });
        }
        const serverCursor = await nextServerCursor(client, deviceId);
        const inserted = await client.query<{ id: string; status: string; server_cursor: number; received_at: string }>(`insert into field_sync_envelopes (device_id, identity_id, idempotency_key, client_sequence, captured_at, payload, payload_hash, server_cursor) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, status, server_cursor, received_at`, [deviceId, auth.identityId, idempotencyKey, clientSequence, capturedAt, payload, hash, serverCursor]);
        const insertedRow = inserted.rows[0];
        if (!insertedRow) { await client.query("ROLLBACK"); throw new Error("Sync envelope was not created"); }
        await client.query("update field_devices set last_seen_at = now() where id = $1", [deviceId]);
        await client.query("COMMIT"); return reply.code(202).send({ source: "postgresql", syntheticData: false, replay: false, authoritativeMutation: false, envelope: insertedRow });
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Field sync intake unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/field-sync/envelopes/:envelopeId/apply", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Field sync unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext;
    try { auth = await authenticate(request, pool); if (!auth) return reply.code(401).send(bearerChallenge()); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); }
    const { envelopeId } = request.params as { envelopeId: string };
    if (!isUuid(envelopeId)) return reply.code(400).send({ error: "envelopeId must be a UUID", code: "INVALID_ENVELOPE" });
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const envelope = await client.query<{ id: string; identity_id: string; status: string; payload: OperationPayload; applied_entity_type: string | null; applied_entity_id: string | null }>(`select id, identity_id, status, payload, applied_entity_type, applied_entity_id from field_sync_envelopes where id = $1 for update`, [envelopeId]);
        const row = envelope.rows[0];
        if (!row || row.identity_id !== auth.identityId) { await client.query("ROLLBACK"); return reply.code(404).send({ error: "Sync envelope not found for authenticated identity", code: "ENVELOPE_NOT_FOUND" }); }
        if (row.status === "APPLIED") { await client.query("COMMIT"); return reply.code(200).send({ source: "postgresql", syntheticData: false, replay: true, authoritativeMutation: true, entityType: row.applied_entity_type, entityId: row.applied_entity_id }); }
        if (row.status !== "RECEIVED") { await client.query("ROLLBACK"); return reply.code(409).send({ error: `Envelope cannot be applied from status ${row.status}`, code: "ENVELOPE_NOT_APPLICABLE" }); }
        const applied = await applyOperation(client, auth.identityId, row.payload);
        await client.query(`update field_sync_envelopes set status = 'APPLIED', applied_at = now(), applied_entity_type = $2, applied_entity_id = $3 where id = $1`, [envelopeId, applied.entityType, applied.entityId]);
        await client.query("COMMIT");
        return reply.code(200).send({ source: "postgresql", syntheticData: false, replay: false, authoritativeMutation: true, envelopeId, entityType: applied.entityType, entityId: applied.entityId });
      } catch (error) {
        await client.query("ROLLBACK");
        const code = (error as { code?: string }).code;
        if (code === "INVALID_OPERATION" || code === "UNSUPPORTED_OPERATION") return reply.code(400).send({ error: (error as Error).message, code });
        if (code === "OPERATION_FORBIDDEN") return reply.code(403).send({ error: (error as Error).message, code });
        request.log.error(error); return reply.code(503).send({ error: "Authoritative operation application unavailable", syntheticData: false });
      } finally { client.release(); }
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Field sync application unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/field-sync/conflicts", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Field sync unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext;
    try { auth = await authenticate(request, pool); if (!auth) return reply.code(401).send(bearerChallenge()); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); }
    try {
      const result = await pool.query(`select c.id, c.envelope_id, c.entity_type, c.entity_id, c.conflict_type, c.authoritative_version, c.client_version, c.resolution_status, c.resolution_reason, c.resolved_by_identity_id, c.resolved_at, c.created_at from field_sync_conflicts c join field_sync_envelopes e on e.id = c.envelope_id where e.identity_id = $1 order by c.created_at desc`, [auth.identityId]);
      return { source: "postgresql", syntheticData: false, conflicts: result.rows };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Field sync conflicts unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/field-sync/conflicts/:conflictId/resolve", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Field sync unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext;
    try { auth = await authenticate(request, pool); if (!auth) return reply.code(401).send(bearerChallenge()); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); }
    const { conflictId } = request.params as { conflictId: string };
    if (!isUuid(conflictId)) return reply.code(400).send({ error: "conflictId must be a UUID", code: "INVALID_CONFLICT" });
    const validation = validateConflictResolution(bodyOf(request));
    if (!validation.ok) return reply.code(400).send({ error: validation.error, code: validation.code });
    try {
      const result = await pool.query(`update field_sync_conflicts c set resolution_status = $2, resolution_reason = $3, resolved_by_identity_id = $4, resolved_at = now() where c.id = $1 and c.resolution_status = 'OPEN' and exists (select 1 from field_sync_envelopes e where e.id = c.envelope_id and e.identity_id = $4) returning c.id, c.envelope_id, c.resolution_status, c.resolution_reason, c.resolved_by_identity_id, c.resolved_at`, [conflictId, validation.resolutionStatus, validation.resolutionReason, auth.identityId]);
      if (!result.rows[0]) return reply.code(404).send({ error: "Open conflict not found for authenticated identity", code: "CONFLICT_NOT_FOUND" });
      return reply.code(200).send({ source: "postgresql", syntheticData: false, authoritativeMutation: false, conflict: result.rows[0] });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Conflict resolution unavailable", syntheticData: false }); }
  });
}
