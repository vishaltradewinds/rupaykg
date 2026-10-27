import test from "node:test";
import assert from "node:assert/strict";
import { getAgenticToolsForGoal, listAgenticToolDefinitions } from "./agentic-tools.js";

test("registry exposes only explicit read-only, tenant and geography-scoped tools", () => {
  const tools = listAgenticToolDefinitions();
  assert.equal(tools.length, 6);
  assert.ok(tools.every(tool => tool.mode === "READ_ONLY"));
  assert.ok(tools.every(tool => tool.organizationScoped && tool.geographyScoped));
  assert.ok(tools.every(tool => tool.requiredAnyPermission.length > 0));
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
  (exposed[0].requiredAnyPermission as string[]).push("admin:system");
  assert.ok(!listAgenticToolDefinitions()[0].requiredAnyPermission.includes("admin:system"));
});
