import test from "node:test";
import assert from "node:assert/strict";
import { buildAgenticPlan, isAgenticGoal } from "./agentic-workflow.js";

const base = {
  organizationId: "org-verified",
  geographyId: null,
  sourceRecordIds: ["activity-1"],
  measurementCount: 2,
  evidenceCount: 1,
  verifiedCount: 1,
};

test("agentic goals are allow-listed", () => {
  assert.equal(isAgenticGoal("prepare_compliance"), true);
  assert.equal(isAgenticGoal("issue_carbon_credits"), false);
  assert.equal(isAgenticGoal({}), false);
});

test("compliance plan blocks when evidence and independent verification are missing", () => {
  const plan = buildAgenticPlan({ ...base, goal: "prepare_compliance", evidenceCount: 0, verifiedCount: 0 });
  assert.equal(plan.mode, "READ_ONLY_ADVISORY");
  assert.equal(plan.canExecute, false);
  assert.equal(plan.humanApprovalRequired, true);
  assert.ok(plan.blockers.some(blocker => blocker.startsWith("evidence:")));
  assert.ok(plan.blockers.some(blocker => blocker.startsWith("verification:")));
  assert.equal(plan.syntheticData, false);
});

test("measurement plan requires authoritative measurements and human review", () => {
  const plan = buildAgenticPlan({ ...base, goal: "review_measurements", measurementCount: 0 });
  assert.ok(plan.steps.some(step => step.id === "measurements" && step.status === "BLOCKED"));
  assert.ok(plan.steps.some(step => step.id === "human-review" && step.status === "REQUIRES_HUMAN"));
});

test("empty source data never creates a fabricated ready plan", () => {
  const plan = buildAgenticPlan({ ...base, goal: "trace_resource_flow", sourceRecordIds: [], evidenceCount: 0 });
  assert.ok(plan.blockers.length > 0);
  assert.deepEqual(plan.sourceRecordIds, []);
});

test("stakeholder onboarding remains blocked until due-diligence evidence exists", () => {
  const plan = buildAgenticPlan({ ...base, goal: "onboard_stakeholder", evidenceCount: 0, verifiedCount: 0 });
  assert.ok(plan.steps.some(step => step.id === "due-diligence" && step.status === "BLOCKED"));
  assert.equal(plan.canExecute, false);
  assert.equal(plan.humanApprovalRequired, true);
});

test("existing legal evidence and verified status permit review but never automatic approval", () => {
  const plan = buildAgenticPlan({ ...base, goal: "onboard_stakeholder", evidenceCount: 2, verifiedCount: 1 });
  assert.ok(plan.steps.some(step => step.id === "due-diligence" && step.status === "READY"));
  assert.ok(plan.steps.some(step => step.id === "human-review" && step.status === "REQUIRES_HUMAN"));
  assert.equal(plan.canExecute, false);
});
