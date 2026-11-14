import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerWorkspaceRoutes } from "./workspace-routes.js";

const identityId = "123e4567-e89b-42d3-a456-426614174000";
const organizationId = "223e4567-e89b-42d3-a456-426614174000";
const roleId = "323e4567-e89b-42d3-a456-426614174000";
const evidenceId = "423e4567-e89b-42d3-a456-426614174000";
const activityId = "523e4567-e89b-42d3-a456-426614174000";

test("evidence verification establishes runtime role and tenant context before RLS-protected reads", async () => {
  const statements: string[] = [];
  const pool = {
    connect: async () => ({
      query: async (sql: string) => {
        statements.push(sql);
        const normalized = sql.trim().toLowerCase();
        if (["begin", "commit", "rollback", "set local role rupaykg_app_runtime"].includes(normalized)) return { rows: [] };
        if (sql.includes("app.authenticate_bearer_session")) return { rows: [{
          identity_id: identityId,
          organization_id: organizationId,
          role_id: roleId,
          status: "VERIFIED",
          context_token: "test-context-token",
        }] };
        if (sql.includes("app.set_request_context")) return { rows: [] };
        if (sql.includes("select activity_id from evidence")) return { rows: [{ activity_id: activityId }] };
        if (sql.includes("from evidence e join activities a")) return { rows: [{ ok: true }] };
        if (sql.includes("insert into verifications")) return { rows: [{
          id: "623e4567-e89b-42d3-a456-426614174000",
          evidence_id: evidenceId,
          activity_id: activityId,
          verifier_identity_id: identityId,
          decision: "APPROVED",
          scope: "sample verification",
          decided_at: new Date("2026-11-14T00:00:00Z"),
        }] };
        if (sql.includes("update evidence set status='VERIFIED'")) return { rows: [], rowCount: 1 };
        throw new Error("Unexpected SQL in evidence tenant-context test: " + sql);
      },
      release: () => undefined,
    }),
  } as unknown as Pool;

  const app = Fastify({ logger: false });
  await registerWorkspaceRoutes(app, pool);
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/evidence/${evidenceId}/verification`,
    headers: { authorization: "Bearer test-session", "x-rupaykg-organization-id": organizationId },
    payload: { decision: "APPROVED", scope: "sample verification" },
  });

  assert.equal(response.statusCode, 201, response.body);
  const contextIndex = statements.findIndex(sql => sql.includes("app.set_request_context"));
  const evidenceReadIndex = statements.findIndex(sql => sql.includes("select activity_id from evidence"));
  const permissionReadIndex = statements.findIndex(sql => sql.includes("from evidence e join activities a"));
  assert.ok(contextIndex >= 0, "request context must be established");
  assert.ok(evidenceReadIndex > contextIndex, "evidence must not be read before tenant context");
  assert.ok(permissionReadIndex > contextIndex, "verification authority must not be checked before tenant context");
  assert.ok(statements.some(sql => sql.trim().toLowerCase() === "set local role rupaykg_app_runtime"));
  await app.close();
});
