import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, bearerChallenge } from "./auth.js";

type AuthContext = Awaited<ReturnType<typeof authenticate>>;
type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };

type EnvelopeInput = {
  idempotencyKey?: unknown;
  deviceId?: unknown;
  clientSequence?: unknown;
  capturedAt?: unknown;
  payload?: unknown;
};

function bodyOf(request: { body: unknown }): Record<string, unknown> {
  return (request.body && typeof request.body === "object" ? request.body : {}) as Record<string, unknown>;
}
function requiredString(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function payloadHash(payload: unknown): string { return createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }

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

export async function registerSyncRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/field-sync/envelopes", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Field sync unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext;
    try { auth = await authenticate(request, pool); if (!auth) return reply.code(401).send(bearerChallenge()); }
    catch (error) { request.log.error(error); return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); }
    const body = bodyOf(request) as EnvelopeInput;
    const idempotencyKey = requiredString(body.idempotencyKey), deviceId = requiredString(body.deviceId), capturedAt = requiredString(body.capturedAt);
    const clientSequence = Number(body.clientSequence);
    if (!idempotencyKey || !deviceId || !capturedAt || !Number.isSafeInteger(clientSequence) || clientSequence < 1 || body.payload === undefined) return reply.code(400).send({ error: "idempotencyKey, deviceId, positive integer clientSequence, capturedAt and payload are required", code: "INVALID_ENVELOPE" });
    if (!isUuid(deviceId)) return reply.code(400).send({ error: "deviceId must be a field device UUID", code: "INVALID_DEVICE" });
    if (Number.isNaN(Date.parse(capturedAt))) return reply.code(400).send({ error: "capturedAt must be an ISO date", code: "INVALID_CAPTURE_TIME" });
    if (body.payload === null || typeof body.payload !== "object") return reply.code(400).send({ error: "payload must be a JSON object or array", code: "INVALID_PAYLOAD" });
    try {
      const device = await requireFieldDevice(pool, auth, deviceId);
      if (!device) return reply.code(403).send({ error: "Field device is not verified for this identity", code: "DEVICE_FORBIDDEN" });
      const hash = payloadHash(body.payload), client = await pool.connect();
      try {
        await client.query("BEGIN");
        const replay = await client.query<{ id: string; status: string; payload_hash: string; server_cursor: string | null }>(`select id, status, payload_hash, server_cursor from field_sync_envelopes where device_id = $1 and idempotency_key = $2 for update`, [deviceId, idempotencyKey]);
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
          await client.query("COMMIT"); return reply.code(409).send({ source: "postgresql", syntheticData: false, code: "CLIENT_SEQUENCE_CONFLICT", conflictId: conflict.rows[0].id, envelopeId: existing.id });
        }
        const serverCursor = await nextServerCursor(client, deviceId);
        const inserted = await client.query<{ id: string; status: string; server_cursor: number; received_at: string }>(`insert into field_sync_envelopes (device_id, identity_id, idempotency_key, client_sequence, captured_at, payload, payload_hash, server_cursor) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, status, server_cursor, received_at`, [deviceId, auth.identityId, idempotencyKey, clientSequence, capturedAt, body.payload, hash, serverCursor]);
        await client.query("update field_devices set last_seen_at = now() where id = $1", [deviceId]);
        await client.query("COMMIT"); return reply.code(202).send({ source: "postgresql", syntheticData: false, replay: false, authoritativeMutation: false, envelope: inserted.rows[0] });
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Field sync intake unavailable", syntheticData: false }); }
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
    const body = bodyOf(request);
    const resolutionStatus = requiredString(body.resolutionStatus);
    const reason = requiredString(body.resolutionReason);
    if (!isUuid(conflictId) || !resolutionStatus || !["RESOLVED", "REJECTED"].includes(resolutionStatus) || !reason) return reply.code(400).send({ error: "conflictId, resolutionStatus RESOLVED|REJECTED and resolutionReason are required", code: "INVALID_RESOLUTION" });
    try {
      const result = await pool.query(`update field_sync_conflicts c set resolution_status = $2, resolution_reason = $3, resolved_by_identity_id = $4, resolved_at = now() where c.id = $1 and c.resolution_status = 'OPEN' and exists (select 1 from field_sync_envelopes e where e.id = c.envelope_id and e.identity_id = $4) returning c.id, c.envelope_id, c.resolution_status, c.resolution_reason, c.resolved_by_identity_id, c.resolved_at`, [conflictId, resolutionStatus, reason, auth.identityId]);
      if (!result.rows[0]) return reply.code(404).send({ error: "Open conflict not found for authenticated identity", code: "CONFLICT_NOT_FOUND" });
      return reply.code(200).send({ source: "postgresql", syntheticData: false, authoritativeMutation: false, conflict: result.rows[0] });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Conflict resolution unavailable", syntheticData: false }); }
  });
}
