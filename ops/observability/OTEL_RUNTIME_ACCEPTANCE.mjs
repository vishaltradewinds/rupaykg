#!/usr/bin/env node
import { randomBytes } from "node:crypto";

const baseUrl = process.env.RUPAYKG_BASE_URL?.replace(/\/$/, "");
const token = process.env.RUPAYKG_BEARER_TOKEN;
const organizationId = process.env.RUPAYKG_ORGANIZATION_ID;

if (!baseUrl || !token || !organizationId) {
  throw new Error("RUPAYKG_BASE_URL, RUPAYKG_BEARER_TOKEN and RUPAYKG_ORGANIZATION_ID are required");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init = {}) {
  const response = await fetch(baseUrl + path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "x-rupaykg-organization-id": organizationId,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  return { response, body, text };
}

const traceId = randomBytes(16).toString("hex");
const parentSpanId = randomBytes(8).toString("hex");
const traceparent = `00-${traceId}-${parentSpanId}-01`;

const health = await fetch(baseUrl + "/health");
assert(health.status === 200, `/health returned ${health.status}`);
assert(health.headers.get("x-rupaykg-trace-id") === undefined, "health trace header is intentionally absent on uninstrumented fetch");
const healthBody = await health.json();
assert(healthBody.syntheticData === false, "health endpoint must declare syntheticData=false");

const status = await fetch(baseUrl + "/api/v1/status");
assert(status.status === 200, `/api/v1/status returned ${status.status}`);
const statusBody = await status.json();
assert(statusBody.sourceOfTruth === "postgresql", "status must declare PostgreSQL as source of truth");
assert(statusBody.syntheticData === false, "status endpoint must declare syntheticData=false");

const correlation = await request("/api/v1/integrations/messages", {
  method: "POST",
  headers: {
    traceparent,
    "x-rupaykg-test-correlation": traceId,
  },
  body: JSON.stringify({
    contractVersion: "1.0",
    integrationId: "otel-runtime-acceptance",
    correlationId: traceId,
    idempotencyKey: `otel-runtime-${traceId}`,
    organizationId,
    direction: "INBOUND",
    kind: "ACCEPTANCE_PROBE",
    occurredAt: new Date().toISOString(),
    sourceSystem: "rupaykg-otel-acceptance",
    targetSystem: "rupaykg",
    schema: "rupaykg.acceptance.probe.v1",
    payload: {
      acceptanceProbe: true,
      traceId,
      syntheticData: false,
    },
  }),
});

assert([200, 202].includes(correlation.response.status),
  `integration acceptance probe returned ${correlation.response.status}: ${correlation.text}`);
assert(correlation.body?.syntheticData === false, "integration response must declare syntheticData=false");
assert(correlation.body?.traceId === traceId, "integration response must preserve the supplied W3C trace identity");
assert(correlation.response.headers.get("x-rupaykg-trace-id") === traceId, "HTTP response must preserve the supplied W3C trace identity");
assert(correlation.body?.authoritativeMutation === false,
  "integration acceptance probe must not mutate authoritative environmental state");

console.log(JSON.stringify({
  event: "rupaykg.otel.runtime.acceptance",
  result: "PASS",
  baseUrl,
  traceId,
  suppliedTraceparent: traceparent,
  health: health.status,
  status: status.status,
  integrationStatus: correlation.response.status,
  authoritativeMutation: false,
  syntheticData: false,
  responseTraceId: correlation.body?.traceId,
  timestamp: new Date().toISOString(),
}));
