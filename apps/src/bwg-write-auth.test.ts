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
  writes: Array<{ sql: string; values: unknown[] | undefined }> = [];
  constructor(private readonly options: { organizationPermission?: boolean; esgPermission?: boolean; periodTriggerError?: boolean; eprConstraintError?: boolean } = {}) {}
  async query(sql: string, values?: unknown[]) {
    this.calls.push(sql);
    if (sql.startsWith("insert into ")) this.writes.push({ sql, values });
    if (sql.startsWith("insert into bwg_reporting_periods") && this.options.periodTriggerError) {
      throw { code: "23514", message: "BWG applicability must be verified before creating a reporting period" };
    }
    if (sql.startsWith("insert into bwg_epr_reports") && this.options.eprConstraintError) {
      throw { code: "23514", constraint: "bwg_epr_reports_fulfilled_le_obligated", message: "new row violates check constraint" };
    }
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
    if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1")) {
      return { rows: [{ organization_id: organizationId, role_id: "role-a", status: "VERIFIED" }] };
    }
    if (sql.includes("jsonb_array_elements_text")) return { rows: [{ ok: this.options.organizationPermission ?? false }] };
    if (sql.includes("can_write_esg")) return { rows: [{ ok: this.options.esgPermission ?? false }] };
    if (sql.includes("select organization_id from bwg_reporting_periods")) return { rows: [{ organization_id: organizationId }] };
    if (sql.includes("select id from epr_schemes")) return { rows: [{ id: "scheme-a" }] };
    if (sql.includes("insert into ")) return { rows: [{ id: "created-row" }] };
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


test("BWG reporting-period creation permits an authorized organization writer", async () => {
  const pool = new PermissionPool({ organizationPermission: true });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods",
      headers: auth,
      payload: { organizationId, periodStart: "2026-01-01", periodEnd: "2026-03-31", reportingBasis: "QUARTERLY" },
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().authoritativeMutation, true);
    assert.equal(pool.writes.some((write) => write.sql.includes("insert into bwg_reporting_periods")), true);
  } finally {
    await app.close();
  }
});

test("BWG waste report accepts authorized intake but keeps unverified evidence state pending", async () => {
  const pool = new PermissionPool({ organizationPermission: true });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/bwg/reporting-periods/${periodId}/waste`,
      headers: auth,
      payload: { wasteStream: "ORGANIC", unit: "kg", generatedQuantity: 100 },
    });
    assert.equal(response.statusCode, 201);
    const write = pool.writes.find((item) => item.sql.includes("insert into bwg_waste_reports"));
    assert.ok(write);
    assert.equal(write.values?.[9], "PENDING");
  } finally {
    await app.close();
  }
});

test("BWG EPR report accepts authorized intake without asserting external submission", async () => {
  const pool = new PermissionPool({ organizationPermission: true });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/bwg/reporting-periods/${periodId}/epr`,
      headers: auth,
      payload: { schemeId: "scheme-a", categoryCode: "PLASTIC_I", obligatedQuantity: 100, fulfilledQuantity: 50 },
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().externalSubmission, "NOT_SUBMITTED");
    const write = pool.writes.find((item) => item.sql.includes("insert into bwg_epr_reports"));
    assert.ok(write);
    assert.equal(write.values?.[7], "PENDING");
  } finally {
    await app.close();
  }
});

test("BWG ESG report accepts authorized intake but keeps unverified evidence state pending", async () => {
  const pool = new PermissionPool({ esgPermission: true });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/bwg/reporting-periods/${periodId}/esg`,
      headers: auth,
      payload: { metricCode: "WASTE_RECOVERY_RATE", scope: "SCOPE_3", unit: "%", value: 75 },
    });
    assert.equal(response.statusCode, 201);
    const write = pool.writes.find((item) => item.sql.includes("insert into bwg_esg_reports"));
    assert.ok(write);
    assert.equal(write.values?.[7], "PENDING");
  } finally {
    await app.close();
  }
});


test("BWG reporting-period applicability trigger returns a sanitized 409 conflict", async () => {
  const pool = new PermissionPool({ organizationPermission: true, periodTriggerError: true });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/bwg/reporting-periods",
      headers: auth,
      payload: { organizationId, periodStart: "2026-01-01", periodEnd: "2026-03-31", reportingBasis: "QUARTERLY" },
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().code, "BWG_APPLICABILITY_NOT_VERIFIED");
    assert.doesNotMatch(response.body, /23514|BWG applicability must be verified before creating a reporting period/);
  } finally {
    await app.close();
  }
});

test("BWG EPR fulfilled quantity above obligation is rejected before database write", async () => {
  const pool = new PermissionPool({ organizationPermission: true });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/bwg/reporting-periods/${periodId}/epr`,
      headers: auth,
      payload: { schemeId: "scheme-a", categoryCode: "PLASTIC_I", obligatedQuantity: 100, fulfilledQuantity: 101 },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED");
    assert.equal(pool.calls.some((sql) => sql.includes("insert into bwg_epr_reports")), false);
  } finally {
    await app.close();
  }
});

test("exact EPR database check constraint returns a sanitized 409 conflict", async () => {
  const pool = new PermissionPool({ organizationPermission: true, eprConstraintError: true });
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/bwg/reporting-periods/${periodId}/epr`,
      headers: auth,
      payload: { schemeId: "scheme-a", categoryCode: "PLASTIC_I", obligatedQuantity: 100, fulfilledQuantity: 100 },
    });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().code, "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED");
    assert.doesNotMatch(response.body, /23514|new row violates check constraint/);
  } finally {
    await app.close();
  }
});
