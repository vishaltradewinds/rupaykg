import assert from "node:assert/strict";
import Fastify from "fastify";
import test from "node:test";
import type { Pool } from "pg";
import { registerValueRoutes } from "./value-routes.js";

const identityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationId = "11111111-1111-4111-8111-111111111111";
const periodId = "55555555-5555-4555-8555-555555555555";

class PermissionPool {
  calls: string[] = [];
  constructor(private readonly options: { organizationPermission?: boolean; esgPermission?: boolean } = {}) {}
  async query(sql: string) {
    this.calls.push(sql);
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
    if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1")) {
      return { rows: [{ organization_id: organizationId, role_id: "role-a", status: "VERIFIED" }] };
    }
    if (sql.includes("jsonb_array_elements_text")) return { rows: [{ ok: this.options.organizationPermission ?? false }] };
    if (sql.includes("can_write_esg")) return { rows: [{ ok: this.options.esgPermission ?? false }] };
    if (sql.includes("select organization_id from bwg_reporting_periods")) return { rows: [{ organization_id: organizationId }] };
    return { rows: [] };
  }
}

async function makeApp(pool: PermissionPool) {
  const app = Fastify();
  await registerValueRoutes(app, pool as unknown as Pool);
  await app.ready();
  return app;
}

const auth = { authorization: "Bearer acceptance-test-token" };

test("BWG reporting-period creation requires reports:read and waste:record permission", async () => {
  const pool = new PermissionPool({ organizationPermission: false });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods",
      headers: auth,
      payload: { organizationId, periodStart: "2026-01-01", periodEnd: "2026-03-31", reportingBasis: "QUARTERLY" },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "BWG_PERIOD_FORBIDDEN");
    assert.equal(pool.calls.some((sql) => sql.includes("insert into bwg_reporting_periods")), false);
  } finally {
    await app.close();
  }
});

test("BWG waste report creation requires waste:record permission", async () => {
  const pool = new PermissionPool({ organizationPermission: false });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/bwg/reporting-periods/${periodId}/waste`,
      headers: auth,
      payload: { wasteStream: "ORGANIC", unit: "kg", generatedQuantity: 100 },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "BWG_WASTE_FORBIDDEN");
    assert.equal(pool.calls.some((sql) => sql.includes("insert into bwg_waste_reports")), false);
  } finally {
    await app.close();
  }
});

test("BWG EPR report creation requires epr:manage permission", async () => {
  const pool = new PermissionPool({ organizationPermission: false });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/bwg/reporting-periods/${periodId}/epr`,
      headers: auth,
      payload: { schemeId: "scheme-a", categoryCode: "PLASTIC_I", obligatedQuantity: 100, fulfilledQuantity: 50 },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "BWG_EPR_FORBIDDEN");
    assert.equal(pool.calls.some((sql) => sql.includes("insert into bwg_epr_reports")), false);
  } finally {
    await app.close();
  }
});

test("BWG ESG report creation requires database-backed ESG write permission", async () => {
  const pool = new PermissionPool({ esgPermission: false });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/bwg/reporting-periods/${periodId}/esg`,
      headers: auth,
      payload: { metricCode: "WASTE_RECOVERY_RATE", scope: "SCOPE_3", unit: "%", value: 75 },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "BWG_ESG_FORBIDDEN");
    assert.equal(pool.calls.some((sql) => sql.includes("insert into bwg_esg_reports")), false);
  } finally {
    await app.close();
  }
});
