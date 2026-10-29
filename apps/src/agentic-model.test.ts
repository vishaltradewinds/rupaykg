import test from "node:test";
import assert from "node:assert/strict";
import { explainAgenticPlan, readAgenticModelConfig } from "./agentic-model.js";

const plan = { goal: "prepare_compliance", organizationId: "org-1", geographyId: null, sourceRecordIds: ["activity-1"], steps: [{ id: "evidence", title: "Check evidence", status: "BLOCKED", reason: "No evidence recorded", requiredEvidence: ["traceable evidence"] }], blockers: ["evidence: No evidence recorded"] };

test("model adapter is disabled unless explicitly enabled and configured", () => {
  assert.equal(readAgenticModelConfig({}), null);
});
test("remote endpoints require HTTPS and embedded credentials are rejected", () => {
  assert.equal(readAgenticModelConfig({ RUPAYKG_AGENTIC_MODEL_ENABLED: "true", RUPAYKG_AGENTIC_MODEL_BASE_URL: "http://example.com", RUPAYKG_AGENTIC_MODEL_NAME: "model" }), null);
  assert.equal(readAgenticModelConfig({ RUPAYKG_AGENTIC_MODEL_ENABLED: "true", RUPAYKG_AGENTIC_MODEL_BASE_URL: "https://user:pass@example.com", RUPAYKG_AGENTIC_MODEL_NAME: "model" }), null);
});
test("local HTTP inference endpoint requires explicit development mode", () => {
  const env = { RUPAYKG_AGENTIC_MODEL_ENABLED: "true", RUPAYKG_AGENTIC_MODEL_BASE_URL: "http://127.0.0.1:11434", RUPAYKG_AGENTIC_MODEL_NAME: "qwen" };
  assert.equal(readAgenticModelConfig(env), null);
  assert.equal(readAgenticModelConfig({ ...env, NODE_ENV: "production" }), null);
  assert.equal(readAgenticModelConfig({ ...env, NODE_ENV: "development" })?.model, "qwen");
});
test("disabled adapter never calls provider", async () => {
  let called = false;
  const result = await explainAgenticPlan(plan, null, async () => { called = true; throw new Error("should not call"); });
  assert.deepEqual(result, { status: "DISABLED", explanation: null });
  assert.equal(called, false);
});
test("model explanation returns bounded plain-text advice only", async () => {
  const config = { enabled: true, baseUrl: "https://model.example", model: "test-model", timeoutMs: 1000 };
  const result = await explainAgenticPlan(plan, config, async (_input, init) => {
    assert.equal(init?.method, "POST");
    const sent = JSON.parse(String(init?.body));
    assert.equal(sent.messages[0].role, "system");
    return new Response(JSON.stringify({ choices: [{ message: { content: "Evidence is missing. Human review is required." } }] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  assert.equal(result.status, "COMPLETED");
  assert.match(result.explanation ?? "", /Human review/);
});
test("model receives only a bounded plan summary, not tenant IDs or source record IDs", async () => {
  const config = { enabled: true, baseUrl: "https://model.example", model: "test-model", timeoutMs: 1000 };
  await explainAgenticPlan({
    ...plan,
    organizationId: "sensitive-organization-id",
    geographyId: "sensitive-geography-id",
    sourceRecordIds: ["sensitive-source-record-id"],
    blockers: Array.from({ length: 40 }, (_, i) => "blocker-" + i),
  }, config, async (_input, init) => {
    const sent = JSON.parse(String(init?.body));
    const userContent = sent.messages[1].content as string;
    assert.equal(userContent.includes("sensitive-organization-id"), false);
    assert.equal(userContent.includes("sensitive-geography-id"), false);
    assert.equal(userContent.includes("sensitive-source-record-id"), false);
    const summary = JSON.parse(userContent);
    assert.equal(summary.sourceRecordCount, 1);
    assert.equal(summary.blockers.length, 30);
    return new Response(JSON.stringify({ choices: [{ message: { content: "Summary only." } }] }), { status: 200 });
  });
});

test("model output is capped and malformed provider responses fail closed", async () => {
  const config = { enabled: true, baseUrl: "https://model.example", model: "test-model", timeoutMs: 1000 };
  const bounded = await explainAgenticPlan(plan, config, async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "x".repeat(2500) } }] }), { status: 200 }));
  assert.equal(bounded.status, "COMPLETED");
  assert.equal(bounded.explanation?.length, 2000);

  const malformed = await explainAgenticPlan(plan, config, async () =>
    new Response(JSON.stringify({ choices: [] }), { status: 200 }));
  assert.deepEqual(malformed, { status: "UNAVAILABLE", explanation: null });
});


test("oversized model responses fail closed before parsing", async () => {
  const config = { enabled: true, baseUrl: "https://model.example", model: "test-model", timeoutMs: 1000 };
  const result = await explainAgenticPlan(plan, config, async () =>
    new Response("x".repeat(256 * 1024 + 1), { status: 200, headers: { "content-type": "application/json" } }));
  assert.deepEqual(result, { status: "UNAVAILABLE", explanation: null });
});
