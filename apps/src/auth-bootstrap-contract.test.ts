import assert from "node:assert/strict";
import test from "node:test";
import { authenticate } from "./auth.js";

const identityId = "11111111-1111-4111-8111-111111111111";
const orgA = "22222222-2222-4222-8222-222222222222";
const orgB = "33333333-3333-4333-8333-333333333333";
const roleId = "44444444-4444-4444-8444-444444444444";

function request(authorization = "Bearer token", organizationId?: string): any {
  return {
    headers: {
      authorization,
      ...(organizationId ? { "x-rupaykg-organization-id": organizationId } : {}),
    },
    url: "/api/v1/activities",
  };
}

function poolWith(rows: any[]) {
  const calls: string[] = [];
  const client = {
    query: async (sql: string, _params?: unknown[]) => {
      calls.push(sql);
      return /app\\.authenticate_bearer_session/.test(sql) ? { rows } : { rows: [] };
    },
    release: () => {},
  };
  return {
    calls,
    connect: async () => client,
  } as any;
}

test("authentication bootstrap uses the governed database function rather than a pre-context membership query", async () => {
  const pool = poolWith([{ identity_id: identityId, organization_id: orgA, role_id: roleId, status: "VERIFIED", context_token: "test-context-token" }]);
  const auth = await authenticate(request(), pool);
  assert.equal(auth?.identityId, identityId);
  assert.equal(auth?.activeOrganizationId, orgA);
  assert.equal(auth?.contextToken, "test-context-token");
  assert.equal(pool.calls[0], "begin");
  assert.equal(pool.calls[1], "set local role rupaykg_app_runtime");
  assert.match(pool.calls[2], /app\.authenticate_bearer_session/);
  assert.equal(pool.calls[3], "commit");
  assert.doesNotMatch(pool.calls[0], /from\s+organization_memberships/i);
});

test("single-organization identity is scoped implicitly", async () => {
  const pool = poolWith([{ identity_id: identityId, organization_id: orgA, role_id: roleId, status: "VERIFIED", context_token: "test-context-token" }]);
  const auth = await authenticate(request(), pool);
  assert.equal(auth?.activeOrganizationId, orgA);
});

test("multi-organization identity must explicitly select an organization", async () => {
  const pool = poolWith([
    { identity_id: identityId, organization_id: orgA, role_id: roleId, status: "VERIFIED", context_token: "test-context-token" },
    { identity_id: identityId, organization_id: orgB, role_id: roleId, status: "VERIFIED", context_token: "test-context-token" },
  ]);
  assert.equal(await authenticate(request(), pool), null);
});

test("multi-organization identity accepts only a verified returned membership", async () => {
  const pool = poolWith([
    { identity_id: identityId, organization_id: orgA, role_id: roleId, status: "VERIFIED", context_token: "test-context-token" },
    { identity_id: identityId, organization_id: orgB, role_id: roleId, status: "VERIFIED", context_token: "test-context-token" },
  ]);
  const auth = await authenticate(request("Bearer token", orgB), pool);
  assert.equal(auth?.activeOrganizationId, orgB);
});

test("invalid organization header is rejected before database bootstrap", async () => {
  const pool = poolWith([{ identity_id: identityId, organization_id: orgA, role_id: roleId, status: "VERIFIED", context_token: "test-context-token" }]);
  assert.equal(await authenticate(request("Bearer token", "not-a-uuid"), pool), null);
  assert.equal(pool.calls.length, 0);
});

test("unknown requested organization is rejected", async () => {
  const pool = poolWith([{ identity_id: identityId, organization_id: orgA, role_id: roleId, status: "VERIFIED", context_token: "test-context-token" }]);
  assert.equal(await authenticate(request("Bearer token", orgB), pool), null);
});
