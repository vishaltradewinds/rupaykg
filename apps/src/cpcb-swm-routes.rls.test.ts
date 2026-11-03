import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerCpcbSwmRoutes } from "./cpcb-swm-routes.js";
import type { RlsRequestContextConfig } from "./rls-request-transaction.js";

const identityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const config: RlsRequestContextConfig = {
  hmacSecret: "cpcb-swm-route-test-hmac-secret-material-at-least-32-bytes",
  keyId: "cpcb_swm_test",
  ttlSeconds: 120,
};

class Client {
  calls: Array<{ sql: string; values?: unknown[] }> = [];
  released = false;
  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("auth_private.has_organization_permission")) return { rows: [{ ok: true }], rowCount: 1 };
    if (sql.includes("from cpcb_swm_stakeholder_workspaces")) return { rows: [{ id: "workspace-a", organization_id: organizationId }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }
  release() { this.released = true; }
}
class RawPool {
  rawCalls: Array<{ sql: string; values?: unknown[] }> = [];
  clients: Client[] = [];
  async query(sql: string, values?: unknown[]) {
    this.rawCalls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("auth_private.resolve_session")) return { rows: [{ identity_id: identityId, organization_id: organizationId, role_id: "role-swm-reader", membership_status: "VERIFIED" }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }
  async connect() { const client = new Client(); this.clients.push(client); return client; }
}
async function withSecurityDefiner<T>(work: () => Promise<T>): Promise<T> {
  const previous = process.env.RUPAYKG_AUTH_RESOLVER_MODE;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  try { return await work(); }
  finally { if (previous === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE; else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previous; }
}
test("CPCB SWM workspace reads use signed active-tenant transaction and same-client permission check", async () => {
  await withSecurityDefiner(async () => {
    const raw = new RawPool(), app = Fastify();
    await registerCpcbSwmRoutes(app, raw as unknown as Pool, config);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/cpcb-swm/workspaces", headers: { authorization: "Bearer valid-cpcb-session" } });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().workspaces[0].id, "workspace-a");
      assert.equal(raw.clients.length, 1);
      const calls = raw.clients[0]!.calls;
      assert.equal(calls[0]?.sql, "BEGIN");
      assert.ok(calls.some(call => call.sql.includes("auth_private.has_organization_permission")));
      const listing = calls.find(call => call.sql.includes("from cpcb_swm_stakeholder_workspaces"));
      assert.deepEqual(listing?.values, [organizationId]);
      assert.equal(raw.rawCalls.some(call => call.sql.includes("from cpcb_swm_stakeholder_workspaces")), false);
      assert.equal(calls.at(-1)?.sql, "COMMIT");
      assert.equal(raw.clients[0]!.released, true);
    } finally { await app.close(); }
  });
});
test("CPCB SWM workspace reads fail closed without signed request context", async () => {
  await withSecurityDefiner(async () => {
    const raw = new RawPool(), app = Fastify();
    await registerCpcbSwmRoutes(app, raw as unknown as Pool);
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/cpcb-swm/workspaces", headers: { authorization: "Bearer valid-cpcb-session" } });
      assert.equal(response.statusCode, 503);
      assert.equal(response.json().code, "RLS_CONTEXT_CONFIG_REQUIRED");
      assert.equal(raw.clients.length, 0);
    } finally { await app.close(); }
  });
});
