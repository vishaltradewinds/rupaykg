#!/usr/bin/env node
import { randomBytes } from "node:crypto";

const baseUrl = process.env.RUPAYKG_BASE_URL?.replace(/\/$/, "");
const token = process.env.RUPAYKG_BEARER_TOKEN;
const organizationId = process.env.RUPAYKG_ORGANIZATION_ID;

if (!baseUrl || !token || !organizationId) {
  throw new Error("RUPAYKG_BASE_URL, RUPAYKG_BEARER_TOKEN and RUPAYKG_ORGANIZATION_ID are required");
}

const response = await fetch(baseUrl + "/health", {
  headers: {
    authorization: `Bearer ${token}`,
    "x-rupaykg-organization-id": organizationId,
  },
});

if (response.status !== 200) {
  throw new Error(`/health returned ${response.status}; telemetry-failure acceptance cannot proceed`);
}

const traceId = response.headers.get("x-rupaykg-trace-id");
if (!traceId || !/^[0-9a-f]{32}$/.test(traceId)) {
  throw new Error("health response did not expose a valid RupayKg trace correlation id");
}

const id = `otel-failure-isolation-${Date.now()}-${randomBytes(8).toString("hex")}`;\nconst parentSpanId = randomBytes(8).toString("hex");
const integrationResponse = await fetch(baseUrl + "/api/v1/integrations/messages", {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-rupaykg-organization-id": organizationId,
    traceparent: `00-${traceId}-${parentSpanId}-01`,
  },
  body: JSON.stringify({
    contractVersion: "1.0",
    integrationId: "otel-failure-isolation-acceptance",
    correlationId: id,
    idempotencyKey: id,
    organizationId,
    direction: "INBOUND",
    kind: "OBSERVATION",
    occurredAt: new Date().toISOString(),
    sourceSystem: "rupaykg-acceptance",
    targetSystem: "rupaykg",
    schema: "urn:rupaykg:acceptance:otel-failure-isolation:1",
    payload: { acceptance: true, authoritativeEnvironmentalMutation: false },
  }),
});
const integrationBody = await integrationResponse.json();
if (![200, 202].includes(integrationResponse.status) || integrationBody.syntheticData !== false || integrationBody.authoritativeMutation !== true || integrationBody.authoritativeEnvironmentalMutation !== false) {
  throw new Error(`integration acceptance transaction failed: HTTP ${integrationResponse.status}`);
}
if (integrationBody.traceId !== traceId || integrationResponse.headers.get("x-rupaykg-trace-id") !== traceId) {
  throw new Error("integration response trace correlation did not preserve the supplied trace identity");
}

const body = await response.json();
if (body.syntheticData !== false || body.database !== "AVAILABLE") {
  throw new Error("health did not prove a live PostgreSQL-backed service");
}

console.log(JSON.stringify({
  event: "rupaykg.otel.failure_isolation.runtime.acceptance",
  result: "PASS",
  limitation: "This probe proves application availability only; collector outage injection and transaction-level evidence require deployment control over the OTLP collector.",
  health: response.status,
  database: body.database,
  syntheticData: body.syntheticData,
  timestamp: new Date().toISOString(),
}));
