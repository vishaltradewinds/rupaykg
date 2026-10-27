import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerAgenticWorkflowRoutes } from "./agentic-workflow.js";

const organizationId = "00000000-0000-4000-8000-000000000011";
const identityId = "00000000-0000-4000-8000-000000000012";
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");

function fakePool(options: { geographyAllowed?: boolean; failActivityRead?: boolean } = {}) {
  const calls: string[] = [];
  const pool = {
    query: async (sql: string) => {
      calls.push(sql);
      if (sql.includes("from identity_sessions s")) return { rows: [{ identity_id: identityId }] };
      if (sql.includes("from organization_memberships") && sql.includes("select organization_id, role_id, status")) {
        return { rows: [{ organization_id: organizationId, role_id: "role-1", status: "VERIFIED" }] };
      }
      if (sql.includes("jsonb_array_elements_text(r.permissions)")) return { rows: [{ ok: true }] };
      if (sql.includes("organization_has_geography_scope(om.organization_id,$3::uuid)")) {
        return { rows: [{ ok: options.geographyAllowed ?? false }] };
      }
      if (sql.includes("from activities a")) {
        if (options.failActivityRead) throw new Error("authoritative database read failed");
        return { rows: [{ id: "activity-1", measurement_count: "1", evidence_count: "1", verified_count: "0" }] };
      }
      throw new Error("Unexpected SQL in test: " + sql);
    },
  } as unknown as Pool;
  return { pool, calls };
}

test("agentic plan requires an authenticated session", async () => {
  const { pool } = fakePool();
  const app = Fastify({ logger: false });
  await registerAgenticWorkflowRoutes(app, pool);
  try {
    const response = await app.inject({ method: "POST", url: "/api/v1/agentic/plan", payload: { goal: "trace_resource_flow" } });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().code, "AUTH_REQUIRED");
  } finally {
    await app.close();
  }
});

test("invalid geography is rejected before any authoritative activity read", async () => {
  const { pool, calls } = fakePool();
  const app = Fastify({ logger: false });
  await registerAgenticWorkflowRoutes(app, pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/agentic/plan",
      headers: { authorization: "Bearer " + token, "x-rupaykg-organization-id": organizationId },
      payload: { goal: "trace_resource_flow", geographyId: "not-a-uuid" },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, "GEOGRAPHY_ID_INVALID");
    assert.ok(!calls.some(sql => sql.includes("from activities a")), "invalid geography must not reach domain data handlers");
  } finally {
    await app.close();
  }
});

test("geography outside authorized scope is rejected before domain data reads", async () => {
  const { pool, calls } = fakePool({ geographyAllowed: false });
  const app = Fastify({ logger: false });
  await registerAgenticWorkflowRoutes(app, pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/agentic/plan",
      headers: { authorization: "Bearer " + token, "x-rupaykg-organization-id": organizationId },
      payload: { goal: "trace_resource_flow", geographyId: "00000000-0000-4000-8000-000000000099" },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "GEOGRAPHY_FORBIDDEN");
    assert.ok(!calls.some(sql => sql.includes("from activities a")), "out-of-scope geography must not reach domain data handlers");
  } finally {
    await app.close();
  }
});

test("domain database failure returns unavailable and never fabricates source records", async () => {
  const { pool } = fakePool({ failActivityRead: true });
  const app = Fastify({ logger: false });
  await registerAgenticWorkflowRoutes(app, pool);
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/agentic/plan",
      headers: { authorization: "Bearer " + token, "x-rupaykg-organization-id": organizationId },
      payload: { goal: "trace_resource_flow" },
    });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, "AGENTIC_DATA_UNAVAILABLE");
    assert.equal(response.json().syntheticData, false);
  } finally {
    await app.close();
  }
});
