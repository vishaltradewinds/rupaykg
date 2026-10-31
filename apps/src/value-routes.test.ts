import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerValueRoutes } from "./value-routes.js";
import { bwgProfileReviewBasis, bwgEprQuantityError, canReadBwgWorkspace, isBwgApplicabilityNotVerifiedConflict, isBwgEprFulfilledObligationConstraintViolation } from "./value-routes.js";

test("BWG profile intake never self-asserts statutory applicability or external registration", () => {
  const basis = bwgProfileReviewBasis();
  assert.equal(basis.sourceRuleReference, "SWM_RULES_2026_S_O_388_E");
  assert.equal(basis.classification, "REVIEW_REQUIRED");
  assert.equal(basis.determinationBoundary, "PROFILE_INTAKE_ONLY_NOT_A_STATUTORY_DETERMINATION");
  assert.equal(basis.evidenceAndIndependentReviewRequired, true);
  assert.equal(basis.externalRegistrationAsserted, false);
});


test("BWG workspace read requires the explicit reports:read permission", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const auth = {
    identityId: "identity-1",
    memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }],
    activeOrganizationId: "org-1",
  };
  const client = {
    query: async (sql: string, values: unknown[]) => {
      queries.push({ sql, values });
      return { rows: [{ ok: true }] };
    },
  } as never;

  assert.equal(await canReadBwgWorkspace(client, auth, "org-1"), true);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0]!.values, ["identity-1", "org-1", ["reports:read"]]);
});

test("BWG workspace read fails closed when reports:read is absent or organization scope differs", async () => {
  let queryCount = 0;
  const auth = {
    identityId: "identity-1",
    memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }],
    activeOrganizationId: "org-1",
  };
  const deniedClient = {
    query: async () => { queryCount += 1; return { rows: [{ ok: false }] }; },
  } as never;

  assert.equal(await canReadBwgWorkspace(deniedClient, auth, "org-1"), false);
  assert.equal(await canReadBwgWorkspace(deniedClient, auth, "org-2"), false);
  assert.equal(queryCount, 1);
});

test("BWG EPR quantities reject fulfilled amounts above the obligation and accept exact boundaries", () => {
  assert.equal(bwgEprQuantityError(10, 0), null);
  assert.equal(bwgEprQuantityError(10, 10), null);
  assert.equal(bwgEprQuantityError(10, 10.01), "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED");
  assert.equal(bwgEprQuantityError(0, 0), null);
  assert.equal(bwgEprQuantityError(null, 0), "BWG_EPR_REQUIRED");
  assert.equal(bwgEprQuantityError(10, null), "BWG_EPR_REQUIRED");
  assert.equal(bwgEprQuantityError(-1, 0), "BWG_EPR_REQUIRED");
  assert.equal(bwgEprQuantityError(10, -1), "BWG_EPR_REQUIRED");
});

test("BWG EPR database conflict mapping is restricted to the exact production check constraint", () => {
  assert.equal(isBwgEprFulfilledObligationConstraintViolation({
    code: "23514",
    constraint: "bwg_epr_reports_fulfilled_le_obligated",
  }), true);
  assert.equal(isBwgEprFulfilledObligationConstraintViolation({
    code: "23514",
    constraint: "bwg_epr_reports_fulfilled_quantity_check",
  }), false);
  assert.equal(isBwgEprFulfilledObligationConstraintViolation({
    code: "23505",
    constraint: "bwg_epr_reports_fulfilled_le_obligated",
  }), false);
  assert.equal(isBwgEprFulfilledObligationConstraintViolation(null), false);
});

test("BWG reporting-period applicability conflict is mapped only for the exact live trigger error", () => {
  assert.equal(isBwgApplicabilityNotVerifiedConflict({
    code: "23514",
    message: "BWG applicability must be verified before creating a reporting period",
  }), true);
  assert.equal(isBwgApplicabilityNotVerifiedConflict({
    code: "23514",
    message: "a different check constraint failed",
  }), false);
  assert.equal(isBwgApplicabilityNotVerifiedConflict({
    code: "23505",
    message: "BWG applicability must be verified before creating a reporting period",
  }), false);
  assert.equal(isBwgApplicabilityNotVerifiedConflict(null), false);
});



const bwgTestIdentityId = "11111111-1111-4111-8111-111111111111";
const bwgTestOrganizationId = "22222222-2222-4222-8222-222222222222";

function authenticatedBwgTestPool(options: {
  permissionGranted?: boolean;
  eprInsertError?: unknown;
  periodInsertError?: unknown;
} = {}) {
  const statements: string[] = [];
  let connectCount = 0;
  const pool = {
    async query(sql: string) {
      if (sql.includes("from identity_sessions s")) return { rows: [{ identity_id: bwgTestIdentityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("status = 'VERIFIED'")) {
        return { rows: [{ organization_id: bwgTestOrganizationId, role_id: "bwg-test-role", status: "VERIFIED" }] };
      }
      throw new Error("Unexpected authentication query: " + sql);
    },
    async connect() {
      connectCount += 1;
      return {
        async query(sql: string) {
          statements.push(sql);
          if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.startsWith("select set_config")) return { rows: [] };
          if (sql.includes("join roles r")) return { rows: [{ ok: options.permissionGranted ?? true }] };
          if (sql.includes("select organization_id from bwg_reporting_periods")) return { rows: [{ organization_id: bwgTestOrganizationId }] };
          if (sql.includes("select id from epr_schemes")) return { rows: [{ id: "bwg-test-scheme" }] };
          if (sql.includes("insert into bwg_epr_reports")) {
            if (options.eprInsertError) throw options.eprInsertError;
            return { rows: [{ id: "bwg-test-epr-report" }] };
          }
          if (sql.includes("insert into bwg_reporting_periods")) {
            if (options.periodInsertError) throw options.periodInsertError;
            return { rows: [{ id: "bwg-test-period" }] };
          }
          throw new Error("Unexpected BWG transaction query: " + sql);
        },
        release() {},
      };
    },
  };
  return { pool: pool as unknown as Pool, statements, connectCount: () => connectCount };
}

test("BWG HTTP routes fail closed with 401 when no authenticated database session exists", async (t) => {
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, null);
  t.after(async () => app.close());

  const requests = [
    { method: "GET" as const, url: "/api/v1/workspaces/bwg" },
    { method: "POST" as const, url: "/api/v1/bwg/profile", payload: {} },
    { method: "POST" as const, url: "/api/v1/bwg/reporting-periods", payload: {} },
    { method: "POST" as const, url: "/api/v1/bwg/reporting-periods/00000000-0000-4000-8000-000000000001/waste", payload: {} },
    { method: "POST" as const, url: "/api/v1/bwg/reporting-periods/00000000-0000-4000-8000-000000000001/epr", payload: {} },
    { method: "POST" as const, url: "/api/v1/bwg/reporting-periods/00000000-0000-4000-8000-000000000001/esg", payload: {} },
  ];

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, request.method + " " + request.url + ": " + response.body);
    assert.equal(response.json().code, "AUTH_REQUIRED");
  }
});

test("BWG EPR HTTP route rejects fulfilled quantity above obligation before opening a database transaction", async (t) => {
  const fake = authenticatedBwgTestPool();
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, fake.pool);
  t.after(async () => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/bwg/reporting-periods/33333333-3333-4333-8333-333333333333/epr",
    headers: { authorization: "Bearer bwg-http-test-session" },
    payload: { schemeId: "bwg-test-scheme", categoryCode: "PLASTIC", obligatedQuantity: 10, fulfilledQuantity: 11 },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED");
  assert.equal(fake.connectCount(), 0, "invalid quantity must be rejected before any transaction or insert");
});

test("BWG EPR HTTP route maps only the exact production check-constraint failure to 409", async (t) => {
  const dbError = Object.assign(new Error("check constraint failed"), {
    code: "23514",
    constraint: "bwg_epr_reports_fulfilled_le_obligated",
  });
  const fake = authenticatedBwgTestPool({ eprInsertError: dbError });
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, fake.pool);
  t.after(async () => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/bwg/reporting-periods/33333333-3333-4333-8333-333333333333/epr",
    headers: { authorization: "Bearer bwg-http-test-session" },
    payload: { schemeId: "bwg-test-scheme", categoryCode: "PLASTIC", obligatedQuantity: 10, fulfilledQuantity: 9 },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED");
  assert.ok(fake.statements.includes("ROLLBACK"));
});

test("BWG reporting-period HTTP route maps the exact live applicability trigger rejection to 409", async (t) => {
  const triggerError = Object.assign(new Error("BWG applicability must be verified before creating a reporting period"), {
    code: "23514",
  });
  const fake = authenticatedBwgTestPool({ periodInsertError: triggerError });
  const app = Fastify({ logger: false });
  await registerValueRoutes(app, fake.pool);
  t.after(async () => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/bwg/reporting-periods",
    headers: { authorization: "Bearer bwg-http-test-session" },
    payload: {
      organizationId: bwgTestOrganizationId,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      reportingBasis: "MONTHLY",
    },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "BWG_APPLICABILITY_NOT_VERIFIED");
  assert.ok(fake.statements.includes("ROLLBACK"));
});
