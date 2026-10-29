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

function makeNonDraftReturnPool(status: "REJECTED" | "SUBMITTED" | "DRAFT", throwOnObligationLookup = false, obligationStatus: string | null = null): { pool: Pool; transactions: string[] } {
  const transactions: string[] = [];
  const poolQuery = async (sql: string) => {
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
    if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1 and status = 'VERIFIED'")) {
      return { rows: [{ organization_id: organizationId, role_id: "33333333-3333-4333-8333-333333333333", status: "VERIFIED" }] };
    }
    if (sql.includes("select exists")) return { rows: [{ ok: true }] };
    throw new Error(`Unexpected pool SQL in rejected-return test: ${sql}`);
  };
  const clientQuery = async (sql: string) => {
    if (sql === "BEGIN" || sql === "ROLLBACK" || sql === "COMMIT") { transactions.push(sql); return { rows: [] }; }
    if (sql.includes("from epr_returns r join epr_obligations")) {
      return { rows: [{
        id: "66666666-6666-4666-8666-666666666666",
        organization_id: organizationId,
        obligation_id: "55555555-5555-4555-8555-555555555555",
        status,
      }] };
    }
    if (sql.includes("select id,target_quantity,fulfilled_quantity,status from epr_obligations")) {
      if (throwOnObligationLookup) throw new Error("simulated database failure during obligation lookup");
      if (obligationStatus) return { rows: [{ id: "55555555-5555-4555-8555-555555555555", target_quantity: "100", fulfilled_quantity: "0", status: obligationStatus }] };
      return { rows: [] };
    }
    throw new Error(`Unexpected client SQL in rejected-return test: ${sql}`);
  };
  return {
    pool: {
      query: poolQuery,
      connect: async () => ({ query: clientQuery, release: () => undefined }),
    } as unknown as Pool,
    transactions,
  };
}

test("rejected EPR returns fail closed until fulfillment reconciliation is implemented", async () => {
  const app = Fastify();
  const mock = makeNonDraftReturnPool("REJECTED");
  await registerEprReturnRoutes(app, mock.pool);
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
  assert.deepEqual(mock.transactions, ["BEGIN", "ROLLBACK"], "rejected return must not commit or mutate fulfillment");
});

test("submitted EPR returns cannot be submitted a second time", async () => {
  const app = Fastify();
  const mock = makeNonDraftReturnPool("SUBMITTED");
  await registerEprReturnRoutes(app, mock.pool);
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
  assert.deepEqual(mock.transactions, ["BEGIN", "ROLLBACK"], "duplicate submission must roll back without committing");
});


test("EPR submission catches database errors and rolls back the open transaction", async () => {
  const app = Fastify();
  const mock = makeNonDraftReturnPool("DRAFT", true);
  await registerEprReturnRoutes(app, mock.pool);
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
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().code, undefined);
  assert.deepEqual(mock.transactions, ["BEGIN", "ROLLBACK"], "database errors must not leave a transaction open or commit partial state");
});

test("EPR submission rolls back when obligation is no longer eligible", async () => {
  const app = Fastify();
  const mock = makeNonDraftReturnPool("DRAFT", false, "COMPLETED");
  await registerEprReturnRoutes(app, mock.pool);
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
  assert.equal(response.json().code, "OBLIGATION_NOT_ELIGIBLE");
  assert.deepEqual(mock.transactions, ["BEGIN", "ROLLBACK"], "ineligible obligation must not commit or consume a binding");
});

test("EPR submission rolls back if the locked obligation cannot be resolved", async () => {
  const app = Fastify();
  const mock = makeNonDraftReturnPool("DRAFT");
  await registerEprReturnRoutes(app, mock.pool);
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
  assert.equal(response.json().code, "OBLIGATION_NOT_FOUND");
  assert.deepEqual(mock.transactions, ["BEGIN", "ROLLBACK"], "failed obligation resolution must not commit");
});


test("EPR submission fails closed when current verifier authority is absent and requests row locks", async () => {
  const returnId = "66666666-6666-4666-8666-666666666666";
  const evidenceId = "77777777-7777-4777-8777-777777777777";
  const verificationId = "88888888-8888-4888-8888-888888888888";
  const verifierId = "99999999-9999-4999-8999-999999999999";
  const queries: Array<{ sql: string; values?: unknown[] | undefined }> = [];
  const transactions: string[] = [];
  const poolQuery = async (sql: string, values?: unknown[]) => {
    queries.push({ sql, values });
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
    if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1 and status = 'VERIFIED'")) {
      return { rows: [{ organization_id: organizationId, role_id: "33333333-3333-4333-8333-333333333333", status: "VERIFIED" }] };
    }
    if (sql.includes("select exists")) return { rows: [{ ok: true }] };
    throw new Error(`Unexpected pool SQL in verifier authority test: ${sql}`);
  };
  const clientQuery = async (sql: string, values?: unknown[]) => {
    queries.push({ sql, values });
    if (["BEGIN", "ROLLBACK", "COMMIT"].includes(sql)) { transactions.push(sql); return { rows: [] }; }
    if (sql.includes("from epr_returns r join epr_obligations")) return { rows: [{
      id: returnId, organization_id: organizationId, obligation_id: "55555555-5555-4555-8555-555555555555",
      scheme_id: "44444444-4444-4444-8444-444444444444", status: "DRAFT",
    }] };
    if (sql.includes("from epr_obligations where id=$1 for update")) return { rows: [{
      id: "55555555-5555-4555-8555-555555555555", target_quantity: "100", fulfilled_quantity: "0", status: "OPEN",
    }] };
    if (sql.includes("from evidence e join activities")) return { rows: [{
      id: evidenceId, status: "VERIFIED", content_hash: "sha256:abc", content_uri: null,
      organization_id: organizationId, geography_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }] };
    if (sql.includes("select organization_has_geography_scope")) return { rows: [{ ok: true }] };
    if (sql.includes("from epr_return_quantity_bindings b")) return { rows: [{
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", obligation_id: "55555555-5555-4555-8555-555555555555",
      evidence_id: evidenceId, verification_id: verificationId, category_code: "PLASTIC",
      obligation_category_code: "PLASTIC", period_start: "2026-04-01", period_end: "2027-03-31",
      return_period_start: "2026-04-01", return_period_end: "2027-03-31",
      measured_quantity: "10", reported_quantity: "10", current_measurement_value: "10",
      current_measurement_unit: "kg", unit_code: "kg", quality_status: "VERIFIED",
      current_evidence_status: "VERIFIED", content_hash: "sha256:abc", content_uri: null,
      current_verification_decision: "APPROVED", current_verification_evidence: evidenceId,
      verifier_identity_id: verifierId, evidence_geography_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      consumed_at: null, effective_from: "2026-01-01",
      rules: { eprBinding: { schemeCode: "SCHEME", categoryCode: "PLASTIC", unitCode: "kg" } },
      return_scheme_code: "SCHEME", scheme_id: "44444444-4444-4444-8444-444444444444",
      methodology_version_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      measurement_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      custody_link_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    }] };
    if (sql.includes("from organization_memberships om") && sql.includes("for share of om, r, i")) return { rows: [] };
    throw new Error(`Unexpected client SQL in verifier authority test: ${sql}`);
  };
  const pool = {
    query: poolQuery,
    connect: async () => ({ query: clientQuery, release: () => undefined }),
  } as unknown as Pool;
  const app = Fastify();
  await registerEprReturnRoutes(app, pool);
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/epr/returns/${returnId}/submit`,
    headers: { authorization: "Bearer test-session" },
    payload: { evidenceId, verificationId },
  });
  await app.close();

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "EPR_VERIFIER_AUTHORITY_INVALID");
  assert.deepEqual(transactions, ["BEGIN", "ROLLBACK"], "missing current authority must roll back before consuming binding or fulfilling obligation");
  const authority = queries.find((query) => query.sql.includes("for share of om, r, i"));
  assert.ok(authority, "verifier authorization query must lock membership, role, and identity rows");
  assert.match(authority!.sql, /om\.organization_id=\$4/);
  assert.match(authority!.sql, /i\.status='VERIFIED'/);
  assert.match(authority!.sql, /i\.suspended_at is null/);
  assert.deepEqual(authority!.values?.[3], organizationId, "authority must be scoped to the return organization");
  assert.equal(queries.some((query) => query.sql.includes("update epr_obligations set fulfilled_quantity")), false);
  assert.equal(queries.some((query) => query.sql.includes("update epr_return_quantity_bindings set consumed_at")), false);
});
