import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool, PoolClient } from "pg";
import { registerEprReturnRoutes } from "./epr-return-routes.js";

const identityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

class RoutePool {
  poolCalls: string[] = [];
  clientCalls: string[] = [];
  permission = true;
  rows = [{ id: "return-a", organization_id: organizationId }];
  async query(sql: string) {
    this.poolCalls.push(sql);
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
    if (sql.includes("from organization_memberships")) return { rows: [{ organization_id: organizationId, role_id: "role-a", status: "VERIFIED" }] };
    throw new Error("Unexpected direct pool query: " + sql);
  }
  async connect() {
    const self = this;
    return {
      async query(sql: string) {
        self.clientCalls.push(sql);
        if (sql.includes("has_organization_permission") || sql.includes("jsonb_array_elements_text")) return { rows: [{ ok: self.permission }] };
        if (sql.includes("from epr_returns")) return { rows: self.rows };
        return { rows: [] };
      },
      release() {},
    } as unknown as PoolClient;
  }
}

async function setup(pool: RoutePool) {
  const app = Fastify();
  await registerEprReturnRoutes(app, pool as unknown as Pool);
  await app.ready();
  return app;
}

test("EPR return list runs permission and data queries on one signed tenant transaction client", async () => {
  const pool = new RoutePool();
  const previous = {
    secret: process.env.RUPAYKG_REQUEST_CONTEXT_SECRET,
    key: process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID,
    mode: process.env.RUPAYKG_AUTH_RESOLVER_MODE,
  };
  process.env.RUPAYKG_REQUEST_CONTEXT_SECRET = "unit-test-request-context-secret-at-least-32-bytes";
  process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID = "test_key";
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "legacy";
  const app = await setup(pool);
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/epr/returns", headers: { authorization: "Bearer test-token" } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().returns[0].id, "return-a");
    assert.equal(pool.poolCalls.length, 2, "pool is used only for initial session authentication");
    assert.deepEqual(pool.clientCalls.slice(0, 2), [
      "BEGIN",
      "select set_config('app.request_context', $1, true)",
    ]);
    assert.ok(pool.clientCalls.some(sql => sql.includes("has_organization_permission") || sql.includes("jsonb_array_elements_text")));
    assert.ok(pool.clientCalls.some(sql => sql.includes("from epr_returns")));
    assert.equal(pool.clientCalls.at(-1), "COMMIT");
  } finally {
    await app.close();
    if (previous.secret === undefined) delete process.env.RUPAYKG_REQUEST_CONTEXT_SECRET; else process.env.RUPAYKG_REQUEST_CONTEXT_SECRET = previous.secret;
    if (previous.key === undefined) delete process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID; else process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID = previous.key;
    if (previous.mode === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE; else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previous.mode;
  }
});

test("EPR return list denies an organization header that is not a verified membership", async () => {
  const pool = new RoutePool();
  const app = await setup(pool);
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/epr/returns",
      headers: {
        authorization: "Bearer test-token",
        "x-rupaykg-organization-id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
    });
    assert.equal(response.statusCode, 401);
    assert.equal(pool.clientCalls.length, 0, "no tenant transaction is opened for a forged organization");
  } finally { await app.close(); }
});

test("EPR return list fails closed when signed tenant context is not configured", async () => {
  const pool = new RoutePool();
  const previous = {
    secret: process.env.RUPAYKG_REQUEST_CONTEXT_SECRET,
    key: process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID,
    mode: process.env.RUPAYKG_AUTH_RESOLVER_MODE,
  };
  delete process.env.RUPAYKG_REQUEST_CONTEXT_SECRET;
  delete process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "legacy";
  const app = await setup(pool);
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/epr/returns", headers: { authorization: "Bearer test-token" } });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, "RLS_CONTEXT_UNAVAILABLE");
    assert.equal(pool.clientCalls.length, 0);
  } finally {
    await app.close();
    if (previous.secret === undefined) delete process.env.RUPAYKG_REQUEST_CONTEXT_SECRET; else process.env.RUPAYKG_REQUEST_CONTEXT_SECRET = previous.secret;
    if (previous.key === undefined) delete process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID; else process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID = previous.key;
    if (previous.mode === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE; else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previous.mode;
  }
});
