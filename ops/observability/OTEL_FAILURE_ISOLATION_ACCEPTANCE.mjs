#!/usr/bin/env node

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
