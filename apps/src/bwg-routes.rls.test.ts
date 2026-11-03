import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerBwgRoutes } from "./bwg-routes.js";

type Call = { sql: string; values?: unknown[] };
const identityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherOrganizationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

class ObligationClient {
  calls: Call[] = [];
  released = false;
  permission = true;
  failList = false;

  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("auth_private.has_organization_permission")) return { rows: [{ ok: this.permission }], rowCount: 1 };
    if (sql.includes("from epr_obligations eo")) {
      if (this.failList) throw new Error("synthetic obligation query failure");
      return { rows: [{ epr_obligation_id: "obligation-a", obligated_organization_id: organizationId }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  release() { this.released = true; }
}

class ObligationPool {
  rawCalls: Call[] = [];
  clients: ObligationClient[] = [];
  permission = true;
  failList = false;
  resolverRows: Array<Record<string, unknown>> = [{
    identity_id: identityId,
    organization_id: organizationId,
    role_id: "role-epr-reader",
    membership_status: "VERIFIED",
  }];

  async query(sql: string, values?: unknown[]) {
    this.rawCalls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("auth_private.resolve_session")) return { rows: this.resolverRows, rowCount: this.resolverRows.length };
    return { rows: [], rowCount: 0 };
  }

  async connect() {
    const client = new ObligationClient();
    client.permission = this.permission;
    client.failList = this.failList;
    this.clients.push(client);
    return client;
  }
}

function asPool(pool: ObligationPool): Pool { return pool as unknown as Pool; }

async function withEnvironment<T>(work: () => Promise<T>, options: { context?: boolean } = {}): Promise<T> {
  const previous = {
    mode: process.env.RUPAYKG_AUTH_RESOLVER_MODE,
    secret: process.env.RUPAYKG_REQUEST_CONTEXT_SECRET,
    keyId: process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID,
  };
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  if (options.context === false) {
    delete process.env.RUPAYKG_REQUEST_CONTEXT_SECRET;
    delete process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID;
  } else {
    process.env.RUPAYKG_REQUEST_CONTEXT_SECRET = "epr-obligation-test-secret-material-at-least-32-bytes";
    process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID = "epr_obligation_test";
  }
  try { return await work(); }
  finally {
    if (previous.mode === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE; else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previous.mode;
    if (previous.secret === undefined) delete process.env.RUPAYKG_REQUEST_CONTEXT_SECRET; else process.env.RUPAYKG_REQUEST_CONTEXT_SECRET = previous.secret;
    if (previous.keyId === undefined) delete process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID; else process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID = previous.keyId;
  }
}

async function makeApp(pool: ObligationPool) {
  const app = Fastify();
  await registerBwgRoutes(app, asPool(pool));
  return app;
}

test("EPR obligations read checks permission and reads only the active tenant on one signed transaction client", async () => {
  await withEnvironment(async () => {
    const pool = new ObligationPool();
    const app = await makeApp(pool);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epr/obligations?organizationId=" + otherOrganizationId,
        headers: { authorization: "Bearer valid-session", "x-rupaykg-organization-id": organizationId },
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().obligations[0].obligated_organization_id, organizationId);
      assert.equal(pool.clients.length, 1);
      assert.equal(pool.rawCalls.filter((call) => call.sql.includes("auth_private.resolve_session")).length, 1);
      const calls = pool.clients[0]!.calls;
      assert.equal(calls[0]?.sql, "BEGIN");
      assert.ok(calls[1]?.sql.includes("set_config('app.request_context', $1, true)"));
      assert.match(String(calls[1]?.values?.[0]), /^11111111-1111-4111-8111-111111111111\|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\|[0-9]+\|[0-9]+\|epr_obligation_test\.[a-f0-9]{64}$/);
      const permission = calls.find((call) => call.sql.includes("auth_private.has_organization_permission"));
      assert.deepEqual(permission?.values, [identityId, organizationId, ["epr:read", "epr:manage", "reports:read"]]);
      const listing = calls.find((call) => call.sql.includes("from epr_obligations eo"));
      assert.deepEqual(listing?.values, [organizationId]);
      assert.equal(calls.at(-1)?.sql, "COMMIT");
      assert.equal(pool.clients[0]!.released, true);
    } finally { await app.close(); }
  });
});

test("EPR obligations rejects an organization header outside verified membership before opening a transaction", async () => {
  await withEnvironment(async () => {
    const pool = new ObligationPool();
    const app = await makeApp(pool);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epr/obligations",
        headers: { authorization: "Bearer valid-session", "x-rupaykg-organization-id": otherOrganizationId },
      });
      assert.equal(response.statusCode, 401);
      assert.equal(pool.clients.length, 0);
    } finally { await app.close(); }
  });
});

test("EPR obligations requires explicit organization selection for multi-organization identities", async () => {
  await withEnvironment(async () => {
    const pool = new ObligationPool();
    pool.resolverRows = [
      { identity_id: identityId, organization_id: organizationId, role_id: "role-a", membership_status: "VERIFIED" },
      { identity_id: identityId, organization_id: otherOrganizationId, role_id: "role-b", membership_status: "VERIFIED" },
    ];
    const app = await makeApp(pool);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/epr/obligations", headers: { authorization: "Bearer valid-session" } });
      assert.equal(response.statusCode, 401);
      assert.equal(pool.clients.length, 0);
    } finally { await app.close(); }
  });
});

test("EPR obligations fails closed when signed tenant context is not configured", async () => {
  await withEnvironment(async () => {
    const pool = new ObligationPool();
    const app = await makeApp(pool);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/epr/obligations", headers: { authorization: "Bearer valid-session" } });
      assert.equal(response.statusCode, 503);
      assert.equal(response.json().code, "TENANT_CONTEXT_UNAVAILABLE");
      assert.equal(pool.clients.length, 0);
    } finally { await app.close(); }
  }, { context: false });
});

test("EPR obligations rolls back on permission denial before reading tenant records", async () => {
  await withEnvironment(async () => {
    const pool = new ObligationPool();
    pool.permission = false;
    const app = await makeApp(pool);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/epr/obligations", headers: { authorization: "Bearer valid-session" } });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().code, "EPR_OBLIGATION_READ_FORBIDDEN");
      assert.equal(pool.clients[0]!.calls.some((call) => call.sql.includes("from epr_obligations eo")), false);
      assert.equal(pool.clients[0]!.calls.at(-1)?.sql, "ROLLBACK");
    } finally { await app.close(); }
  });
});

test("EPR obligations rolls back when the protected query fails", async () => {
  await withEnvironment(async () => {
    const pool = new ObligationPool();
    pool.failList = true;
    const app = await makeApp(pool);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/epr/obligations", headers: { authorization: "Bearer valid-session" } });
      assert.equal(response.statusCode, 503);
      assert.equal(pool.clients[0]!.calls.at(-1)?.sql, "ROLLBACK");
      assert.equal(pool.clients[0]!.released, true);
    } finally { await app.close(); }
  });
});
