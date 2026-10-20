import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerAsyncMirrorRoutes, verifyGovBridgeSignature } from "./async-mirror-routes.js";

const secret = "test-only-secret-with-at-least-thirty-two-characters";
const now = Date.parse("2026-10-19T10:00:00Z");
const timestamp = String(now);

function signedHeaders(body: unknown, secretValue = secret, timestampValue = timestamp) {
  const serialized = JSON.stringify(body);
  const signature = "sha256=" + createHmac("sha256", secretValue)
    .update(timestampValue + "." + serialized, "utf8").digest("hex");
  return {
    "content-type": "application/json",
    "x-rupaykg-timestamp": timestampValue,
    "x-rupaykg-signature": signature,
  };
}

function validBatch(batchId = "b5e74bb0-b3a1-4fd7-ae67-c3c2a68d56ab") {
  return {
    batchMetadata: {
      authorityCode: "MH-PCB",
      municipalCode: "MCGM-MUM",
      syncWindowTimestamp: "2026-10-19T02:30:00Z",
      batchId,
    },
    rawDataLogs: ["Waste collection record from authorized source"],
  };
}

async function withRoute(
  pool: Pool | null,
  run: (app: ReturnType<typeof Fastify>) => Promise<void>,
) {
  const app = Fastify();
  await registerAsyncMirrorRoutes(app, pool);
  try {
    await run(app);
  } finally {
    await app.close();
  }
}

test("accepts a valid timestamp-bound HMAC signature", () => {
  const body = JSON.stringify({ batchMetadata: { authorityCode: "MH-PCB" }, rawDataLogs: ["sample record"] });
  const signature = "sha256=" + createHmac("sha256", secret).update(timestamp + "." + body, "utf8").digest("hex");
  assert.equal(verifyGovBridgeSignature(secret, timestamp, signature, body, now), true);
});

test("rejects invalid signatures and altered payloads", () => {
  const body = JSON.stringify({ batchMetadata: { authorityCode: "MH-PCB" }, rawDataLogs: ["sample record"] });
  const signature = "sha256=" + createHmac("sha256", secret).update(timestamp + "." + body, "utf8").digest("hex");
  assert.equal(verifyGovBridgeSignature(secret, timestamp, signature, body + " ", now), false);
  assert.equal(verifyGovBridgeSignature(secret, timestamp, "sha256=" + "0".repeat(64), body, now), false);
});

test("rejects stale timestamps, weak secrets and malformed headers", () => {
  const body = "{}";
  const signature = "sha256=" + createHmac("sha256", secret).update(timestamp + "." + body, "utf8").digest("hex");
  assert.equal(verifyGovBridgeSignature(secret, String(now - 600_000), signature, body, now), false);
  assert.equal(verifyGovBridgeSignature("short", timestamp, signature, body, now), false);
  assert.equal(verifyGovBridgeSignature(secret, "not-a-timestamp", signature, body, now), false);
  assert.equal(verifyGovBridgeSignature(secret, timestamp, undefined, body, now), false);
});

test("registered inbox route fails closed when database is unavailable", async () => {
  await withRoute(null, async (app) => {
    const response = await app.inject({ method: "POST", url: "/api/v1/bridge/gov/inbox", payload: validBatch() });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, "DATABASE_UNAVAILABLE");
  });
});

test("registered inbox route rejects missing configuration and invalid signatures", async () => {
  const previousSecret = process.env.RUPAYKG_GOV_BRIDGE_HMAC_SECRET;
  const previousCodes = process.env.RUPAYKG_GOV_BRIDGE_AUTHORITY_CODES;
  process.env.RUPAYKG_GOV_BRIDGE_HMAC_SECRET = "";
  process.env.RUPAYKG_GOV_BRIDGE_AUTHORITY_CODES = "MH-PCB";
  try {
    await withRoute({ query: async () => ({ rows: [] }) } as unknown as Pool, async (app) => {
      const body = validBatch();
      const notConfigured = await app.inject({ method: "POST", url: "/api/v1/bridge/gov/inbox", payload: body });
      assert.equal(notConfigured.statusCode, 503);
      assert.equal(notConfigured.json().code, "GOV_BRIDGE_NOT_CONFIGURED");
    });

    process.env.RUPAYKG_GOV_BRIDGE_HMAC_SECRET = secret;
    await withRoute({ query: async () => ({ rows: [] }) } as unknown as Pool, async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/bridge/gov/inbox",
        headers: { "content-type": "application/json", "x-rupaykg-timestamp": timestamp, "x-rupaykg-signature": "sha256=" + "0".repeat(64) },
        payload: validBatch(),
      });
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().code, "GOV_BRIDGE_SIGNATURE_INVALID");
    });
  } finally {
    if (previousSecret === undefined) delete process.env.RUPAYKG_GOV_BRIDGE_HMAC_SECRET;
    else process.env.RUPAYKG_GOV_BRIDGE_HMAC_SECRET = previousSecret;
    if (previousCodes === undefined) delete process.env.RUPAYKG_GOV_BRIDGE_AUTHORITY_CODES;
    else process.env.RUPAYKG_GOV_BRIDGE_AUTHORITY_CODES = previousCodes;
  }
});

test("registered inbox route allow-lists authority and persists accepted batches as non-authoritative intake", async () => {
  const previousSecret = process.env.RUPAYKG_GOV_BRIDGE_HMAC_SECRET;
  const previousCodes = process.env.RUPAYKG_GOV_BRIDGE_AUTHORITY_CODES;
  process.env.RUPAYKG_GOV_BRIDGE_HMAC_SECRET = secret;
  process.env.RUPAYKG_GOV_BRIDGE_AUTHORITY_CODES = "MPPCB";
  let queryCount = 0;
  const pool = {
    query: async () => {
      queryCount += 1;
      return { rows: [{ id: "b5e74bb0-b3a1-4fd7-ae67-c3c2a68d56ab", payload_sha256: "0".repeat(64) }] };
    },
  } as unknown as Pool;
  try {
    await withRoute(pool, async (app) => {
      const body = validBatch();
      const denied = await app.inject({ method: "POST", url: "/api/v1/bridge/gov/inbox", headers: signedHeaders(body), payload: body });
      assert.equal(denied.statusCode, 403);
      assert.equal(denied.json().code, "GOV_BRIDGE_AUTHORITY_FORBIDDEN");
      assert.equal(queryCount, 0);
    });

    process.env.RUPAYKG_GOV_BRIDGE_AUTHORITY_CODES = "MH-PCB";
    const serialized = JSON.stringify(validBatch());
    const payloadHash = await import("node:crypto").then(({ createHash }) => createHash("sha256").update(serialized, "utf8").digest("hex"));
    const acceptingPool = {
      query: async () => ({ rows: [{ id: "7f3f9b26-4d15-4f4f-8ed4-0c94e2e6b5f1", payload_sha256: payloadHash }] }),
    } as unknown as Pool;
    await withRoute(acceptingPool, async (app) => {
      const body = validBatch();
      const response = await app.inject({ method: "POST", url: "/api/v1/bridge/gov/inbox", headers: signedHeaders(body), payload: body });
      assert.equal(response.statusCode, 202);
      assert.equal(response.json().status, "RECEIVED_FOR_ASYNCHRONOUS_PROCESSING");
      assert.equal(response.json().sourceDatabaseWrite, false);
      assert.equal(response.json().authoritativeMrvMutation, false);
      assert.equal(response.json().aiProcessingStarted, false);
      assert.equal(response.json().guardianSubmission, false);
    });
  } finally {
    if (previousSecret === undefined) delete process.env.RUPAYKG_GOV_BRIDGE_HMAC_SECRET;
    else process.env.RUPAYKG_GOV_BRIDGE_HMAC_SECRET = previousSecret;
    if (previousCodes === undefined) delete process.env.RUPAYKG_GOV_BRIDGE_AUTHORITY_CODES;
    else process.env.RUPAYKG_GOV_BRIDGE_AUTHORITY_CODES = previousCodes;
  }
});
