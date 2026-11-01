import assert from "node:assert/strict";
import Fastify from "fastify";
import test from "node:test";
import type { Pool } from "pg";
import { registerValueRoutes } from "./value-routes.js";

const identityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationId = "11111111-1111-4111-8111-111111111111";

class WorkspacePool {
  calls: string[] = [];
  constructor(private readonly reportsRead: boolean) {}
  async query(sql: string) {
    this.calls.push(sql);
    if (sql.includes("from identity_sessions")) return { rows: [{ identity_id: identityId }] };
    if (sql.includes("from organization_memberships") && sql.includes("where identity_id = $1")) {
      return { rows: [{ organization_id: organizationId, role_id: "role-a", status: "VERIFIED" }] };
    }
    if (sql.includes("jsonb_array_elements_text")) return { rows: [{ ok: this.reportsRead }] };
    if (sql.includes("can_write_esg")) return { rows: [{ ok: true }] };
    return { rows: [] };
  }
}

async function makeApp(pool: WorkspacePool) {
  const app = Fastify();
  await registerValueRoutes(app, pool as unknown as Pool);
  await app.ready();
  return app;
}

test("BWG workspace denies authenticated identities without reports:read", async () => {
  const pool = new WorkspacePool(false);
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/bwg",
      headers: { authorization: "Bearer acceptance-test-token" },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().code, "BWG_WORKSPACE_READ_FORBIDDEN");
    assert.equal(pool.calls.some((sql) => sql.includes("from bwg_profiles")), false);
  } finally {
    await app.close();
  }
});

test("BWG workspace permits a verified organization member with reports:read", async () => {
  const pool = new WorkspacePool(true);
  const app = await makeApp(pool);
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/bwg",
      headers: { authorization: "Bearer acceptance-test-token" },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().source, "postgresql");
    assert.equal(response.json().syntheticData, false);
    assert.ok(pool.calls.some((sql) => sql.includes("from bwg_profiles")));
  } finally {
    await app.close();
  }
});
