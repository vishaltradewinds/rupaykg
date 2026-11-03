import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool, PoolClient } from "pg";
import { registerWorkspaceRoutes } from "./workspace-routes.js";

const identityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

class WorkspaceReadPool {
  readonly tenantCalls: string[] = [];
  sharedCalls = 0;
  connectCalls = 0;

  async query(sql: string) {
    this.sharedCalls++;
    if (sql.includes("auth_private.resolve_session")) {
      return { rows: [{ identity_id: identityId, organization_id: organizationId, role_id: "role-reader", membership_status: "VERIFIED" }], rowCount: 1 };
    }
    throw new Error("Unexpected shared-pool query: " + sql);
  }

  async connect() {
    this.connectCalls++;
    const owner = this;
    return {
      async query(sql: string) {
        owner.tenantCalls.push(sql);
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.includes("set_config('app.request_context'")) return { rows: [], rowCount: 0 };
        if (sql.includes("auth_private.has_organization_permission")) return { rows: [{ ok: true }], rowCount: 1 };
        if (sql.startsWith("select ")) return { rows: [], rowCount: 0 };
        throw new Error("Unexpected tenant query: " + sql);
      },
      release() {},
    } as unknown as PoolClient;
  }
}

test("workspace tenant reads authorize and query on the same signed transaction client", async () => {
  const previous = process.env.RUPAYKG_AUTH_RESOLVER_MODE;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  const pool = new WorkspaceReadPool();
  const app = Fastify();
  try {
    await registerWorkspaceRoutes(app, pool as unknown as Pool, { hmacSecret: "x".repeat(48), keyId: "test-key" });
    for (const path of [
      "/api/v1/workspaces/resource-flows",
      "/api/v1/workspaces/compliance",
      "/api/v1/workspaces/carbon",
      "/api/v1/workspaces/registry",
      "/api/v1/workspaces/esg",
    ]) {
      const response = await app.inject({ method: "GET", url: path, headers: { authorization: "Bearer valid-workspace-session" } });
      assert.equal(response.statusCode, 200, path);
      assert.equal(response.json().syntheticData, false, path);
    }
    assert.equal(pool.sharedCalls, 5, "only authentication may use the shared pool");
    assert.equal(pool.connectCalls, 5, "each workspace read gets its own checked-out transaction client");
    assert.equal(pool.tenantCalls.filter((sql) => sql.includes("auth_private.has_organization_permission")).length, 5);
    assert.equal(pool.tenantCalls.filter((sql) => sql === "COMMIT").length, 5);
    assert.ok(pool.tenantCalls.some((sql) => sql.includes("from resource_flows")));
    assert.ok(pool.tenantCalls.some((sql) => sql.includes("from obligations")));
    assert.ok(pool.tenantCalls.some((sql) => sql.includes("from carbon_calculations")));
    assert.ok(pool.tenantCalls.some((sql) => sql.includes("from credentials")));
    assert.ok(pool.tenantCalls.some((sql) => sql.includes("from esg_reporting_periods")));
  } finally {
    await app.close();
    if (previous === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;
    else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previous;
  }
});

test("settlement workspace remains unavailable until a multi-party authorization context exists", async () => {
  const pool = new WorkspaceReadPool();
  const app = Fastify();
  try {
    await registerWorkspaceRoutes(app, pool as unknown as Pool, { hmacSecret: "x".repeat(48), keyId: "test-key" });
    const response = await app.inject({ method: "GET", url: "/api/v1/workspaces/settlement" });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, "SETTLEMENT_MULTI_PARTY_CONTEXT_REQUIRED");
    assert.equal(pool.sharedCalls, 0);
    assert.equal(pool.connectCalls, 0);
  } finally { await app.close(); }
});
