import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "pg";
import {
  beginRequestDatabaseContext,
  createContextAwarePool,
  finishRequestDatabaseContext,
  registerRequestTenantContext,
  runWithRequestDatabaseContext,
} from "./tenant-db-context.js";
import { authenticate, type AuthContext } from "./auth.js";
import type { RlsRequestContextConfig } from "./rls-request-transaction.js";

type QueryCall = { sql: string; values?: unknown[] };
type ResolverRow = {
  identity_id: string;
  organization_id: string | null;
  role_id: string | null;
  membership_status: string | null;
};

class FakeClient {
  calls: QueryCall[] = [];
  released = false;
  releaseError: Error | boolean | undefined;
  failSql: string | undefined;

  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql === this.failSql) throw new Error("synthetic query failure");
    return { rows: [], rowCount: 0 };
  }

  release(error?: Error | boolean) {
    this.released = true;
    this.releaseError = error;
  }
}

class FakePool {
  rawQueries: QueryCall[] = [];
  clients: FakeClient[] = [];
  resolverRows: ResolverRow[] = [];
  resolverByHash = new Map<string, ResolverRow[]>();

  async query(sql: string, values?: unknown[]) {
    this.rawQueries.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("auth_private.resolve_session")) {
      const hash = String(values?.[0] ?? "");
      const rows = this.resolverByHash.get(hash) ?? this.resolverRows;
      return { rows, rowCount: rows.length };
    }
    return { rows: [], rowCount: 0 };
  }

  async connect() {
    const client = new FakeClient();
    this.clients.push(client);
    return client;
  }
}

const config: RlsRequestContextConfig = {
  hmacSecret: "unit-test-hmac-secret-material-which-is-long-enough",
  keyId: "test_key",
  ttlSeconds: 120,
};
const identityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const auth: AuthContext = {
  identityId,
  activeOrganizationId: organizationId,
  memberships: [{ organization_id: organizationId, role_id: "role-a", status: "VERIFIED" }],
};

function membership(identity: string, organization: string): ResolverRow {
  return {
    identity_id: identity,
    organization_id: organization,
    role_id: "role-a",
    membership_status: "VERIFIED",
  };
}

function bearerHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function asPool(pool: FakePool): Pool {
  return pool as unknown as Pool;
}

test("preHandler binds direct pool queries and nested pool.connect transactions to one signed request transaction", async () => {
  const raw = new FakePool();
  raw.resolverRows = [membership(identityId, organizationId)];
  const pool = createContextAwarePool(asPool(raw));
  const app = Fastify();
  registerRequestTenantContext(app, asPool(raw), config);
  app.get("/api/v1/demo", async (request) => {
    const resolved = await authenticate(request, pool, "security_definer");
    assert.equal(resolved?.identityId, identityId);
    await pool.query("select 'request-query'");
    const client = await pool.connect();
    await client.query("BEGIN");
    await client.query("update tenant_rows set value='nested'");
    await client.query("COMMIT");
    client.release();
    return { ok: true };
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/demo",
      headers: { authorization: "Bearer synthetic-session" },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().ok, true);
  } finally {
    await app.close();
  }

  assert.equal(raw.clients.length, 1);
  const calls = raw.clients[0]!.calls;
  assert.deepEqual(calls.map((call) => call.sql), [
    "BEGIN",
    "select set_config('app.request_context', $1, true)",
    "select 'request-query'",
    "SAVEPOINT rupaykg_request_sp_1",
    "update tenant_rows set value='nested'",
    "RELEASE SAVEPOINT rupaykg_request_sp_1",
    "COMMIT",
  ]);
  const token = String(calls[1]!.values?.[0] ?? "");
  const tokenParts = token.split(".");
  assert.equal(tokenParts.length, 2);
  assert.deepEqual(tokenParts[0]!.split("|").slice(0, 2), [identityId, organizationId]);
  assert.match(tokenParts[0]!, /\|test_key$/);
  assert.equal(raw.rawQueries.filter((call) => call.sql.includes("auth_private.resolve_session")).length, 1);
  assert.equal(raw.clients[0]!.released, true);
});

test("a non-success HTTP response rolls back the request transaction", async () => {
  const raw = new FakePool();
  raw.resolverRows = [membership(identityId, organizationId)];
  const pool = createContextAwarePool(asPool(raw));
  const app = Fastify();
  registerRequestTenantContext(app, asPool(raw), config);
  app.get("/api/v1/deny", async (_request, reply) => reply.code(403).send({ ok: false }));

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/deny",
      headers: { authorization: "Bearer synthetic-session" },
    });
    assert.equal(response.statusCode, 403);
  } finally {
    await app.close();
  }

  assert.equal(raw.clients[0]!.calls.at(-1)?.sql, "ROLLBACK");
  assert.equal(raw.clients[0]!.released, true);
});

test("an invalid bearer token creates no tenant transaction and remains unauthenticated", async () => {
  const raw = new FakePool();
  const pool = createContextAwarePool(asPool(raw));
  const app = Fastify();
  registerRequestTenantContext(app, asPool(raw), config);
  app.get("/api/v1/secure", async (request, reply) => {
    const resolved = await authenticate(request, pool, "security_definer");
    return resolved ? { ok: true } : reply.code(401).send({ code: "AUTH_REQUIRED" });
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/secure",
      headers: { authorization: "Bearer invalid-session" },
    });
    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
  }

  assert.equal(raw.clients.length, 0);
  assert.equal(raw.rawQueries.filter((call) => call.sql.includes("auth_private.resolve_session")).length, 1);
});

test("bilateral settlement routes fail closed before acquiring a tenant transaction", async () => {
  const raw = new FakePool();
  const secondOrganization = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  raw.resolverRows = [membership(identityId, organizationId), membership(identityId, secondOrganization)];
  const app = Fastify();
  registerRequestTenantContext(app, asPool(raw), config);
  let handlerCalled = false;
  app.get("/api/v1/settlements/:id", async () => {
    handlerCalled = true;
    return { ok: true };
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/settlements/123",
      headers: {
        authorization: "Bearer synthetic-session",
        "x-rupaykg-organization-id": organizationId,
      },
    });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, "RLS_BILATERAL_CONTEXT_UNSUPPORTED");
  } finally {
    await app.close();
  }

  assert.equal(handlerCalled, false);
  assert.equal(raw.clients.length, 0);
});

test("valid identities without an active organization retain auth-only access without opening a tenant transaction", async () => {
  const raw = new FakePool();
  raw.resolverRows = [{
    identity_id: identityId,
    organization_id: null,
    role_id: null,
    membership_status: null,
  }];
  const pool = createContextAwarePool(asPool(raw));
  const app = Fastify();
  registerRequestTenantContext(app, asPool(raw), config);
  app.get("/api/v1/account-only", async (request) => {
    const resolved = await authenticate(request, pool, "security_definer");
    return { identityId: resolved?.identityId ?? null, hasActiveOrganization: Boolean(resolved?.activeOrganizationId) };
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/account-only",
      headers: { authorization: "Bearer synthetic-session" },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { identityId, hasActiveOrganization: false });
  } finally {
    await app.close();
  }

  assert.equal(raw.clients.length, 0);
});

test("concurrent requests never share a physical tenant transaction client", async () => {
  const raw = new FakePool();
  const identityA = "22222222-2222-4222-8222-222222222222";
  const identityB = "33333333-3333-4333-8333-333333333333";
  const tokenA = "session-a";
  const tokenB = "session-b";
  raw.resolverByHash.set(bearerHash(tokenA), [membership(identityA, organizationId)]);
  raw.resolverByHash.set(bearerHash(tokenB), [membership(identityB, "cccccccc-cccc-4ccc-8ccc-cccccccccccc")]);
  const pool = createContextAwarePool(asPool(raw));
  const app = Fastify();
  registerRequestTenantContext(app, asPool(raw), config);
  app.get("/api/v1/concurrent", async (request) => {
    const resolved = await authenticate(request, pool, "security_definer");
    await new Promise<void>((resolve) => setImmediate(resolve));
    await pool.query("select $1::text as actor", [resolved?.identityId]);
    return { identityId: resolved?.identityId ?? null };
  });

  try {
    const [responseA, responseB] = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/concurrent", headers: { authorization: "Bearer " + tokenA } }),
      app.inject({ method: "GET", url: "/api/v1/concurrent", headers: { authorization: "Bearer " + tokenB } }),
    ]);
    assert.equal(responseA.statusCode, 200);
    assert.equal(responseB.statusCode, 200);
    assert.equal(responseA.json().identityId, identityA);
    assert.equal(responseB.json().identityId, identityB);
  } finally {
    await app.close();
  }

  assert.equal(raw.clients.length, 2);
  for (const client of raw.clients) {
    const contextCall = client.calls.find((call) => call.sql.includes("set_config"));
    const actor = String(contextCall?.values?.[0] ?? "").split(".")[0]?.split("|")[0];
    assert.ok(actor === identityA || actor === identityB);
    assert.ok(client.calls.some((call) => call.sql === "select $1::text as actor" && call.values?.[0] === actor));
    assert.equal(client.released, true);
  }
});

test("a recoverable nested SQL error can roll back to its savepoint and commit the outer request", async () => {
  const raw = new FakePool();
  const context = await beginRequestDatabaseContext(asPool(raw), auth, config);
  const pool = createContextAwarePool(asPool(raw));
  raw.clients[0]!.failSql = "select fail_inside_savepoint";

  await runWithRequestDatabaseContext(context, async () => {
    const client = await pool.connect();
    await client.query("BEGIN");
    await assert.rejects(() => client.query("select fail_inside_savepoint"), /synthetic query failure/);
    await client.query("ROLLBACK");
    await client.query("select after_recovery");
    client.release();
  });
  await finishRequestDatabaseContext(context, true);

  assert.equal(raw.clients[0]!.calls.at(-1)?.sql, "COMMIT");
  assert.equal(raw.clients[0]!.released, true);
});

test("an unsupported isolation-level transaction command fails closed and rolls back", async () => {
  const raw = new FakePool();
  const context = await beginRequestDatabaseContext(asPool(raw), auth, config);
  const pool = createContextAwarePool(asPool(raw));

  await assert.rejects(
    () => runWithRequestDatabaseContext(context, () => pool.query("BEGIN ISOLATION LEVEL SERIALIZABLE")),
    /REQUEST_TRANSACTION_COMMAND_UNSUPPORTED/,
  );
  await finishRequestDatabaseContext(context, true);

  assert.equal(raw.clients[0]!.calls.at(-1)?.sql, "ROLLBACK");
});

test("an unclosed nested transaction fails closed and releases the physical client", async () => {
  const raw = new FakePool();
  const context = await beginRequestDatabaseContext(asPool(raw), auth, config);
  const pool = createContextAwarePool(asPool(raw));

  await runWithRequestDatabaseContext(context, async () => {
    const client = await pool.connect();
    await client.query("BEGIN");
    client.release();
  });

  await assert.rejects(() => finishRequestDatabaseContext(context, true), /REQUEST_TRANSACTION_UNCLOSED_SAVEPOINT/);
  assert.equal(raw.clients[0]!.calls.at(-1)?.sql, "ROLLBACK");
  assert.equal(raw.clients[0]!.released, true);
  assert.ok(raw.clients[0]!.releaseError instanceof Error);
});
