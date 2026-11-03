import test from "node:test";
import assert from "node:assert/strict";
import { hederaStatus, integrityHash, submitHcsAnchor } from "./hedera-anchor.js";
import { guardianStatus } from "./guardian-mrv.js";
import { buildMrvInputBinding } from "./mrv-routes.js";

test("MRV integrations fail closed when external providers are not configured", async () => {
  const previous = { topic: process.env.HEDERA_TOPIC_ID, operatorId: process.env.HEDERA_OPERATOR_ID, operatorKey: process.env.HEDERA_OPERATOR_KEY, guardian: process.env.GUARDIAN_MRV_SUBMIT_URL };
  delete process.env.HEDERA_TOPIC_ID;
  delete process.env.HEDERA_OPERATOR_ID;
  delete process.env.HEDERA_OPERATOR_KEY;
  delete process.env.GUARDIAN_MRV_SUBMIT_URL;
  try {
    assert.equal(hederaStatus().writeStatus, "NOT_AVAILABLE");
    assert.equal(guardianStatus().configured, false);
    const result = await submitHcsAnchor({ schema: "rupaykg:mrv:v1", activityId: "a", verificationId: "v", evidenceId: "e", guardianPolicyId: "p", guardianExecutionId: "g", mrvStatus: "VERIFIED" });
    assert.equal(result.status, "NOT_CONFIGURED");
    assert.equal(result.transactionId, null);
    assert.equal(result.consensusTimestamp, null);
  } finally {
    for (const [key, value] of Object.entries({ HEDERA_TOPIC_ID: previous.topic, HEDERA_OPERATOR_ID: previous.operatorId, HEDERA_OPERATOR_KEY: previous.operatorKey, GUARDIAN_MRV_SUBMIT_URL: previous.guardian })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("MRV integrity hash is deterministic and key-order independent", () => {
  const a = { schema: "rupaykg:mrv:v1" as const, activityId: "a", verificationId: "v", evidenceId: "e", guardianPolicyId: "p", guardianExecutionId: "g", mrvStatus: "VERIFIED" as const, metadata: { z: 1, a: 2 } };
  const b = { ...a, metadata: { a: 2, z: 1 } };
  assert.equal(integrityHash(a), integrityHash(b));
});


test("MRV source binding changes the Guardian idempotency key when observation or evidence changes", () => {
  const base = {
    activityId: "activity-1", verificationId: "verification-1", evidenceId: "evidence-1",
    policyId: "policy-1", methodologyCode: "BM WA03.001", quantity: 125, unit: "kg",
    observations: [{ id: "obs-1", parameter_code: "mass", observed_value: "10", unit: "kg" }],
    evidence: [{ id: "evidence-1", content_hash: "sha256:aaa", status: "VERIFIED" }],
  };
  const initial = buildMrvInputBinding(base);
  const changedObservation = buildMrvInputBinding({ ...base, observations: [{ ...base.observations[0], observed_value: "11" }] });
  const changedEvidence = buildMrvInputBinding({ ...base, evidence: [{ ...base.evidence[0], content_hash: "sha256:bbb" }] });
  assert.notEqual(initial.observationDigest, changedObservation.observationDigest);
  assert.notEqual(initial.evidenceDigest, changedEvidence.evidenceDigest);
  assert.notEqual(initial.idempotencyKey, changedObservation.idempotencyKey);
  assert.notEqual(initial.idempotencyKey, changedEvidence.idempotencyKey);
});
