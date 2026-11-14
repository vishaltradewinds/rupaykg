import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerOnboardingHierarchyRoutes } from "./onboarding-hierarchy-routes.js";

const identityId = "123e4567-e89b-42d3-a456-426614174000";
const organizationId = "223e4567-e89b-42d3-a456-426614174000";
const roleId = "323e4567-e89b-42d3-a456-426614174000";
const applicationId = "423e4567-e89b-42d3-a456-426614174000";

function testPool(statements: string[]): Pool {
  return {
    connect: async () => ({
      query: async (sql: string) => {
        statements.push(sql);
        const normalized = sql.trim().toLowerCase();
        if (["begin", "commit", "rollback", "set local role rupaykg_app_runtime"].includes(normalized)) return { rows: [] };
        if (sql.includes("app.authenticate_bearer_session")) return { rows: [{
          identity_id: identityId,
          organization_id: organizationId,
          role_id: roleId,
          status: "VERIFIED",
          context_token: "test-context-token",
        }] };
        if (sql.includes("app.set_request_context")) return { rows: [] };
        if (sql.includes("select exists(")) return { rows: [{ ok: false }] };
        if (sql.includes("from stakeholder_applications sa")) return { rows: [] };
        throw new Error("Unexpected SQL in onboarding tenant-context test: " + sql);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;
}

const headers = {
  authorization: "Bearer test-session",
  "x-rupaykg-organization-id": organizationId,
};

test("onboarding review queue establishes tenant context before reading applications", async () => {
  const statements: string[] = [];
  const app = Fastify({ logger: false });
  await registerOnboardingHierarchyRoutes(app, testPool(statements));
  const response = await app.inject({ method: "GET", url: "/api/v1/onboarding/review-queue", headers });
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(response.json().applications, []);
  const contextIndex = statements.findIndex(sql => sql.includes("app.set_request_context"));
  const queueIndex = statements.findIndex(sql => sql.includes("from stakeholder_applications sa"));
  assert.ok(contextIndex >= 0);
  assert.ok(queueIndex > contextIndex, "application queue must be read after tenant context");
  await app.close();
});

test("legal verification authority is checked under the authenticated tenant context", async () => {
  const statements: string[] = [];
  const app = Fastify({ logger: false });
  await registerOnboardingHierarchyRoutes(app, testPool(statements));
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/onboarding/applications/${applicationId}/verify-legal`,
    headers,
    payload: { verificationStatus: "VERIFIED", verificationNote: "Reviewed supporting legal record" },
  });
  assert.equal(response.statusCode, 403, response.body);
  assert.equal(response.json().code, "ONBOARDING_AUTHORITY_FORBIDDEN");
  const contextIndex = statements.findIndex(sql => sql.includes("app.set_request_context"));
  const authorityIndex = statements.findIndex(sql => sql.includes("select exists("));
  assert.ok(contextIndex >= 0);
  assert.ok(authorityIndex > contextIndex, "authority query must execute after tenant context");
  assert.ok(!statements.some(sql => sql.includes("update organizations")), "unauthorized reviewer must not mutate organization state");
  await app.close();
});
