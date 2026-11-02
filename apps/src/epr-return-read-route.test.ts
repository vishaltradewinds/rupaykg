import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "pg";
import { createContextAwarePool, registerRequestTenantContext } from "./tenant-db-context.js";
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
  permission = true;
  rows: Array<Record<string, unknown>> = [{ id: "return-a", organization_id: organizationId }];

  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("auth_private.has_organization_permission")) {
      return { rows: [{ ok: this.permission }], rowCount: 1 };
    }
    if (sql.includes("from epr_returns")) return { rows: this.rows, rowCount: this.rows.length };
    return { rows: [], rowCount: 0 };
  }

  release() { this.released = true; }
}

class EprPool {
  rawCalls: Call[] = [];
  clients: EprClient[] = [];
  resolverRows: Array<Record<string, unknown>> = [{
    identity_id: identityId,
    organization_id: organizationId,
    role_id: "role-epr-reader",
    membership_status: "VERIFIED",
  }];

  async query(sql: string, values?: unknown[]) {
    this.rawCalls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("auth_private.resolve_session")) {
      const requestedOrganizationId = String(values?.[0] ?? "");
      return { rows: this.resolverRows, rowCount: this.resolverRows.length };
    }
    return { rows: [], rowCount: 0 };
  }

  async connect() {
    const client = new EprClient();
    this.clients.push(client);
    return client;
  }
}

function asPool(pool: EprPool): Pool {
  return pool as unknown as Pool;
}

function bearerHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function makeApp(raw: EprPool) {
  const pool = createContextAwarePool(asPool(raw));
  const app = Fastify();
  registerRequestTenantContext(app, asPool(raw), config);
  await registerEprReturnReadRoute(app, pool);
  return app;
}

test("EPR list reads only the authenticated active organization inside the signed tenant transaction", async () => {
  const previousMode = process.env.RUPAYKG_AUTH_RESOLVER_MODE;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
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
    const calls = raw.clients[0]!.calls;
    assert.equal(calls[0]!.sql, "BEGIN");
    assert.match(calls[1]!.sql, /set_config\('app\.request_context'/);
    const permission = calls.find((call) => call.sql.includes("auth_private.has_organization_permission"));
    assert.deepEqual(permission?.values, [identityId, organizationId, ["epr:read", "epr:manage", "reports:read"]]);
    const listing = calls.find((call) => call.sql.includes("from epr_returns"));
    assert.deepEqual(listing?.values, [organizationId]);
    assert.equal(calls.at(-1)?.sql, "COMMIT");
    assert.equal(raw.clients[0]!.released, true);
    assert.equal(raw.rawCalls.filter((call) => call.sql.includes("auth_private.resolve_session")).length, 1);
  } finally {
    await app.close();
    if (previousMode === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;
    else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previousMode;
  }
});

test("EPR list rejects an organization header that is not a verified membership", async () => {
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

test("EPR list checks read permission in the same tenant transaction before selecting records", async () => {
  const previousMode = process.env.RUPAYKG_AUTH_RESOLVER_MODE;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  const raw = new EprPool();
  const app = await makeApp(raw);
  raw.clients.length = 0;
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/epr/returns",
      headers: {
        authorization: "Bearer valid-epr-session",
        "x-rupaykg-organization-id": organizationId,
      },
    });
    assert.equal(response.statusCode, 200);
    const calls = raw.clients[0]!.calls;
    assert.ok(calls.findIndex((call) => call.sql.includes("auth_private.has_organization_permission")) < calls.findIndex((call) => call.sql.includes("from epr_returns")));
  } finally {
    await app.close();
    if (previousMode === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;
    else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previousMode;
  }
});

test("EPR list does not open a tenant transaction without a bearer session", async () => {
  const raw = new EprPool();
  const app = await makeApp(raw);
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/epr/returns" });
    assert.equal(response.statusCode, 401);
    assert.equal(raw.clients.length, 0);
  } finally {
    await app.close();
  }
});

test("EPR list permission denial prevents protected record reads and rolls back", async () => {
  const previousMode = process.env.RUPAYKG_AUTH_RESOLVER_MODE;
  process.env.RUPAYKG_AUTH_RESOLVER_MODE = "security_definer";
  const raw = new EprPool();
  const app = await makeApp(raw);
  try {
    // The fake client defaults to permission=false for this case.
    raw.clients[0]!.permission = false;
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
    assert.equal(raw.clients[0]!.calls.some((call) => call.sql.includes("from epr_returns")), false);
    assert.equal(raw.clients[0]!.calls.at(-1)?.sql, "ROLLBACK");
  } finally {
    await app.close();
    if (previousMode === undefined) delete process.env.RUPAYKG_AUTH_RESOLVER_MODE;
    else process.env.RUPAYKG_AUTH_RESOLVER_MODE = previousMode;
  }
});
