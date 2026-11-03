import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool, PoolClient } from "pg";
import { registerWorkspaceRoutes } from "./workspace-routes.js";

const identityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const evidenceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

class VerificationPool {
  readonly authMemberships: Array<{ organization_id: string | null; role_id: string | null; membership_status: string | null }>;
  readonly clientCalls: Array<{ sql: string; values?: unknown[] }> = [];
  connectCalls = 0;
  constructor(memberships: VerificationPool["authMemberships"]) { this.authMemberships = memberships; }
  async query(sql: string) {
    if (sql.includes("auth_private.resolve_session")) {
      return { rows: this.authMemberships.map((m) => ({ identity_id: identityId, ...m })), rowCount: this.authMemberships.length };
    }
    throw new Error("Unexpected shared-pool query: " + sql);
  }
  async connect() {
    this.connectCalls++;
    const owner = this;
    return {
      async query(sql: string, values?: unknown[]) {
        owner.clientCalls.push({ sql, ...(values ? { values } : {}) });
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.includes("set_config('app.request_context'")) return { rows: [], rowCount: 0 };
        if (sql.includes("select activity_id from evidence")) return { rows: [], rowCount: 0 };
        throw new Error("Unexpected tenant transaction query: " + sql);
      },
      release() {},
    } as unknown as PoolClient;
  }
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

test("evidence verification fails closed when signed tenant context is not configured", async () => {
  await withSecurityDefiner(async () => {
    const pool = new VerificationPool([{ organization_id: organizationId, role_id: "role-verifier", membership_status: "VERIFIED" }]);
    const app = Fastify();
    await registerWorkspaceRoutes(app, pool as unknown as Pool);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/evidence/${evidenceId}/verification`,
        headers: { authorization: "Bearer valid-verification-session" },
        payload: { decision: "APPROVED", scope: "pilot evidence review" },
      });
      assert.equal(response.statusCode, 503);
      assert.equal(response.json().code, "RLS_CONTEXT_CONFIG_REQUIRED");
      assert.equal(pool.connectCalls, 0);
    } finally { await app.close(); }
  });
});

test("evidence verification requires an active verified organization before opening a transaction", async () => {
  await withSecurityDefiner(async () => {
    const pool = new VerificationPool([{ organization_id: null, role_id: null, membership_status: null }]);
    const app = Fastify();
    await registerWorkspaceRoutes(app, pool as unknown as Pool, { hmacSecret: "x".repeat(48), keyId: "test-key" });
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/evidence/${evidenceId}/verification`,
        headers: { authorization: "Bearer valid-verification-session" },
        payload: { decision: "APPROVED", scope: "pilot evidence review" },
      });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().code, "RLS_ORGANIZATION_CONTEXT_REQUIRED");
      assert.equal(pool.connectCalls, 0);
    } finally { await app.close(); }
  });
});

test("evidence verification locks only evidence belonging to the signed active organization", async () => {
  await withSecurityDefiner(async () => {
    const pool = new VerificationPool([{ organization_id: organizationId, role_id: "role-verifier", membership_status: "VERIFIED" }]);
    const app = Fastify();
    await registerWorkspaceRoutes(app, pool as unknown as Pool, { hmacSecret: "x".repeat(48), keyId: "test-key" });
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/evidence/${evidenceId}/verification`,
        headers: { authorization: "Bearer valid-verification-session" },
        payload: { decision: "APPROVED", scope: "pilot evidence review" },
      });
      assert.equal(response.statusCode, 404);
      assert.equal(response.json().code, "EVIDENCE_NOT_FOUND");
      const scopedRead = pool.clientCalls.find((call) => call.sql.includes("select activity_id from evidence"));
      assert.ok(scopedRead);
      assert.match(scopedRead.sql, /a\.organization_id=\$2/);
      assert.deepEqual(scopedRead.values, [evidenceId, organizationId]);
      assert.equal(pool.clientCalls.some((call) => call.sql.includes("insert into verifications")), false);
      assert.equal(pool.clientCalls.some((call) => call.sql.includes("update evidence set status")), false);
      assert.equal(pool.clientCalls.at(-1)?.sql, "ROLLBACK");
    } finally { await app.close(); }
  });
});
