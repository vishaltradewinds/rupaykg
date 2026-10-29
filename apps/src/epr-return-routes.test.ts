import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerEprReturnRoutes } from "./epr-return-routes.js";

const identityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";

function makePool(): Pool {
  const query = async (sql: string) => {
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
    if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1 and status = 'VERIFIED'")) {
      return { rows: [{ organization_id: organizationId, role_id: "33333333-3333-4333-8333-333333333333", status: "VERIFIED" }] };
    }
    if (sql.includes("select exists")) return { rows: [{ ok: true }] };
    if (sql.includes("insert into epr_returns")) throw new Error("invalid dates must be rejected before database mutation");
    throw new Error(`Unexpected SQL in EPR route date test: ${sql}`);
  };
  return { query } as unknown as Pool;
}

async function createReturn(periodStart: string, periodEnd: string) {
  const app = Fastify();
  await registerEprReturnRoutes(app, makePool());
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/epr/returns",
    headers: { authorization: "Bearer test-session" },
    payload: {
      organizationId,
      schemeId: "44444444-4444-4444-8444-444444444444",
      obligationId: "55555555-5555-4555-8555-555555555555",
      periodStart,
      periodEnd,
      returnType: "ANNUAL",
      reportedQuantity: 10,
    },
  });
  await app.close();
  return response;
}

test("EPR return creation rejects impossible, malformed, timestamp, and inverted dates before SQL mutation", async () => {
  const invalid = [
    ["2026-02-30", "2027-03-31"],
    ["2026/04/01", "2027-03-31"],
    ["2026-04-01T00:00:00Z", "2027-03-31"],
    ["2027-04-01", "2027-03-31"],
  ] as const;
  for (const [periodStart, periodEnd] of invalid) {
    const response = await createReturn(periodStart, periodEnd);
    assert.equal(response.statusCode, 400, `${periodStart} / ${periodEnd}`);
    assert.equal(response.json().code, "INVALID_PERIOD");
  }
});

test("EPR return creation accepts a real ISO calendar period at the date-validation boundary", async () => {
  const response = await createReturn("2026-04-01", "2027-03-31");
  // This fake pool intentionally has no INSERT implementation: a valid date
  // passes the date guard and reaches the database boundary, which returns 503.
  assert.equal(response.statusCode, 503);
  assert.notEqual(response.json().code, "INVALID_PERIOD");
});

function makeNonDraftReturnPool(status: "REJECTED" | "SUBMITTED"): Pool {
  const poolQuery = async (sql: string) => {
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
    if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1 and status = 'VERIFIED'")) {
      return { rows: [{ organization_id: organizationId, role_id: "33333333-3333-4333-8333-333333333333", status: "VERIFIED" }] };
    }
    if (sql.includes("select exists")) return { rows: [{ ok: true }] };
    throw new Error(`Unexpected pool SQL in rejected-return test: ${sql}`);
  };
  const clientQuery = async (sql: string) => {
    if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
    if (sql.includes("from epr_returns r join epr_obligations")) {
      return { rows: [{
        id: "66666666-6666-4666-8666-666666666666",
        organization_id: organizationId,
        obligation_id: "55555555-5555-4555-8555-555555555555",
        status,
      }] };
    }
    throw new Error(`Unexpected client SQL in rejected-return test: ${sql}`);
  };
  return {
    query: poolQuery,
    connect: async () => ({ query: clientQuery, release: () => undefined }),
  } as unknown as Pool;
}

test("rejected EPR returns fail closed until fulfillment reconciliation is implemented", async () => {
  const app = Fastify();
  await registerEprReturnRoutes(app, makeNonDraftReturnPool("REJECTED"));
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/epr/returns/66666666-6666-4666-8666-666666666666/submit",
    headers: { authorization: "Bearer test-session" },
    payload: {
      evidenceId: "77777777-7777-4777-8777-777777777777",
      verificationId: "88888888-8888-4888-8888-888888888888",
    },
  });
  await app.close();
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "EPR_REJECTED_RETURN_RECONCILIATION_REQUIRED");
});

test("submitted EPR returns cannot be submitted a second time", async () => {
  const app = Fastify();
  await registerEprReturnRoutes(app, makeNonDraftReturnPool("SUBMITTED"));
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/epr/returns/66666666-6666-4666-8666-666666666666/submit",
    headers: { authorization: "Bearer test-session" },
    payload: {
      evidenceId: "77777777-7777-4777-8777-777777777777",
      verificationId: "88888888-8888-4888-8888-888888888888",
    },
  });
  await app.close();
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "INVALID_EPR_RETURN_STATE");
});
