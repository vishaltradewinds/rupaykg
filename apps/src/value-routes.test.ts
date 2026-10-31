import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
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
