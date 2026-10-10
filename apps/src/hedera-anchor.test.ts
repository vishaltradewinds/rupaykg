import test from "node:test";
import assert from "node:assert/strict";
import { integrityHash, type AnchorPayload } from "./hedera-anchor.js";

function payload(): AnchorPayload {
  return {
    schema: "rupaykg:mrv:v1",
    activityId: "activity-1",
    verificationId: "verification-1",
    evidenceId: "evidence-1",
    guardianPolicyId: "policy-1",
    guardianExecutionId: "execution-1",
    mrvStatus: "VERIFIED",
    methodologyCode: undefined,
    quantity: undefined,
    unit: undefined,
    metadata: {
      guardianStatus: "VERIFIED",
      optionalField: undefined,
      nested: { omitted: undefined, retained: "yes" },
      list: ["kept", undefined, null],
    },
  };
}

test("integrity hash matches the exact JSON payload sent to HCS when optional fields are undefined", () => {
  const original = payload();
  const serialized = JSON.stringify(original);
  assert.ok(serialized);
  const roundTripped = JSON.parse(serialized) as AnchorPayload;
  assert.equal(integrityHash(original), integrityHash(roundTripped));
});

test("integrity hash is deterministic across object key order", () => {
  const original = payload();
  const reordered: AnchorPayload = {
    metadata: {
      list: ["kept", undefined, null],
      nested: { retained: "yes", omitted: undefined },
      optionalField: undefined,
      guardianStatus: "VERIFIED",
    },
    mrvStatus: "VERIFIED",
    guardianExecutionId: "execution-1",
    guardianPolicyId: "policy-1",
    evidenceId: "evidence-1",
    verificationId: "verification-1",
    activityId: "activity-1",
    schema: "rupaykg:mrv:v1",
    methodologyCode: undefined,
    unit: undefined,
    quantity: undefined,
  };
  assert.equal(integrityHash(original), integrityHash(reordered));
});
