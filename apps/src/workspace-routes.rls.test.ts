import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerWorkspaceRoutes } from "./workspace-routes.js";
import type { RlsRequestContextConfig } from "./rls-request-transaction.js";

const identityId = "11111111-1111-4111-8111-111111111111";
const organizationA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const geographyA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01";
const config: RlsRequestContextConfig = {
  hmacSecret: "mrv-workspace-test-secret-material-at-least-32-bytes",
  keyId: "mrv_workspace_test",
  ttlSeconds: 120,
};

type Call = { sql: string; values?: unknown[] };

class TenantClient {
  calls: Call[] = [];
  released = false;
  permission = true;
  geographyAllowed = true;
  failProtectedRead = false;
  protectedReadFailureTriggered = false;

  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [], rowCount: 0 };
    if (sql.includes("set_config('app.request_context'")) return { rows: [{ set_config: "signed" }], rowCount: 1 };
    if (sql.includes("auth_private.has_organization_permission")) return { rows: [{ ok: this.permission }], rowCount: 1 };
    if (sql.includes("organization_has_geography_scope")) return { rows: [{ ok: this.geographyAllowed }], rowCount: 1 };
    if (sql.includes("select m.id")) {
      if (this.failProtectedRead) { this.protectedReadFailureTriggered = true; throw new Error("synthetic protected read failure"); }
      return { rows: [{ id: "measurement-a", organization_id: organizationA }], rowCount: 1 };
    }
    if (sql.includes("from activities a") || sql.includes("from evidence e") || sql.includes("from verifications v")) {
      return { rows: [{ organization_id: organizationA }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  release() { this.released = true; }
}

class TenantPool {
  rawCalls: Call[] = [];
  clients: TenantClient[] = [];
  resolverRows: Array<Record<string, unknown>> = [{
    identity_id: identityId,
    organization_id: organizationA,
    role_id: "role-mrv-reader",
    membership_status: "VERIFIED",
  }];
  permission = true;
  geographyAllowed = true;
  failProtectedRead = false;

  async query(sql: string, values?: unknown[]) {
    this.rawCalls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("auth_private.resolve_session")) return { rows: this.resolverRows, rowCount: this.resolverRows.length };
    return { rows: [], rowCount: 0 };
  }

  async connect() {
    const client = new TenantClient();
    client.permission = this.permission;
    client.geographyAllowed = this.geographyAllowed;
    client.failProtectedRead = this.failProtectedRead;
    this.clients.push(client);
    return client;
  }
}

function asPool(pool: TenantPool): Pool { return pool as unknown as Pool; }

async function withEnvironment<T>(work: () => Promise<T>, contextConfigured = true): Promise<T> {
  const previous = {
    mode: process.env.RUPAYKG_AUTH_RESOLVER_MODE,
    secret: process.env.RUPAYKG_REQUEST_CONTEXT_SECRET,
    keyId: process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID,
  };
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  if (contextConfigured) {
    process.env.RUPAYKG_REQUEST_CONTEXT_SECRET = config.hmacSecret;
    process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID = config.keyId;
  } else {
    delete process.env.RUPAYKG_REQUEST_CONTEXT_SECRET;
    delete process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID;
  }
  try { return await work(); }
  finally {
    if (previous.mode === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE; else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previous.mode;
    if (previous.secret === undefined) delete process.env.RUPAYKG_REQUEST_CONTEXT_SECRET; else process.env.RUPAYKG_REQUEST_CONTEXT_SECRET = previous.secret;
    if (previous.keyId === undefined) delete process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID; else process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID = previous.keyId;
  }
}

async function makeApp(pool: TenantPool, requestContext: RlsRequestContextConfig | null = config) {
  const app = Fastify();
  await registerWorkspaceRoutes(app, asPool(pool), requestContext);
  return app;
}

function requestHeaders(organizationId = organizationA) {
  return { authorization: "Bearer synthetic-session-token", "x-rupaykg-organization-id": organizationId };
}

test("MRV workspace binds permission and all four protected reads to one signed tenant client", async () => {
  await withEnvironment(async () => {
    const pool = new TenantPool();
    const app = await makeApp(pool);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/workspaces/mrv", headers: requestHeaders() });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().source, "postgresql");
      assert.equal(response.json().syntheticData, false);
      assert.equal(pool.clients.length, 1);
      const calls = pool.clients[0]!.calls;
      assert.equal(calls[0]?.sql, "BEGIN");
      assert.ok(calls[1]?.sql.includes("set_config('app.request_context', $1, true)"));
      const signedClaims = String(calls[1]?.values?.[0]).split("|");
      assert.deepEqual(signedClaims.slice(0, 2), [identityId, organizationA]);
      assert.match(signedClaims[2] ?? "", /^\\d+$/);
      assert.match(signedClaims[3] ?? "", /^\\d+$/);
      assert.match(signedClaims[4] ?? "", /^mrv_workspace_test\\.[a-f0-9]{64}$/);
      const permission = calls.find((call) => call.sql.includes("auth_private.has_organization_permission"));
      assert.deepEqual(permission?.values, [identityId, organizationA, ["evidence:upload", "evidence:review", "guardian:read"]]);
      const protectedReads = calls.filter((call) => /select .* from (activities a|measurements m|evidence e|verifications v)/is.test(call.sql));
      assert.equal(protectedReads.length, 4);
      for (const call of protectedReads) assert.deepEqual(call.values, [organizationA]);
      assert.equal(calls.at(-1)?.sql, "COMMIT");
      assert.equal(pool.clients[0]!.released, true);
      assert.equal(pool.rawCalls.filter((call) => /from (activities|measurements|evidence|verifications)/i.test(call.sql)).length, 0);
    } finally { await app.close(); }
  });
});

test("MRV workspace permission denial rolls back before returning 403 and performs no protected read", async () => {
  await withEnvironment(async () => {
    const pool = new TenantPool(); pool.permission = false;
    const app = await makeApp(pool);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/workspaces/mrv", headers: requestHeaders() });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().code, "WORKSPACE_READ_FORBIDDEN");
      const calls = pool.clients[0]!.calls;
      assert.equal(calls.at(-1)?.sql, "ROLLBACK");
      assert.equal(calls.some((call) => /from (activities a|measurements m|evidence e|verifications v)/is.test(call.sql)), false);
    } finally { await app.close(); }
  });
});

test("MRV workspace denies an out-of-scope geography and rolls back before protected reads", async () => {
  await withEnvironment(async () => {
    const pool = new TenantPool(); pool.geographyAllowed = false;
    const app = await makeApp(pool);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/workspaces/mrv?geographyId=" + geographyA, headers: requestHeaders() });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().code, "GEOGRAPHY_FORBIDDEN");
      const calls = pool.clients[0]!.calls;
      assert.equal(calls.at(-1)?.sql, "ROLLBACK");
      assert.equal(calls.some((call) => /from (activities a|measurements m|evidence e|verifications v)/is.test(call.sql)), false);
    } finally { await app.close(); }
  });
});

test("MRV workspace fails closed when signed tenant context is not configured", async () => {
  await withEnvironment(async () => {
    const pool = new TenantPool();
    const app = await makeApp(pool, null);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/workspaces/mrv", headers: requestHeaders() });
      assert.equal(response.statusCode, 503);
      assert.equal(response.json().code, "TENANT_CONTEXT_UNAVAILABLE");
      assert.equal(pool.clients.length, 0);
    } finally { await app.close(); }
  }, false);
});

test("MRV workspace fails closed when the authenticated identity has no verified active organization", async () => {
  await withEnvironment(async () => {
    const pool = new TenantPool();
    pool.resolverRows = [{ identity_id: identityId, organization_id: null, role_id: null, membership_status: null }];
    const app = await makeApp(pool);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/workspaces/mrv", headers: { authorization: "Bearer synthetic-session-token" } });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().code, "RLS_ORGANIZATION_CONTEXT_REQUIRED");
      assert.equal(pool.clients.length, 0);
    } finally { await app.close(); }
  });
});

test("MRV workspace rolls back on protected-read failure and never returns partial data", async () => {
  await withEnvironment(async () => {
    const pool = new TenantPool(); pool.failProtectedRead = true;
    const app = await makeApp(pool);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/workspaces/mrv", headers: requestHeaders() });
      assert.equal(pool.clients[0]!.failProtectedRead, true);
      assert.equal(pool.clients[0]!.protectedReadFailureTriggered, true);
      assert.equal(response.statusCode, 503);
      assert.equal(response.json().code, "MRV_WORKSPACE_UNAVAILABLE");
      const calls = pool.clients[0]!.calls;
      assert.equal(calls.at(-1)?.sql, "ROLLBACK");
      assert.equal(calls.some((call) => call.sql === "COMMIT"), false);
    } finally { await app.close(); }
  });
});
