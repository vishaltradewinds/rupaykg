import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerValueRoutes } from "./value-routes.js";

const identityId = "123e4567-e89b-42d3-a456-426614174000";
const organizationId = "223e4567-e89b-42d3-a456-426614174000";
const token = "esg-methodology-test-token";
const tokenHash = createHash("sha256").update(token).digest("hex");

function fakePool(options: { membership?: boolean; canWrite?: boolean; period?: boolean } = {}): Pool {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const pool = {
    queries,
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1")) {
        return { rows: options.membership === false ? [] : [{ organization_id: organizationId, role_id: "323e4567-e89b-42d3-a456-426614174000", status: "VERIFIED" }] };
      }
      if (sql.includes("select organization_id,period_start,framework from esg_reporting_periods")) {
        return { rows: options.period === false ? [] : [{ organization_id: organizationId, period_start: "2026-04-01", framework: "BRSR" }] };
      }
      if (sql.includes("select can_write_esg")) return { rows: [{ ok: options.canWrite !== false }] };
      if (sql.includes("select id,methodology_code,version,effective_from,rules->'esgBinding' as binding")) {
        queries.push({ sql, params });
        return { rows: [
          { id: "method-1", methodology_code: "BRSR-ENERGY", version: "2.0", effective_from: "2026-01-01", binding: { framework: "BRSR", metricCode: "ENERGY", scope: "2", unitCode: "kWh" } },
        ] };
      }
      throw new Error("Unexpected SQL in ESG methodology test: " + sql);
    },
  };
  return pool as unknown as Pool;
}

async function setup(pool: Pool) {
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, pool);
  return app;
}
const headers = { authorization: "Bearer " + token, "x-rupaykg-organization-id": organizationId };

test("ESG methodology lookup rejects missing or invalid exact-match filters", async () => {
  const app = await setup(fakePool());
  const missing = await app.inject({ method: "GET", url: "/api/v1/esg/reporting-periods/period-1/methodology-options", headers });
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.json().code, "ESG_METHODOLOGY_FILTERS_REQUIRED");
  const invalidScope = await app.inject({ method: "GET", url: "/api/v1/esg/reporting-periods/period-1/methodology-options?metricCode=ENERGY&scope=4&unit=kWh", headers });
  assert.equal(invalidScope.statusCode, 400);
  await app.close();
});

test("ESG methodology lookup requires an authenticated session", async () => {
  const app = await setup(fakePool());
  const response = await app.inject({ method: "GET", url: "/api/v1/esg/reporting-periods/period-1/methodology-options?metricCode=ENERGY&scope=2&unit=kWh" });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, "AUTH_REQUIRED");
  await app.close();
});

test("ESG methodology lookup denies users without selected organization membership", async () => {
  const app = await setup(fakePool({ membership: false }));
  const response = await app.inject({ method: "GET", url: "/api/v1/esg/reporting-periods/period-1/methodology-options?metricCode=ENERGY&scope=2&unit=kWh", headers });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("ESG methodology lookup denies users without ESG write permission", async () => {
  const app = await setup(fakePool({ canWrite: false }));
  const response = await app.inject({ method: "GET", url: "/api/v1/esg/reporting-periods/period-1/methodology-options?metricCode=ENERGY&scope=2&unit=kWh", headers });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().code, "ESG_WRITE_FORBIDDEN");
  await app.close();
});

test("ESG methodology lookup returns only exact binding filters and reporting-period effective date", async () => {
  const pool = fakePool();
  const app = await setup(pool);
  const response = await app.inject({ method: "GET", url: "/api/v1/esg/reporting-periods/period-1/methodology-options?metricCode=ENERGY&scope=2&unit=kWh", headers });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().source, "postgresql");
  assert.equal(response.json().syntheticData, false);
  assert.equal(response.json().options.length, 1);
  const query = (pool as unknown as { queries: Array<{ sql: string; params: unknown[] }> }).queries[0];
  assert.ok(query);
  assert.ok(query.sql.includes("effective_from <= $1::date"));
  assert.deepEqual(query.params, ["2026-04-01", "BRSR", "ENERGY", "2", "kWh"]);
  await app.close();
});

test("ESG methodology lookup returns 404 for an unknown reporting period", async () => {
  const app = await setup(fakePool({ period: false }));
  const response = await app.inject({ method: "GET", url: "/api/v1/esg/reporting-periods/missing/methodology-options?metricCode=ENERGY&scope=2&unit=kWh", headers });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().code, "ESG_PERIOD_NOT_FOUND");
  await app.close();
});
