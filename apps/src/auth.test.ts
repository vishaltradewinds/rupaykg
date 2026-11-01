import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";
import { authenticate, getAuthResolverMode, hasOrganizationPermission } from "./auth.js";

type Row = {
  identity_id: string;
  organization_id: string | null;
  role_id: string | null;
  membership_status: string | null;
};

class FakePool {
  calls: Array<{ sql: string; values: unknown[] | undefined }> = [];
  rows: Row[] = [];
  responseQueue: unknown[][] | undefined;
  failure: Error | undefined;
  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, values });
    if (this.failure) throw this.failure;
    const rows = this.responseQueue?.shift() ?? this.rows;
    return { rows, rowCount: rows.length };
  }
}

const identityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const token = "opaque-test-token";
const tokenHash = createHash("sha256").update(token).digest("hex");

function request(organizationId?: string, url = "/api/v1/overview") {
  return {
    headers: {
      authorization: `Bearer ${token}`,
      ...(organizationId ? { "x-rupaykg-organization-id": organizationId } : {}),
    },
    url,
  } as never;
}

test("security-definer mode resolves a valid identity and its verified memberships in one query", async () => {
  const pool = new FakePool();
  pool.rows = [
    { identity_id: identityId, organization_id: orgA, role_id: "role-a", membership_status: "VERIFIED" },
    { identity_id: identityId, organization_id: orgB, role_id: "role-b", membership_status: "VERIFIED" },
  ];

  const result = await authenticate(request(orgA), pool as unknown as Pool, "security_definer");
  assert.equal(result?.identityId, identityId);
  assert.deepEqual(result?.memberships, [
    { organization_id: orgA, role_id: "role-a", status: "VERIFIED" },
    { organization_id: orgB, role_id: "role-b", status: "VERIFIED" },
  ]);
  assert.equal(result?.activeOrganizationId, orgA);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0]!.sql, /auth_private\.resolve_session\(\$1\)/);
  assert.deepEqual(pool.calls[0]!.values, [tokenHash]);
});

test("security-definer mode preserves mandatory explicit selection for multi-organization identities", async () => {
  const pool = new FakePool();
  pool.rows = [
    { identity_id: identityId, organization_id: orgA, role_id: "role-a", membership_status: "VERIFIED" },
    { identity_id: identityId, organization_id: orgB, role_id: "role-b", membership_status: "VERIFIED" },
  ];

  assert.equal(await authenticate(request(), pool as unknown as Pool, "security_definer"), null);
  assert.equal(pool.calls.length, 1);
});

test("settlement routes preserve bilateral scope but still require explicit organization selection", async () => {
  const pool = new FakePool();
  pool.rows = [
    { identity_id: identityId, organization_id: orgA, role_id: "role-a", membership_status: "VERIFIED" },
    { identity_id: identityId, organization_id: orgB, role_id: "role-b", membership_status: "VERIFIED" },
  ];

  const missingSelection = await authenticate(request(undefined, "/api/v1/settlements"), pool as unknown as Pool, "security_definer");
  assert.equal(missingSelection, null);
  const selected = await authenticate(request(orgA, "/api/v1/settlements"), pool as unknown as Pool, "security_definer");
  assert.equal(selected?.activeOrganizationId, orgA);
  assert.equal(selected?.bilateralOrganizationScope, true);
  assert.equal(selected?.memberships.length, 2);
});

test("revoked, expired, suspended, or unknown sessions are represented by no resolver rows", async () => {
  const pool = new FakePool();
  pool.rows = [];
  assert.equal(await authenticate(request(), pool as unknown as Pool, "security_definer"), null);
  assert.equal(pool.calls.length, 1);
});

test("a valid identity without verified memberships remains authenticated but has no organization scope", async () => {
  const pool = new FakePool();
  pool.rows = [{
    identity_id: identityId,
    organization_id: null,
    role_id: null,
    membership_status: null,
  }];

  const result = await authenticate(request(), pool as unknown as Pool, "security_definer");
  assert.deepEqual(result, { identityId, memberships: [] });
});

test("resolver errors fail closed and never fall back to direct auth-table reads", async () => {
  const pool = new FakePool();
  pool.failure = new Error("function unavailable");
  await assert.rejects(
    () => authenticate(request(), pool as unknown as Pool, "security_definer"),
    /function unavailable/,
  );
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0]!.sql, /auth_private\.resolve_session/);
});

test("inconsistent resolver identity rows fail closed", async () => {
  const pool = new FakePool();
  pool.rows = [
    { identity_id: identityId, organization_id: orgA, role_id: "role-a", membership_status: "VERIFIED" },
    { identity_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", organization_id: orgB, role_id: "role-b", membership_status: "VERIFIED" },
  ];
  await assert.rejects(
    () => authenticate(request(orgA), pool as unknown as Pool, "security_definer"),
    /AUTH_SESSION_RESOLVER_RETURNED_MULTIPLE_IDENTITIES/,
  );
});

test("resolver mode configuration accepts only explicit supported modes", () => {
  assert.equal(getAuthResolverMode(undefined), "legacy");
  assert.equal(getAuthResolverMode(""), "legacy");
  assert.equal(getAuthResolverMode("legacy"), "legacy");
  assert.equal(getAuthResolverMode("security_definer"), "security_definer");
  assert.throws(() => getAuthResolverMode("fallback"), /AUTH_RESOLVER_MODE_INVALID/);
});


test("security-definer mode rejects malformed and unverified organization selections", async () => {
  const pool = new FakePool();
  pool.rows = [
    { identity_id: identityId, organization_id: orgA, role_id: "role-a", membership_status: "VERIFIED" },
    { identity_id: identityId, organization_id: orgB, role_id: "role-b", membership_status: "PENDING" },
  ];

  assert.equal(await authenticate(request("not-a-uuid"), pool as unknown as Pool, "security_definer"), null);
  assert.equal(await authenticate(request(orgB), pool as unknown as Pool, "security_definer"), null);
  const result = await authenticate(request(orgA), pool as unknown as Pool, "security_definer");
  assert.equal(result?.memberships.length, 1);
  assert.equal(result?.memberships[0]?.organization_id, orgA);
});

test("single verified membership is implicitly selected", async () => {
  const pool = new FakePool();
  pool.rows = [{
    identity_id: identityId,
    organization_id: orgA,
    role_id: "role-a",
    membership_status: "VERIFIED",
  }];

  const result = await authenticate(request(), pool as unknown as Pool, "security_definer");
  assert.equal(result?.activeOrganizationId, orgA);
  assert.equal(result?.memberships.length, 1);
});

test("missing bearer token and missing pool fail closed without querying", async () => {
  const pool = new FakePool();
  const noBearer = { headers: {}, url: "/api/v1/overview" } as never;
  assert.equal(await authenticate(noBearer, pool as unknown as Pool, "security_definer"), null);
  assert.equal(await authenticate(request(), null, "security_definer"), null);
  assert.equal(pool.calls.length, 0);
});


test("legacy mode remains available and retains the two-query session and membership path", async () => {
  const pool = new FakePool();
  pool.responseQueue = [
    [{ identity_id: identityId }],
    [{ organization_id: orgA, role_id: "role-a", status: "VERIFIED" }],
  ];

  const result = await authenticate(request(), pool as unknown as Pool, "legacy");
  assert.equal(result?.identityId, identityId);
  assert.equal(result?.activeOrganizationId, orgA);
  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[0]!.sql, /identity_sessions/);
  assert.match(pool.calls[1]!.sql, /organization_memberships/);
});


test("security-definer authorization delegates membership and permission checks to the scoped database function", async () => {
  const pool = new FakePool();
  pool.rows = [{ ok: true }];
  const auth = {
    identityId,
    memberships: [{ organization_id: orgA, role_id: "role-a", status: "VERIFIED" }],
    activeOrganizationId: orgA,
  };
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  try {
    assert.equal(await hasOrganizationPermission(pool as unknown as Pool, auth, orgA, ["waste:record"]), true);
    assert.equal(pool.calls.length, 1);
    assert.match(pool.calls[0]!.sql, /auth_private\\.has_organization_permission/);
    assert.deepEqual(pool.calls[0]!.values, [identityId, orgA, ["waste:record"]]);
  } finally { delete process.env.RUPAYKG_AUTH_RESOLVER_MODE; }
});

test("security-definer authorization fails closed without falling back to direct membership queries", async () => {
  const pool = new FakePool();
  pool.failure = new Error("authorization function unavailable");
  const auth = {
    identityId,
    memberships: [{ organization_id: orgA, role_id: "role-a", status: "VERIFIED" }],
    activeOrganizationId: orgA,
  };
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  try {
    await assert.rejects(() => hasOrganizationPermission(pool as unknown as Pool, auth, orgA, ["waste:record"]), /authorization function unavailable/);
    assert.equal(pool.calls.length, 1);
    assert.match(pool.calls[0]!.sql, /auth_private\\.has_organization_permission/);
  } finally { delete process.env.RUPAYKG_AUTH_RESOLVER_MODE; }
});
