import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerOnboardingHierarchyRoutes } from "./onboarding-hierarchy-routes.js";

const identityId = "123e4567-e89b-42d3-a456-426614174000";
const organizationId = "223e4567-e89b-42d3-a456-426614174000";

function testPool(boundaryResult: unknown, boundaryError?: Error): Pool {
  return {
    connect: async () => ({
      query: async (sql: string) => {
        if (sql.includes("app.authenticate_bearer_session")) return {
          rows: [{ identity_id: identityId, organization_id: organizationId, role_id: "323e4567-e89b-42d3-a456-426614174000", status: "VERIFIED", context_token: "423e4567-e89b-42d3-a456-426614174000" }],
        };
        if (sql.includes("app.onboarding_") && boundaryError) throw boundaryError;
        if (sql.includes("app.onboarding_review_queue")) return { rows: [{ queue: boundaryResult }] };
        if (sql.includes("app.onboarding_")) return { rows: [{ result: boundaryResult }] };
        return { rows: [] };
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
}

const headers = {
  authorization: "Bearer test-session",
  "x-rupaykg-organization-id": organizationId,
};

test("cross-organization review queue is served through the controlled database boundary", async () => {
  const app = Fastify({ logger: false });
  const queue = [{ id: "app-1", organization_id: "other-org", canReview: true, canVerifyLegal: false, nextApproval: { approval_level: "PLATFORM", status: "PENDING" } }];
  await registerOnboardingHierarchyRoutes(app, testPool(queue));
  const response = await app.inject({ method: "GET", url: "/api/v1/onboarding/review-queue", headers });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().applications, queue);
  await app.close();
});

test("unauthorized cross-organization legal verification is denied by the database boundary", async () => {
  const app = Fastify({ logger: false });
  await registerOnboardingHierarchyRoutes(app, testPool(null, new Error("ONBOARDING_AUTHORITY_FORBIDDEN")));
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/onboarding/applications/523e4567-e89b-42d3-a456-426614174000/verify-legal",
    headers,
    payload: { verificationStatus: "VERIFIED", verificationNote: "Reviewed supporting legal record" },
  });
  assert.equal(response.statusCode, 403, response.body);
  assert.equal(response.json().code, "ONBOARDING_AUTHORITY_FORBIDDEN");
  await app.close();
});

test("platform decision cannot bypass legal verification", async () => {
  const app = Fastify({ logger: false });
  await registerOnboardingHierarchyRoutes(app, testPool(null, new Error("LEGAL_VERIFICATION_REQUIRED")));
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/onboarding/applications/523e4567-e89b-42d3-a456-426614174000/approve",
    headers,
    payload: { reviewNote: "Approve" },
  });
  assert.equal(response.statusCode, 409, response.body);
  assert.equal(response.json().code, "LEGAL_VERIFICATION_REQUIRED");
  await app.close();
});
