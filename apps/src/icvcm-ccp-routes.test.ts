import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerIcvcmCcpRoutes } from "./icvcm-ccp-routes.js";
import { ICVCM_CCP_PRINCIPLES } from "@rupaykg/carbon";

const ORG = "11111111-1111-4111-8111-111111111111";
const ACTIVITY = "22222222-2222-4222-8222-222222222222";
const EVIDENCE = "33333333-3333-4333-8333-333333333333";
const IDENTITY = "44444444-4444-4444-8444-444444444444";

function fakePool(options: { permission?: boolean; evidenceVerified?: boolean } = {}) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let revision = 0;
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: IDENTITY }] };
      if (sql.includes("from organization_memberships")) return { rows: [{ organization_id: ORG, role_id: "role", status: "VERIFIED" }] };
      if (sql.includes("select exists (")) return { rows: [{ ok: options.permission ?? true }] };
      if (sql.includes("from activities")) return { rows: [{ organization_id: ORG, geography_id: "55555555-5555-4555-8555-555555555555" }] };
      if (sql.includes("organization_has_geography_scope")) return { rows: [{ ok: true }] };
      if (sql.includes("from evidence")) return { rows: options.evidenceVerified === false ? [] : [{ id: EVIDENCE }] };
      if (sql.includes("insert into icvcm_ccp_assessments")) return { rows: [{
        id: "66666666-6666-4666-8666-666666666666", organization_id: ORG, activity_id: ACTIVITY,
        assessed_by_identity_id: IDENTITY, revision_number: ++revision, assessment: [], summary: { status: "GAPS_IDENTIFIED" },
        status: "INTERNAL_DRAFT", created_at: new Date(0),
      }] };
      throw new Error("Unexpected SQL in route test: " + sql);
    },
  };
  return { pool: pool as unknown as Pool, calls };
}

async function setup(pool: Pool) {
  const app = Fastify();
  await registerIcvcmCcpRoutes(app, pool);
  return app;
}

const body = {
  organizationId: ORG,
  assessments: [{ principleId: "CCP-01", status: "EVIDENCED", evidenceReferences: [EVIDENCE] }],
};

test("ICVCM assessment API rejects unauthenticated writes", async () => {
  const { pool } = fakePool();
  const app = await setup(pool);
  const response = await app.inject({ method: "POST", url: `/api/v1/activities/${ACTIVITY}/icvcm-ccp-assessments`, payload: body });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("ICVCM assessment API requires evidence review permission", async () => {
  const { pool } = fakePool({ permission: false });
  const app = await setup(pool);
  const response = await app.inject({
    method: "POST", url: `/api/v1/activities/${ACTIVITY}/icvcm-ccp-assessments`,
    headers: { authorization: "Bearer test-token" }, payload: body,
  });
  assert.equal(response.statusCode, 403);
  assert.equal(response.json().code, "PERMISSION_FORBIDDEN");
  await app.close();
});

test("ICVCM assessment API refuses evidence not verified for the activity", async () => {
  const { pool } = fakePool({ evidenceVerified: false });
  const app = await setup(pool);
  const response = await app.inject({
    method: "POST", url: `/api/v1/activities/${ACTIVITY}/icvcm-ccp-assessments`,
    headers: { authorization: "Bearer test-token" }, payload: body,
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().code, "EVIDENCE_NOT_VERIFIED_OR_OUT_OF_SCOPE");
  await app.close();
});

test("ICVCM assessment API persists only internal draft and explicitly disclaims certification", async () => {
  const { pool, calls } = fakePool();
  const app = await setup(pool);
  const response = await app.inject({
    method: "POST", url: `/api/v1/activities/${ACTIVITY}/icvcm-ccp-assessments`,
    headers: { authorization: "Bearer test-token" }, payload: body,
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().record.status, "INTERNAL_DRAFT");
  assert.ok(response.json().limitations.some((item: string) => item.includes("not ICVCM approval")));
  assert.ok(calls.some(call => call.sql.includes("insert into icvcm_ccp_assessments")));
  assert.equal(ICVCM_CCP_PRINCIPLES.length, 10);
  await app.close();
});


test("ICVCM assessment revisions append rather than overwrite prior records", async () => {
  const { pool } = fakePool();
  const app = await setup(pool);
  const request = {
    method: "POST" as const, url: `/api/v1/activities/${ACTIVITY}/icvcm-ccp-assessments`,
    headers: { authorization: "Bearer test-token" }, payload: body,
  };
  const first = await app.inject(request);
  const second = await app.inject(request);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(first.json().record.revision_number, 1);
  assert.equal(second.json().record.revision_number, 2);
  await app.close();
});

test("ICVCM assessment API rejects non-UUID evidence references before database lookup", async () => {
  const { pool, calls } = fakePool();
  const app = await setup(pool);
  const response = await app.inject({
    method: "POST", url: `/api/v1/activities/${ACTIVITY}/icvcm-ccp-assessments`,
    headers: { authorization: "Bearer test-token" },
    payload: { ...body, assessments: [{ principleId: "CCP-01", status: "EVIDENCED", evidenceReferences: ["evidence://not-a-uuid"] }] },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "INVALID_EVIDENCE_REFERENCE");
  assert.equal(calls.some(call => call.sql.includes("from evidence")), false);
  await app.close();
});
