import Fastify from "fastify";
import cors from "@fastify/cors";
import { Pool, type PoolConfig } from "pg";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const databaseUrl = process.env.DATABASE_URL;
const poolConfig: PoolConfig = { connectionString: databaseUrl, max: 10 };
if (process.env.DATABASE_SSL !== "false") poolConfig.ssl = { rejectUnauthorized: false };
const pool = databaseUrl ? new Pool(poolConfig) : null;

async function query<T extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const result = await pool.query<T>(text, values);
  return result.rows;
}

app.get("/health", async (_request, reply) => {
  let database: "AVAILABLE" | "UNAVAILABLE" = "UNAVAILABLE";
  if (pool) {
    try { await pool.query("select 1"); database = "AVAILABLE"; } catch { database = "UNAVAILABLE"; }
  }
  const healthy = database === "AVAILABLE";
  return reply.code(healthy ? 200 : 503).send({ status: healthy ? "READY" : "DEGRADED", database, syntheticData: false });
});

app.get("/api/v1/status", async () => ({
  service: "rupaykg-api",
  version: "0.1.0",
  sourceOfTruth: "postgresql",
  syntheticData: false,
}));

app.get("/api/v1/overview", async (request, reply) => {
  try {
    const [activities, measurements, evidence, verifications, obligations, credentials, settlements] = await Promise.all([
      query<{ count: string }>("select count(*)::text as count from activities"),
      query<{ count: string }>("select count(*)::text as count from measurements"),
      query<{ count: string }>("select count(*)::text as count from evidence"),
      query<{ count: string }>("select count(*)::text as count from verifications where decision = 'APPROVED'"),
      query<{ count: string }>("select count(*)::text as count from obligations where status = 'OPEN'"),
      query<{ count: string }>("select count(*)::text as count from credentials where status in ('ISSUED','ACTIVE','TRANSFERRED','RETIRED')"),
      query<{ count: string }>("select count(*)::text as count from settlements where status = 'SETTLED'"),
    ]);
    return {
      source: "postgresql", syntheticData: false,
      counts: {
        activities: Number(activities[0]?.count ?? 0), measurements: Number(measurements[0]?.count ?? 0),
        evidence: Number(evidence[0]?.count ?? 0), approvedVerifications: Number(verifications[0]?.count ?? 0),
        openObligations: Number(obligations[0]?.count ?? 0), issuedOrActiveCredentials: Number(credentials[0]?.count ?? 0),
        settledTransactions: Number(settlements[0]?.count ?? 0),
      },
    };
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ error: "Authoritative overview unavailable", syntheticData: false });
  }
});

app.get("/api/v1/regulatory/sources", async (request, reply) => {
  try {
    const rows = await query("select id, authority, title, instrument, reference, published_on, effective_from, jurisdiction, source_url, verified_on, status, affected_module, notes from regulatory_sources order by effective_from desc nulls last, published_on desc");
    return { source: "postgresql", syntheticData: false, sources: rows };
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ error: "Regulatory source catalog unavailable", syntheticData: false });
  }
});

app.get("/api/v1/geography/children/:parentId", async (request, reply) => {
  try {
    const { parentId } = request.params as { parentId: string };
    const rows = await query("select id, parent_id, kind, code, external_code, name, source, source_version, valid_from, valid_to, metadata from geography where parent_id = $1 order by name", [parentId]);
    return { source: "postgresql", syntheticData: false, geography: rows };
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ error: "Authoritative geography unavailable", syntheticData: false });
  }
});

app.post("/api/v1/operations/sync", async (request, reply) => {
  const body = request.body as Partial<{
    idempotencyKey: string; actorIdentityId: string; deviceId: string; capturedAt: string;
    sequence: number; payload: Record<string, unknown>; payloadHash: string;
  }> | undefined;
  if (!body?.idempotencyKey || !body.actorIdentityId || !body.deviceId || !body.capturedAt || !body.payload) {
    return reply.code(400).send({ error: "idempotencyKey, actorIdentityId, deviceId, capturedAt and payload are required" });
  }
  if (Number.isNaN(Date.parse(body.capturedAt))) return reply.code(400).send({ error: "capturedAt must be an ISO date" });
  try {
    const existing = await query<{ id: string; status: string }>("select id, status from operation_sync_envelopes where idempotency_key = $1", [body.idempotencyKey]);
    if (existing[0]) return { source: "postgresql", syntheticData: false, replay: true, operation: existing[0] };
    const rows = await query<{ id: string; status: string }>(
      "insert into operation_sync_envelopes (idempotency_key, actor_identity_id, device_id, client_sequence, captured_at, payload, payload_hash) values ($1,$2,$3,$4,$5,$6,$7) returning id, status",
      [body.idempotencyKey, body.actorIdentityId, body.deviceId, body.sequence ?? null, body.capturedAt, body.payload, body.payloadHash ?? null]
    );
    return reply.code(202).send({ source: "postgresql", syntheticData: false, replay: false, operation: rows[0] });
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ error: "Operation intake unavailable", syntheticData: false });
  }
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
await app.listen({ port, host });
