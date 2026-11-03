import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import { normalizeEsgMetricMetadata, registerValueRoutes, resolveEsgReportingBoundary } from "./value-routes.js";

const ORG = "123e4567-e89b-42d3-a456-426614174001";
const IDENTITY = "123e4567-e89b-42d3-a456-426614174007";

test("legacy EPR assessment fails closed and does not mutate obligation state", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: IDENTITY }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1 and status = 'VERIFIED'")) {
        return { rows: [{ organization_id: ORG, role_id: "role-1", status: "VERIFIED" }] };
      }
      return { rows: [] };
    }
  } as unknown as Pool;

  const app = Fastify({ logger: false });
  await registerValueRoutes(app, pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/epr/obligations/123e4567-e89b-42d3-a456-426614174004/assess",
      headers: {
        authorization: "Bearer test-session-token",
        "x-rupaykg-organization-id": ORG
      },
      payload: {}
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json().code, "EPR_ASSESSMENT_RECONCILIATION_REQUIRED");
    assert.equal(response.json().productionGate, "HOLD");
    assert.equal(response.json().syntheticData, false);
    assert.ok(!calls.some(({ sql }) => /update\s+(?:public\.)?obligations\b/i.test(sql)), "legacy obligations must not be updated");
    assert.ok(!calls.some(({ sql }) => /update\s+epr_obligations\b/i.test(sql)), "EPR obligations must not be updated");
    assert.equal(calls.length, 2, "only session and verified-membership authentication queries should run");
  } finally {
    await app.close();
  }
});

test("ESG assurance metadata is stored as an unverified declaration", () => {
  const normalized = normalizeEsgMetricMetadata({
    disclosureId: "BRSR-TEST",
    assuranceStatus: "ASSURED",
    assurance_status: "ASSESSED",
    declaredAssuranceStatus: "FORGED",
    declared_assurance_status: "FORGED_SNAKE",
    methodology: "declared methodology"
  });

  assert.equal(normalized.assuranceStatus, "DECLARED_UNVERIFIED");
  assert.equal(normalized.declaredAssuranceStatus, "ASSURED");
  assert.equal(normalized.disclosureId, "BRSR-TEST");
  assert.equal(normalized.methodology, "declared methodology");
  assert.equal("assurance_status" in normalized, false);
  assert.equal("declared_assurance_status" in normalized, false);
});


test("ESG reporting boundary is required and normalized before metric writes", async () => {
  assert.equal(resolveEsgReportingBoundary(null), null);
  assert.equal(resolveEsgReportingBoundary("   "), null);
  assert.equal(resolveEsgReportingBoundary("  Organization operations, India  "), "Organization operations, India");

  const calls: string[] = [];
  const pool = {
    query: async (sql: string) => {
      calls.push(sql);
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: IDENTITY }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1 and status = 'VERIFIED'")) {
        return { rows: [{ organization_id: ORG, role_id: "role-1", status: "VERIFIED" }] };
      }
      if (sql.includes("from esg_reporting_periods")) return { rows: [{ organization_id: ORG, reporting_boundary: null }] };
      if (sql.includes("can_write_esg")) return { rows: [{ ok: true }] };
      return { rows: [] };
    }
  } as unknown as Pool;

  const app = Fastify({ logger: false });
  await registerValueRoutes(app, pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/esg/reporting-periods/123e4567-e89b-42d3-a456-426614174009/metrics",
      headers: {
        authorization: "Bearer test-session-token",
        "x-rupaykg-organization-id": ORG
      },
      payload: { metricCode: "ENERGY_TEST", scope: "2", unit: "kWh", value: 10 }
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json().code, "ESG_REPORTING_BOUNDARY_REQUIRED");
    assert.equal(response.json().productionGate, "HOLD");
    assert.ok(!calls.some((sql) => /insert into esg_metrics/i.test(sql)), "metrics must not be written without a declared reporting boundary");
  } finally {
    await app.close();
  }
});


test("ESG boundary validation does not disclose another organization's period configuration", async () => {
  const OTHER_ORG = "123e4567-e89b-42d3-a456-426614174099";
  const calls: string[] = [];
  const pool = {
    query: async (sql: string) => {
      calls.push(sql);
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: IDENTITY }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1 and status = 'VERIFIED'")) {
        return { rows: [{ organization_id: ORG, role_id: "role-1", status: "VERIFIED" }] };
      }
      if (sql.includes("from esg_reporting_periods")) return { rows: [{ organization_id: OTHER_ORG, reporting_boundary: null }] };
      return { rows: [] };
    }
  } as unknown as Pool;

  const app = Fastify({ logger: false });
  await registerValueRoutes(app, pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/esg/reporting-periods/123e4567-e89b-42d3-a456-426614174009/metrics",
      headers: {
        authorization: "Bearer test-session-token",
        "x-rupaykg-organization-id": ORG
      },
      payload: { metricCode: "ENERGY_TEST", scope: "2", unit: "kWh", value: 10 }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "ORG_FORBIDDEN");
    assert.ok(!calls.some((sql) => /can_write_esg/i.test(sql)), "unauthorized callers must not reach boundary-specific write validation");
  } finally {
    await app.close();
  }
});
