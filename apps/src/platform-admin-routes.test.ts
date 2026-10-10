import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerPlatformAdminRoutes } from "./platform-admin-routes.js";

const identityId = "123e4567-e89b-42d3-a456-426614174000";
const organizationId = "223e4567-e89b-42d3-a456-426614174000";
const roleId = "323e4567-e89b-42d3-a456-426614174000";

function fakePool(isSuperAdmin: boolean): Pool {
  return {
    query: async (sql: string) => {
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("where identity_id")) {
        return { rows: [{ organization_id: organizationId, role_id: roleId, status: "VERIFIED" }] };
      }
      if (sql.includes("r.name = 'super_admin'")) return { rows: [{ ok: isSuperAdmin }] };
      if (sql.includes('as "verifiedIdentities"')) return { rows: [{
        verifiedIdentities: "12",
        organizations: "7",
        verifiedMemberships: "9",
        pendingApplications: "3",
        pendingLegalReviews: "2",
        anchoredMrvRecords: "4",
      }] };
      throw new Error(`Unexpected SQL in platform-admin test: ${sql}`);
    },
  } as unknown as Pool;
}

test("platform admin overview fails closed without a database", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, null);
  const response = await app.inject({ method: "GET", url: "/api/v1/admin/overview" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().code, "DATABASE_UNAVAILABLE");
  await app.close();
});

test("platform admin overview requires an authenticated session", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, fakePool(true));
  const response = await app.inject({ method: "GET", url: "/api/v1/admin/overview" });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, "AUTH_REQUIRED");
  await app.close();
});

test("platform admin overview denies ordinary verified members", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, fakePool(false));
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/admin/overview",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().code, "PLATFORM_ADMIN_FORBIDDEN");
  await app.close();
});

test("Super Admin receives platform-wide aggregate counts only", async () => {
  const app = Fastify({ logger: false });
  await registerPlatformAdminRoutes(app, fakePool(true));
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/admin/overview",
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    source: "postgresql",
    syntheticData: false,
    scope: "PLATFORM",
    counts: {
      verifiedIdentities: 12,
      organizations: 7,
      verifiedMemberships: 9,
      pendingApplications: 3,
      pendingLegalReviews: 2,
      anchoredMrvRecords: 4,
    },
  });
  await app.close();
});
