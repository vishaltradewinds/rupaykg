import test from "node:test";
import assert from "node:assert/strict";
import type { FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { authenticate } from "./auth.js";

function fakePool(rows: unknown[]) {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  return {
    calls,
    pool: {
      async query(sql: string, values?: unknown[]) {
        calls.push({ sql, ...(values === undefined ? {} : { values }) });
        return { rows, rowCount: rows.length };
      },
    } as unknown as Pool,
  };
}

const request = {
  headers: { authorization: "Bearer opaque-session-token" },
  url: "/api/v1/workspaces",
} as unknown as FastifyRequest;

test("session verifier and membership lookup use separate pools", async () => {
  const session = fakePool([{ identity_id: "11111111-1111-4111-8111-111111111111" }]);
  const memberships = fakePool([{ organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role_id: "role-a", status: "VERIFIED" }]);
  const auth = await authenticate(request, session.pool, memberships.pool);
  assert.equal(auth?.identityId, "11111111-1111-4111-8111-111111111111");
  assert.equal(auth?.activeOrganizationId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.match(session.calls[0]?.sql ?? "", /verify_identity_session/);
  assert.doesNotMatch(session.calls[0]?.sql ?? "", /organization_memberships/);
  assert.match(memberships.calls[0]?.sql ?? "", /organization_memberships/);
  assert.equal(session.calls.length, 1);
  assert.equal(memberships.calls.length, 1);
});

test("invalid session never queries membership pool", async () => {
  const session = fakePool([{ identity_id: null }]);
  const memberships = fakePool([{ organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role_id: "role-a", status: "VERIFIED" }]);
  const auth = await authenticate(request, session.pool, memberships.pool);
  assert.equal(auth, null);
  assert.equal(session.calls.length, 1);
  assert.equal(memberships.calls.length, 0);
});

test("legacy single-pool mode remains compatible for non-production callers", async () => {
  const shared = fakePool([]);
  shared.pool.query = async (sql: string, values?: unknown[]) => {
    shared.calls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (/verify_identity_session/.test(sql)) return { rows: [{ identity_id: "11111111-1111-4111-8111-111111111111" }], rowCount: 1 };
    return { rows: [{ organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role_id: "role-a", status: "VERIFIED" }], rowCount: 1 };
  };
  const auth = await authenticate(request, shared.pool);
  assert.ok(auth);
  assert.equal(shared.calls.length, 2);
});
