import assert from "node:assert/strict";
import { createHash, scryptSync } from "node:crypto";
import Fastify from "fastify";
import test from "node:test";
import type { Pool } from "pg";
import { registerAuthRoutes } from "./auth-routes.js";

type QueryCall = { sql: string; values: unknown[] | undefined };
class FakePool {
  calls: QueryCall[] = [];
  handler: (sql: string, values?: unknown[]) => { rows: unknown[]; rowCount?: number } = () => ({ rows: [] });
  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, values });
    return this.handler(sql, values);
  }
}
const identityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationId = "11111111-1111-4111-8111-111111111111";
const salt = "test-salt";
const passwordHash = scryptSync("correct-horse-battery", salt, 64).toString("base64url");
const accountContext = {
  identity: { id: identityId, display_name: "Test Identity", email: "test@example.invalid", status: "VERIFIED" },
  memberships: [{ organization_id: organizationId, role_id: "role-a", status: "VERIFIED" }],
  applications: [],
};

async function setup(appPool: FakePool, authPool: FakePool) {
  const app = Fastify();
  await registerAuthRoutes(app, appPool as unknown as Pool, authPool as unknown as Pool);
  await app.ready();
  return app;
}

test("auth routes are registered and login uses only dedicated SECURITY DEFINER operations", async () => {
  const appPool = new FakePool();
  const authPool = new FakePool();
  authPool.handler = (sql) => {
    if (sql.includes("find_login_candidate")) return { rows: [{
      identity_id: identityId, display_name: "Test Identity", email: "test@example.invalid",
      identity_status: "VERIFIED", suspended_at: null, password_hash: passwordHash,
      password_salt: salt, password_algorithm: "scrypt", failed_attempts: 0, locked_until: null,
    }] };
    if (sql.includes("issue_session")) return { rows: [{ issued: true }] };
    if (sql.includes("get_self_account_context")) return { rows: [{ context: accountContext }] };
    return { rows: [{ ok: true }] };
  };
  const app = await setup(appPool, authPool);
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "test@example.invalid", password: "correct-horse-battery" } });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.identity.id, identityId);
    assert.equal(body.memberships.length, 1);
    assert.equal(body.expiresInSeconds, 28800);
    assert.ok(typeof body.sessionToken === "string");
    assert.equal(appPool.calls.length, 0);
    assert.deepEqual(authPool.calls.map((call) => call.sql.match(/auth_private\.([a-z_]+)/)?.[1]), [
      "find_login_candidate", "reset_login_failures", "issue_session", "get_self_account_context",
    ]);
    assert.ok(authPool.calls.every((call) => !/\b(select|insert|update|delete)\s+.*\b(identities|identity_sessions|identity_password_credentials|organization_memberships)\b/i.test(call.sql)));
  } finally { await app.close(); }
});

test("wrong password records a failure through the auth runtime function", async () => {
  const appPool = new FakePool(), authPool = new FakePool();
  authPool.handler = (sql) => sql.includes("find_login_candidate")
    ? { rows: [{ identity_id: identityId, identity_status: "VERIFIED", suspended_at: null, password_hash: passwordHash, password_salt: salt, password_algorithm: "scrypt", locked_until: null }] }
    : { rows: [{ failed_attempts: 1 }] };
  const app = await setup(appPool, authPool);
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "test@example.invalid", password: "wrong-password" } });
    assert.equal(response.statusCode, 401);
    assert.equal(authPool.calls.length, 2);
    assert.match(authPool.calls[1]!.sql, /auth_private\.record_login_failure/);
  } finally { await app.close(); }
});

test("registration hashes the password in the application and calls the atomic database function", async () => {
  const appPool = new FakePool(), authPool = new FakePool();
  authPool.handler = (sql) => sql.includes("register_identity") ? { rows: [{ identity_id: identityId }] } : { rows: [] };
  const app = await setup(appPool, authPool);
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { email: "new@example.invalid", name: "New Identity", password: "long-password-123" } });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().identity.id, identityId);
    assert.match(authPool.calls[0]!.sql, /auth_private\.register_identity/);
    assert.equal(authPool.calls[0]!.values?.[0], "new@example.invalid");
    assert.notEqual(authPool.calls[0]!.values?.[2], "long-password-123");
    assert.equal(appPool.calls.length, 0);
  } finally { await app.close(); }
});

test("me authenticates with the application resolver and returns self-scoped context", async () => {
  const appPool = new FakePool(), authPool = new FakePool();
  appPool.handler = (sql) => sql.includes("resolve_session")
    ? { rows: [{ identity_id: identityId, organization_id: organizationId, role_id: "role-a", membership_status: "VERIFIED" }] }
    : { rows: [] };
  authPool.handler = (sql) => sql.includes("get_self_account_context") ? { rows: [{ context: accountContext }] } : { rows: [] };
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  const app = await setup(appPool, authPool);
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { authorization: "Bearer test-token" } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().identity.id, identityId);
    assert.match(appPool.calls[0]!.sql, /auth_private\.resolve_session/);
    assert.match(authPool.calls[0]!.sql, /auth_private\.get_self_account_context/);
  } finally { await app.close(); delete process.env.RUPAYKG_AUTH_RESOLVER_MODE; }
});

test("logout revokes only the token hash through the auth runtime", async () => {
  const appPool = new FakePool(), authPool = new FakePool();
  const app = await setup(appPool, authPool);
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { authorization: "Bearer test-token" } });
    assert.equal(response.statusCode, 204);
    assert.match(authPool.calls[0]!.sql, /auth_private\.revoke_session/);
    assert.equal(appPool.calls.length, 0);
  } finally { await app.close(); }
});


test("self onboarding applications are read through auth_private self-context", async () => {
  const appPool = new FakePool(), authPool = new FakePool();
  const applications = [{ id: "application-1", status: "PENDING" }];
  appPool.handler = (sql) => sql.includes("resolve_session")
    ? { rows: [{ identity_id: identityId, organization_id: organizationId, role_id: "role-a", membership_status: "VERIFIED" }] }
    : { rows: [] };
  authPool.handler = (sql) => sql.includes("get_self_account_context")
    ? { rows: [{ context: { ...accountContext, applications } }] }
    : { rows: [] };
  const previousMode = process.env.RUPAYKG_AUTH_RESOLVER_MODE;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  const app = await setup(appPool, authPool);
  try {
    const token = "self-onboarding-token";
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/onboarding/applications",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().applications, applications);
    assert.equal(appPool.calls.length, 1);
    assert.match(appPool.calls[0]!.sql, /auth_private\.resolve_session/);
    assert.doesNotMatch(appPool.calls[0]!.sql, /identity_sessions|organization_memberships|stakeholder_applications/);
    assert.equal(authPool.calls.length, 1);
    assert.match(authPool.calls[0]!.sql, /auth_private\.get_self_account_context/);
    assert.deepEqual(authPool.calls[0]!.values, [createHash("sha256").update(token).digest("hex")]);
  } finally {
    await app.close();
    if (previousMode === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;
    else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previousMode;
  }
});


test("onboarding creation delegates all writes to the identity-bound auth database function", async () => {
  const appPool = new FakePool(), authPool = new FakePool();
  appPool.handler = (sql) => sql.includes("resolve_session")
    ? { rows: [{ identity_id: identityId, organization_id: organizationId, role_id: "role-a", membership_status: "VERIFIED" }] }
    : { rows: [] };
  const application = { id: "application-1", status: "PENDING" };
  authPool.handler = (sql) => sql.includes("create_stakeholder_application")
    ? { rows: [{ application_result: { application, organization_id: organizationId, role_id: "role-b", identity_id: identityId } }] }
    : { rows: [] };
  const previousMode = process.env.RUPAYKG_AUTH_RESOLVER_MODE;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  const app = await setup(appPool, authPool);
  try {
    const token = "onboarding-create-token";
    const response = await app.inject({
      method: "POST", url: "/api/v1/onboarding/applications",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationName: "Example Recycler", roleKey: "processor",
        legalName: "Example Recycler Private Limited", legalForm: "Private Limited",
        registrationIdentifier: "CIN-EXAMPLE-001", registrationAuthority: "MCA",
        evidenceType: "INCORPORATION_CERTIFICATE", documentReference: "evidence://example/certificate",
        contentHash: "a".repeat(64),
      },
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().application.id, application.id);
    assert.equal(appPool.calls.length, 1);
    assert.match(appPool.calls[0]!.sql, /auth_private\.resolve_session/);
    assert.equal(authPool.calls.length, 1);
    assert.match(authPool.calls[0]!.sql, /auth_private\.create_stakeholder_application/);
    assert.equal(authPool.calls[0]!.values?.[0], createHash("sha256").update(token).digest("hex"));
    assert.equal(authPool.calls[0]!.values?.[2], "processor");
    assert.ok(appPool.calls.every(call => !/\b(insert|update|delete)\b/i.test(call.sql)));
    assert.ok(authPool.calls.every(call => !/\b(insert|update|delete)\b/i.test(call.sql)));
  } finally {
    await app.close();
    if (previousMode === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;
    else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previousMode;
  }
});

test("onboarding withdrawal delegates to the identity-bound auth database function", async () => {
  const appPool = new FakePool(), authPool = new FakePool();
  appPool.handler = (sql) => sql.includes("resolve_session")
    ? { rows: [{ identity_id: identityId, organization_id: organizationId, role_id: "role-a", membership_status: "VERIFIED" }] }
    : { rows: [] };
  authPool.handler = (sql) => sql.includes("withdraw_stakeholder_application")
    ? { rows: [{ withdrawal_result: { status: "WITHDRAWN", organization_id: organizationId } }] }
    : { rows: [] };
  const previousMode = process.env.RUPAYKG_AUTH_RESOLVER_MODE;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  const app = await setup(appPool, authPool);
  try {
    const token = "onboarding-withdraw-token";
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/onboarding/applications/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/withdraw",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().status, "WITHDRAWN");
    assert.equal(response.json().organizationId, organizationId);
    assert.equal(appPool.calls.length, 1);
    assert.match(appPool.calls[0]!.sql, /auth_private\.resolve_session/);
    assert.equal(authPool.calls.length, 1);
    assert.match(authPool.calls[0]!.sql, /auth_private\.withdraw_stakeholder_application/);
    assert.deepEqual(authPool.calls[0]!.values, [createHash("sha256").update(token).digest("hex"), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
    assert.ok(appPool.calls.every(call => !/\b(insert|update|delete)\b/i.test(call.sql)));
    assert.ok(authPool.calls.every(call => !/\b(insert|update|delete)\b/i.test(call.sql)));
  } finally {
    await app.close();
    if (previousMode === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;
    else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previousMode;
  }
});
