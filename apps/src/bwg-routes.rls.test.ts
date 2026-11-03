import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerBwgRoutes } from "./bwg-routes.js";
import type { RlsRequestContextConfig } from "./rls-request-transaction.js";

const identityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const config: RlsRequestContextConfig = {
  hmacSecret: "bwg-route-test-hmac-secret-material-at-least-32-bytes",
  keyId: "bwg_test",
  ttlSeconds: 120,
};

class Client {
  calls: Array<{ sql: string; values?: unknown[] }> = [];
  released = false;
  permission = true;
  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("auth_private.has_organization_permission")) return { rows: [{ ok: this.permission }], rowCount: 1 };
    if (sql.includes("from epr_obligations")) return { rows: [{ epr_obligation_id: "obligation-a" }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }
  release() { this.released = true; }
}

class RawPool {
  rawCalls: Array<{ sql: string; values?: unknown[] }> = [];
  clients: Client[] = [];
  async query(sql: string, values?: unknown[]) {
    this.rawCalls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("auth_private.resolve_session")) return { rows: [{ identity_id: identityId, organization_id: organizationId, role_id: "role-epr-reader", membership_status: "VERIFIED" }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }
  async connect() { const client = new Client(); this.clients.push(client); return client; }
}

async function makeApp(raw: RawPool) {
  const app = Fastify();
  await registerBwgRoutes(app, raw as unknown as Pool, config);
  return app;
}

async function withSecurityDefiner<T>(work: () => Promise<T>): Promise<T> {
  const previous = process.env.RUPAYKG_AUTH_RESOLVER_MODE;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  try { return await work(); }
  finally {
    if (previous === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;
    else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previous;
  }
}

test("EPR obligations reads use the signed active-tenant transaction, not caller-selected tenant headers", async () => {
  await withSecurityDefiner(async () => {
    const raw = new RawPool();
    const app = await makeApp(raw);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epr/obligations",
        headers: { authorization: "Bearer valid-bwg-session" },
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().obligations[0].epr_obligation_id, "obligation-a");
      assert.equal(raw.clients.length, 1);
      const calls = raw.clients[0]!.calls;
      assert.deepEqual(calls.map(call => call.sql.startsWith("select set_config") ? "SET_CONTEXT" : call.sql), [
        "BEGIN", "SET_CONTEXT", calls[2]!.sql, calls[3]!.sql, "COMMIT",
      ]);
      const permission = calls.find(call => call.sql.includes("auth_private.has_organization_permission"));
      assert.deepEqual(permission?.values, [identityId, organizationId, ["epr:read", "epr:manage", "reports:read"]]);
      const listing = calls.find(call => call.sql.includes("from epr_obligations"));
      assert.deepEqual(listing?.values, [organizationId]);
      assert.equal(raw.clients[0]!.released, true);
      assert.equal(raw.rawCalls.some(call => call.sql.includes("from epr_obligations")), false);
    } finally { await app.close(); }
  });
});

test("EPR obligations reject a caller-selected organization outside the authenticated membership", async () => {
  await withSecurityDefiner(async () => {
    const raw = new RawPool();
    const app = await makeApp(raw);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epr/obligations",
        headers: { authorization: "Bearer valid-bwg-session", "x-rupaykg-organization-id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      });
      assert.equal(response.statusCode, 401);
      assert.equal(raw.clients.length, 0);
      assert.equal(raw.rawCalls.some(call => call.sql.includes("from epr_obligations")), false);
    } finally { await app.close(); }
  });
});

test("EPR obligations fail closed without signed request context configuration", async () => {
  await withSecurityDefiner(async () => {
    const raw = new RawPool();
    const app = Fastify();
    await registerBwgRoutes(app, raw as unknown as Pool);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/epr/obligations", headers: { authorization: "Bearer valid-bwg-session" } });
      assert.equal(response.statusCode, 503);
      assert.equal(response.json().code, "RLS_CONTEXT_CONFIG_REQUIRED");
      assert.equal(raw.clients.length, 0);
    } finally { await app.close(); }
  });
});

test("EPR obligations permission denial rolls back before protected reads", async () => {
  await withSecurityDefiner(async () => {
    const raw = new RawPool();
    const app = await makeApp(raw);
    raw.clients = [];
    const originalConnect = raw.connect.bind(raw);
    raw.connect = async () => { const client = new Client(); client.permission = false; raw.clients.push(client); return client; };
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/epr/obligations", headers: { authorization: "Bearer valid-bwg-session" } });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().code, "EPR_OBLIGATION_READ_FORBIDDEN");
      assert.equal(raw.clients[0]!.calls.some(call => call.sql.includes("from epr_obligations")), false);
      assert.equal(raw.clients[0]!.calls.at(-1)?.sql, "ROLLBACK");
    } finally { await app.close(); void originalConnect; }
  });
});
