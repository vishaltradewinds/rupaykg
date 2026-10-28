import test from "node:test";
import assert from "node:assert/strict";
import { authorizeAgenticTools, getAgenticToolsForGoal, listAgenticToolDefinitions } from "./agentic-tools.js";
import type { Pool } from "pg";

test("registry exposes only explicit read-only, tenant and geography-scoped tools", () => {
  const tools = listAgenticToolDefinitions();
  assert.equal(tools.length, 6);
  assert.ok(tools.every(tool => tool.mode === "READ_ONLY"));
  assert.ok(tools.every(tool => tool.organizationScoped && tool.geographyScoped));
  assert.ok(tools.every(tool => tool.requiredAnyPermission.length > 0));
  assert.ok(tools.every(tool => !tool.requiredAnyPermission.includes("projects:manage")), "broad management permission must not substitute for read access");
  assert.ok(tools.every(tool => !tool.requiredAnyPermission.includes("VERIFY_EVIDENCE")), "high-risk verification authority must not substitute for read access");
  assert.ok(tools.every(tool => !tool.requiredAnyPermission.includes("evidence:review")), "review authority must not substitute for read access");
  assert.ok(!tools.some(tool => /write|submit|issue|settle|approve|delete/i.test(tool.id)));
});

test("each workflow receives only its explicit allow-listed tool set", () => {
  assert.deepEqual(getAgenticToolsForGoal("review_measurements").map(t => t.id), ["activities.list", "measurements.count"]);
  assert.deepEqual(getAgenticToolsForGoal("prepare_compliance").map(t => t.id), ["activities.list", "evidence.count", "verifications.count"]);
  assert.deepEqual(getAgenticToolsForGoal("trace_resource_flow").map(t => t.id), ["activities.list", "evidence.count"]);
  assert.deepEqual(getAgenticToolsForGoal("onboard_stakeholder").map(t => t.id), ["stakeholder_applications.list", "organization_verification.count"]);
});

test("tool definitions cannot mutate the registry through returned permission arrays", () => {
  const exposed = listAgenticToolDefinitions();
  (exposed[0]!.requiredAnyPermission as string[]).push("admin:system");
  assert.ok(!listAgenticToolDefinitions()[0]!.requiredAnyPermission.includes("admin:system"));
});

test("tool authorization fails closed before downstream handlers when a permission is denied", async () => {
  const calls: unknown[][] = [];
  const pool = { query: async (_sql: string, values?: unknown[]) => { calls.push(values ?? []); return { rows: [{ ok: false }] }; } } as unknown as Pool;
  const auth = { identityId: "identity-1", memberships: [] };
  const result = await authorizeAgenticTools(pool, auth, "org-1", "prepare_compliance");
  assert.deepEqual(result, { allowed: false, deniedToolId: "activities.list" });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["identity-1", "org-1", ["waste:read", "projects:read", "audit:read"]]);
});

test("tool authorization requires every allow-listed tool permission", async () => {
  let calls = 0;
  const pool = { query: async () => { calls += 1; return { rows: [{ ok: true }] }; } } as unknown as Pool;
  const auth = { identityId: "identity-2", memberships: [] };
  const result = await authorizeAgenticTools(pool, auth, "org-2", "prepare_compliance");
  assert.deepEqual(result, { allowed: true, toolIds: ["activities.list", "evidence.count", "verifications.count"] });
  assert.equal(calls, 3);
});
