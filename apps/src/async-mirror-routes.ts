import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

const MAX_BATCH_BYTES = 1024 * 1024;
const MAX_RECORDS = 1000;
const MAX_RECORD_CHARS = 20_000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^[A-Z0-9][A-Z0-9._-]{1,79}$/;

type BridgeBatch = {
  batchMetadata: {
    authorityCode: string;
    municipalCode: string;
    syncWindowTimestamp: string;
    batchId: string;
  };
  rawDataLogs: string[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseBatch(value: unknown): BridgeBatch | null {
  if (!isObject(value) || !isObject(value.batchMetadata) || !Array.isArray(value.rawDataLogs)) return null;
  if (Object.keys(value).some((key) => !["batchMetadata", "rawDataLogs"].includes(key))) return null;
  const metadata = value.batchMetadata;
  if (Object.keys(metadata).some((key) => !["authorityCode", "municipalCode", "syncWindowTimestamp", "batchId"].includes(key))) return null;
  const authorityCode = typeof metadata.authorityCode === "string" ? metadata.authorityCode.trim().toUpperCase() : "";
  const municipalCode = typeof metadata.municipalCode === "string" ? metadata.municipalCode.trim().toUpperCase() : "";
  const syncWindowTimestamp = typeof metadata.syncWindowTimestamp === "string" ? metadata.syncWindowTimestamp : "";
  const batchId = typeof metadata.batchId === "string" ? metadata.batchId : "";
  const timestamp = Date.parse(syncWindowTimestamp);
  if (!CODE.test(authorityCode) || !CODE.test(municipalCode) || !UUID.test(batchId)
    || !Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 7 * 24 * 60 * 60 * 1000
    || value.rawDataLogs.length < 1 || value.rawDataLogs.length > MAX_RECORDS) return null;
  const rawDataLogs = value.rawDataLogs;
  if (!rawDataLogs.every((entry) => typeof entry === "string" && entry.trim().length >= 5
    && entry.length <= MAX_RECORD_CHARS && !entry.includes("\u0000"))) return null;
  return { batchMetadata: { authorityCode, municipalCode, syncWindowTimestamp, batchId }, rawDataLogs: rawDataLogs as string[] };
}

export function verifyGovBridgeSignature(
  secret: string,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
  serializedBody: string,
  now = Date.now(),
): boolean {
  if (secret.length < 32 || !timestampHeader || !signatureHeader || !/^\d{10,13}$/.test(timestampHeader)) return false;
  const timestampNumber = Number(timestampHeader);
  const timestampMs = timestampHeader.length === 10 ? timestampNumber * 1000 : timestampNumber;
  if (!Number.isSafeInteger(timestampMs) || Math.abs(now - timestampMs) > MAX_CLOCK_SKEW_MS) return false;
  const suppliedHex = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : "";
  if (!/^[0-9a-f]{64}$/i.test(suppliedHex)) return false;
  const expected = createHmac("sha256", secret).update(timestampHeader + "." + serializedBody, "utf8").digest();
  const supplied = Buffer.from(suppliedHex, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

type AuthorityCredential = { secret: string; municipalCodes: string[] };

function parseAuthorityCredentials(value: string): Record<string, AuthorityCredential> | null {
  if (!value.trim()) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return null; }
  if (!isObject(parsed) || !Object.keys(parsed).length) return null;

  const credentials: Record<string, AuthorityCredential> = Object.create(null) as Record<string, AuthorityCredential>;
  for (const [rawCode, rawCredential] of Object.entries(parsed)) {
    const authorityCode = rawCode.trim().toUpperCase();
    if (!CODE.test(authorityCode) || !isObject(rawCredential)
      || Object.keys(rawCredential).some((key) => !["secret", "municipalCodes"].includes(key))) return null;
    const secret = typeof rawCredential.secret === "string" ? rawCredential.secret : "";
    const rawMunicipalCodes = rawCredential.municipalCodes;
    if (secret.length < 32 || !Array.isArray(rawMunicipalCodes) || rawMunicipalCodes.length < 1
      || !rawMunicipalCodes.every((code) => typeof code === "string" && CODE.test(code.trim().toUpperCase()))) return null;
    if (credentials[authorityCode]) return null;
    credentials[authorityCode] = {
      secret,
      municipalCodes: [...new Set(rawMunicipalCodes.map((code) => String(code).trim().toUpperCase()))],
    };
  }
  return credentials;
}

function claimedAuthorityCode(value: unknown): string | null {
  if (!isObject(value) || !isObject(value.batchMetadata)) return null;
  const code = value.batchMetadata.authorityCode;
  return typeof code === "string" && CODE.test(code.trim().toUpperCase()) ? code.trim().toUpperCase() : null;
}

export async function registerAsyncMirrorRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/bridge/gov/inbox", { bodyLimit: 1400 * 1024 }, async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Bridge inbox unavailable", code: "DATABASE_UNAVAILABLE" });
    const credentials = parseAuthorityCredentials(process.env.RUPAYKG_GOV_BRIDGE_AUTHORITY_CREDENTIALS ?? "");
    if (!credentials) return reply.code(503).send({ error: "Authority-specific government bridge credentials are not configured correctly", code: "GOV_BRIDGE_NOT_CONFIGURED" });

    const timestampHeader = request.headers["x-rupaykg-timestamp"];
    const signatureHeader = request.headers["x-rupaykg-signature"];
    const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const serializedBody = JSON.stringify(request.body ?? null);
    if (Buffer.byteLength(serializedBody, "utf8") > MAX_BATCH_BYTES) {
      return reply.code(413).send({ error: "Bridge batch exceeds 1 MiB", code: "GOV_BRIDGE_BATCH_TOO_LARGE" });
    }

    const authorityCode = claimedAuthorityCode(request.body);
    const credential = authorityCode ? credentials[authorityCode] : undefined;
    if (!credential || !verifyGovBridgeSignature(credential.secret, timestamp, signature, serializedBody)) {
      return reply.code(401).send({ error: "Invalid or expired bridge signature", code: "GOV_BRIDGE_SIGNATURE_INVALID" });
    }

    const batch = parseBatch(request.body);
    if (!batch) return reply.code(400).send({ error: "Bridge batch schema is invalid", code: "GOV_BRIDGE_BATCH_INVALID" });
    if (!credential.municipalCodes.includes(batch.batchMetadata.municipalCode)) {
      return reply.code(403).send({ error: "Municipal code is outside this authority credential's permitted scope", code: "GOV_BRIDGE_MUNICIPAL_SCOPE_FORBIDDEN" });
    }

    const payloadSha256 = createHash("sha256").update(serializedBody, "utf8").digest("hex");
    try {
      const inserted = await pool.query<{ id: string; payload_sha256: string }>(
        `insert into async_mirror_inbox
          (authority_code, municipal_code, batch_id, sync_window_timestamp, payload, payload_sha256)
         values ($1,$2,$3,$4,$5::jsonb,$6)
         on conflict (authority_code, batch_id) do nothing
         returning id, payload_sha256`,
        [batch.batchMetadata.authorityCode, batch.batchMetadata.municipalCode, batch.batchMetadata.batchId,
          batch.batchMetadata.syncWindowTimestamp, JSON.stringify(batch), payloadSha256],
      );
      if (inserted.rows[0]) {
        return reply.code(202).send({
          status: "RECEIVED_FOR_ASYNCHRONOUS_PROCESSING",
          queueId: inserted.rows[0].id,
          batchId: batch.batchMetadata.batchId,
          payloadSha256,
          sourceDatabaseWrite: false,
          authoritativeMrvMutation: false,
          aiProcessingStarted: false,
          guardianSubmission: false,
        });
      }

      const existing = await pool.query<{ id: string; payload_sha256: string; status: string }>(
        "select id, payload_sha256, status from async_mirror_inbox where authority_code=$1 and batch_id=$2",
        [batch.batchMetadata.authorityCode, batch.batchMetadata.batchId],
      );
      const row = existing.rows[0];
      if (!row) return reply.code(503).send({ error: "Unable to resolve idempotent bridge batch", code: "GOV_BRIDGE_INBOX_UNAVAILABLE" });
      if (row.payload_sha256 !== payloadSha256) {
        return reply.code(409).send({ error: "Batch ID was already used with different content", code: "GOV_BRIDGE_BATCH_ID_REUSED" });
      }
      return reply.code(202).send({
        status: row.status,
        queueId: row.id,
        batchId: batch.batchMetadata.batchId,
        payloadSha256,
        replay: true,
        sourceDatabaseWrite: false,
        authoritativeMrvMutation: false,
        aiProcessingStarted: false,
        guardianSubmission: false,
      });
    } catch (error) {
      request.log.error({ errorType: error instanceof Error ? error.name : "unknown" }, "Asynchronous mirror inbox persistence failed");
      return reply.code(503).send({ error: "Bridge inbox persistence unavailable", code: "GOV_BRIDGE_INBOX_UNAVAILABLE" });
    }
  });
}
