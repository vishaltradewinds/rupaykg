import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import Fastify from "fastify";
import type { Pool, PoolClient } from "pg";
import { registerEprReturnRoutes } from "./epr-return-routes.js";

const identityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherOrganizationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const schemeId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const obligationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const returnId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const sessionToken = "valid-epr-session-token";
const sessionTokenHash = createHash("sha256").update(sessionToken).digest("hex");

type Call = { sql: string; values?: unknown[] };

class FakeClient {
  calls: Call[] = [];
  released = false;
  permission = true;
  eligible = true;

  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: 0 };
    if (sql.includes("FOR SHARE OF s, i, om, r")) {
      return { rows: this.permission ? [{ ok: true }] : [], rowCount: this.permission ? 1 : 0 };
    }
    if (sql.includes("FOR SHARE OF s, eo, o")) {
      return { rows: this.eligible ? [{ id: schemeId }] : [], rowCount: this.eligible ? 1 : 0 };
    }
    if (sql.toLowerCase().includes("insert into epr_returns")) {
      return { rows: [{ id: returnId, organization_id: organizationId, status: "DRAFT" }], rowCount: 1 };
    }
    if (sql.includes("from epr_returns r join epr_schemes")) {
      return { rows: [{ id: returnId, organization_id: organizationId }], rowCount: 1 };
    }
    throw new Error("Unexpected client SQL in EPR route test: " + sql);
  }

  release(): void { this.released = true; }
}

class FakePool {
  calls: Call[] = [];
  client = new FakeClient();
  memberships = [{ organization_id: organizationId, role_id: "role-a", status: "VERIFIED" }];

  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, ...(values === undefined ? {} : { values }) });
    if (sql.includes("from identity_sessions s")) return { rows: [{ identity_id: identityId }], rowCount: 1 };
    if (sql.includes("from organization_memberships")) return { rows: this.memberships, rowCount: this.memberships.length };
    throw new Error("Unexpected pool SQL in EPR route test: " + sql);
  }

  async connect(): Promise<PoolClient> { return this.client as unknown as PoolClient; }
}

function asPool(pool: FakePool): Pool { return pool as unknown as Pool; }

async function makeApp(pool: FakePool) {
  const app = Fastify();
  await registerEprReturnRoutes(app, asPool(pool));
  return app;
}

const authHeaders = {
  authorization: `Bearer ${sessionToken}`,
  "x-rupaykg-organization-id": organizationId,
};

const createPayload = {
  schemeId,
  obligationId,
  periodStart: "2099-01-01",
  periodEnd: "2099-12-31",
  returnType: "ANNUAL",
  reportedQuantity: 10,
};

function callKinds(calls: Call[]): string[] {
  return calls.map(({ sql }) => {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return sql;
    if (sql.includes("FOR SHARE OF s, i, om, r")) return "AUTHORIZATION_LOCK";
    if (sql.includes("FOR SHARE OF s, eo, o")) return "ELIGIBILITY_LOCK";
    if (sql.toLowerCase().includes("insert into epr_returns")) return "INSERT_RETURN";
    if (sql.includes("from epr_returns r join epr_schemes")) return "LIST_RETURNS";
    return "UNEXPECTED";
  });
}

test("EPR return creation revalidates and locks session, identity, membership and permission in the insert transaction", async () => {
  const pool = new FakePool();
  const app = await makeApp(pool);
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/epr/returns", headers: authHeaders, payload: createPayload });
    assert.equal(response.statusCode, 201);
    assert.deepEqual(callKinds(pool.client.calls), ["BEGIN", "AUTHORIZATION_LOCK", "ELIGIBILITY_LOCK", "INSERT_RETURN", "COMMIT"]);
    assert.equal(pool.client.calls[1]?.values?.[0], sessionTokenHash);
    assert.equal(pool.client.calls[1]?.values?.[1], identityId);
    assert.equal(pool.client.calls[1]?.values?.[2], organizationId);
    assert.deepEqual(pool.client.calls[1]?.values?.[3], ["epr:manage"]);
    assert.match(pool.client.calls[1]?.sql ?? "", /for share of s, i, om, r/i);
    assert.match(pool.client.calls[2]?.sql ?? "", /for share of s, eo, o/i);
    assert.equal(pool.calls.length, 2, "pool queries are limited to initial session and membership resolution");
    assert.equal(pool.client.released, true);
  } finally {
    await app.close();
  }
});

test("EPR return creation fails closed when session or current authorization has been revoked", async () => {
  const pool = new FakePool();
  pool.client.permission = false;
  const app = await makeApp(pool);
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/epr/returns", headers: authHeaders, payload: createPayload });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "EPR_RETURN_WRITE_FORBIDDEN");
    assert.deepEqual(callKinds(pool.client.calls), ["BEGIN", "AUTHORIZATION_LOCK", "ROLLBACK"]);
    assert.equal(pool.client.released, true);
  } finally {
    await app.close();
  }
});

test("EPR return creation locks the eligibility rows and does not insert an ineligible obligation", async () => {
  const pool = new FakePool();
  pool.client.eligible = false;
  const app = await makeApp(pool);
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/epr/returns", headers: authHeaders, payload: createPayload });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().code, "EPR_RETURN_NOT_ELIGIBLE");
    assert.deepEqual(callKinds(pool.client.calls), ["BEGIN", "AUTHORIZATION_LOCK", "ELIGIBILITY_LOCK", "ROLLBACK"]);
    assert.equal(pool.client.released, true);
  } finally {
    await app.close();
  }
});

test("EPR return list authorizes and reads the selected tenant on the same locked transaction", async () => {
  const pool = new FakePool();
  const app = await makeApp(pool);
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/epr/returns", headers: authHeaders });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().returns[0].organization_id, organizationId);
    assert.deepEqual(callKinds(pool.client.calls), ["BEGIN", "AUTHORIZATION_LOCK", "LIST_RETURNS", "COMMIT"]);
    assert.deepEqual(pool.client.calls[1]?.values?.[3], ["epr:read", "epr:manage", "reports:read"]);
    assert.equal(pool.client.released, true);
  } finally {
    await app.close();
  }
});

test("EPR routes require explicit active-organization selection for multi-organization identities", async () => {
  const pool = new FakePool();
  pool.memberships = [
    { organization_id: organizationId, role_id: "role-a", status: "VERIFIED" },
    { organization_id: otherOrganizationId, role_id: "role-b", status: "VERIFIED" },
  ];
  const app = await makeApp(pool);
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/epr/returns", headers: { authorization: authHeaders.authorization }, payload: createPayload });
    assert.equal(response.statusCode, 401);
    assert.equal(pool.client.calls.length, 0);
    assert.equal(pool.client.released, false);
  } finally {
    await app.close();
  }
});
