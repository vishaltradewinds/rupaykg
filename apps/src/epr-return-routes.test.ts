import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerEprReturnRoutes } from "./epr-return-routes.js";

const ORG = "11111111-1111-4111-8111-111111111111";
const IDENTITY = "44444444-4444-4444-8444-444444444444";
const RETURN_ID = "66666666-6666-4666-8666-666666666666";

function fakePool() {
  const calls: string[] = [];
  const query = async (sql: string, _params: unknown[] = []) => {
    calls.push(sql);
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: IDENTITY }] };
    if (sql.includes("select exists (")) return { rows: [{ ok: true }] };
    if (sql.includes("from organization_memberships")) return { rows: [{ organization_id: ORG, role_id: "role", status: "VERIFIED" }] };
    return { rows: [] };
  };
  const clientQuery = async (sql: string, _params: unknown[] = []) => {
    calls.push(sql);
    if (sql === "BEGIN" || sql === "ROLLBACK" || sql === "COMMIT") return { rows: [] };
    if (sql.includes("from epr_returns r join epr_obligations")) return { rows: [{
      id: RETURN_ID, organization_id: ORG, status: "DRAFT", obligation_id: "obligation",
      scheme_code: "PLASTIC_PACKAGING", scheme_id: "scheme",
    }] };
    if (sql.includes("from organization_epr_applicability")) return { rows: [] };
    return { rows: [] };
  };
  const pool = {
    query,
    connect: async () => ({ query: clientQuery, release: () => undefined }),
  };
  return { pool: pool as unknown as Pool, calls };
}

async function setup(pool: Pool) {
  const app = Fastify();
  await registerEprReturnRoutes(app, pool);
  return app;
}

test("EPR return submission fails closed when organization/scheme applicability is unresolved", async () => {
  const { pool, calls } = fakePool();
  const app = await setup(pool);
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/epr/returns/${RETURN_ID}/submit`,
    headers: { authorization: "Bearer test-token" },
    payload: { evidenceId: "33333333-3333-4333-8333-333333333333", verificationId: "55555555-5555-4555-8555-555555555555" },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "EPR_APPLICABILITY_UNRESOLVED");
  assert.equal(response.json().externalSubmission, "NOT_SUBMITTED");
  assert.equal(calls.some(sql => sql.includes("from epr_obligations where id=")), false);
  await app.close();
});

test("external EPR confirmation cannot be recorded without authority and verified evidence references", async () => {
  const { pool, calls } = fakePool();
  const app = await setup(pool);
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/epr/returns/${RETURN_ID}/external-reference`,
    headers: { authorization: "Bearer test-token" },
    payload: { externalReference: "CPCB-REF-123" },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "EXTERNAL_CONFIRMATION_EVIDENCE_REQUIRED");
  assert.equal(calls.some(sql => sql.includes("from epr_returns where id=")), false);
  await app.close();
});
