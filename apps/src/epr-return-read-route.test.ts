import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool, PoolClient } from "pg";
import { registerEprReturnReadRoute } from "./epr-return-read-route.js";
import type { RlsRequestContextConfig } from "./rls-request-transaction.js";

type Call = { sql: string; values?: unknown[] };

const identityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherOrganizationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const config: RlsRequestContextConfig = {
  hmacSecret: "epr-route-test-hmac-secret-material-at-least-32-bytes",
  keyId: "epr_test",
  ttlSeconds: 120,
};

class EprClient {
  calls: Call[] = [];
  released = false;
  releaseError: Error | boolean | undefined;
  permission = true;
  failList = false;
  rows: Array<Record<string, unknown>> = [{ id: "return-a", organization_id: organizationId }];

  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("auth_private.has_organization_permission")) {
      return { rows: [{ ok: this.permission }], rowCount: 1 };
    }
    if (sql.includes("from public.epr_returns")) {
      if (this.failList) throw new Error("synthetic EPR list failure");
      return { rows: this.rows, rowCount: this.rows.length };
    }
    return { rows: [], rowCount: 0 };
  }

  release(error?: Error | boolean) {
    this.released = true;
    this.releaseError = error;
  }
}

class EprPool {
  rawCalls: Call[] = [];
  clients: EprClient[] = [];
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
    if (sql.includes("auth_private.resolve_session")) {
      return { rows: this.resolverRows, rowCount: this.resolverRows.length };
    }
    return { rows: [], rowCount: 0 };
  }

  async connect() {
    const client = new EprClient();
    client.permission = this.permission;
    client.failList = this.failList;
    this.clients.push(client);
    return client;
  }
}

function asPool(pool: EprPool): Pool {
  return pool as unknown as Pool;
}

async function withSecurityDefiner<T>(work: () => Promise<T>): Promise<T> {
  const previousMode = process.env.RUPAYKG_AUTH_RESOLVER_MODE;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  try {
    return await work();
  } finally {
    if (previousMode === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;
    else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previousMode;
  }
}

async function makeApp(raw: EprPool) {
  const app = Fastify();
  await registerEprReturnReadRoute(app, asPool(raw), config);
  return app;
}

test("EPR list authenticates first, then checks permission and reads only the active tenant on one signed client", async () => {
  await withSecurityDefiner(async () => {
    const raw = new EprPool();
    const app = await makeApp(raw);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epr/returns?organizationId=" + otherOrganizationId,
        headers: {
          authorization: "Bearer valid-epr-session",
          "x-rupaykg-organization-id": organizationId,
        },
      });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().returns[0].organization_id, organizationId);
      assert.equal(raw.rawCalls.filter((call) => call.sql.includes("auth_private.resolve_session")).length, 1);
      assert.equal(raw.clients.length, 1);
      const calls = raw.clients[0]!.calls;
      assert.deepEqual(calls.map((call) => call.sql.startsWith("select set_config") ? "SET_CONTEXT" : call.sql), [
        "BEGIN",
        "SET_CONTEXT",
        calls[2]!.sql,
        calls[3]!.sql,
        "COMMIT",
      ]);
      const permission = calls.find((call) => call.sql.includes("auth_private.has_organization_permission"));
      assert.deepEqual(permission?.values, [identityId, organizationId, ["epr:read", "epr:manage", "reports:read"]]);
      const listing = calls.find((call) => call.sql.includes("from public.epr_returns"));
      assert.deepEqual(listing?.values, [organizationId]);
      assert.match(String(calls[1]?.values?.[0]), /^11111111-1111-4111-8111-111111111111\|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\|[0-9]+\|[0-9]+\|epr_test\.[a-f0-9]{64}$/);
      assert.equal(calls.at(-1)?.sql, "COMMIT");
      assert.equal(raw.clients[0]!.released, true);
    } finally {
      await app.close();
    }
  });
});

test("EPR list rejects a tenant header outside verified memberships before opening a transaction", async () => {
  await withSecurityDefiner(async () => {
    const raw = new EprPool();
    const app = await makeApp(raw);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epr/returns",
        headers: {
          authorization: "Bearer valid-epr-session",
          "x-rupaykg-organization-id": otherOrganizationId,
        },
      });
      assert.equal(response.statusCode, 401);
      assert.equal(raw.clients.length, 0);
    } finally {
      await app.close();
    }
  });
});

test("EPR list requires explicit active organization selection for multi-organization identities", async () => {
  await withSecurityDefiner(async () => {
    const raw = new EprPool();
    raw.resolverRows = [
      { identity_id: identityId, organization_id: organizationId, role_id: "role-a", membership_status: "VERIFIED" },
      { identity_id: identityId, organization_id: otherOrganizationId, role_id: "role-b", membership_status: "VERIFIED" },
    ];
    const app = await makeApp(raw);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epr/returns",
        headers: { authorization: "Bearer valid-epr-session" },
      });
      assert.equal(response.statusCode, 401);
      assert.equal(raw.clients.length, 0);
    } finally {
      await app.close();
    }
  });
});

test("EPR list does not open a tenant transaction without a bearer session", async () => {
  const raw = new EprPool();
  const app = await makeApp(raw);
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/epr/returns" });
    assert.equal(response.statusCode, 401);
    assert.equal(raw.rawCalls.length, 0);
    assert.equal(raw.clients.length, 0);
  } finally {
    await app.close();
  }
});

test("EPR list permission denial rolls back before protected record reads", async () => {
  await withSecurityDefiner(async () => {
    const raw = new EprPool();
    raw.permission = false;
    const app = await makeApp(raw);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epr/returns",
        headers: {
          authorization: "Bearer valid-epr-session",
          "x-rupaykg-organization-id": organizationId,
        },
      });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().code, "EPR_RETURN_READ_FORBIDDEN");
      assert.equal(raw.clients[0]!.calls.some((call) => call.sql.includes("from public.epr_returns")), false);
      assert.equal(raw.clients[0]!.calls.at(-1)?.sql, "ROLLBACK");
      assert.equal(raw.clients[0]!.released, true);
    } finally {
      await app.close();
    }
  });
});

test("EPR list query failure rolls back the tenant transaction", async () => {
  await withSecurityDefiner(async () => {
    const raw = new EprPool();
    raw.failList = true;
    const app = await makeApp(raw);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epr/returns",
        headers: {
          authorization: "Bearer valid-epr-session",
          "x-rupaykg-organization-id": organizationId,
        },
      });
      assert.equal(response.statusCode, 503);
      assert.equal(raw.clients[0]!.calls.at(-1)?.sql, "ROLLBACK");
    } finally {
      await app.close();
    }
  });
});
