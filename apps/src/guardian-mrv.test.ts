import test from "node:test";
import assert from "node:assert/strict";
import { executeGuardianMrv, guardianStatus } from "./guardian-mrv.js";

const request = {
  activityId: "activity-1",
  verificationId: "verification-1",
  evidenceId: "evidence-1",
  policyId: "policy-1",
  observations: [{ parameter_code: "mass", observed_value: "10", unit: "kg" }],
  evidence: [{ id: "evidence-1", content_hash: "abc" }],
};

test("Guardian MRV remains disabled without an explicit provider URL", async () => {
  const previous = process.env.GUARDIAN_MRV_SUBMIT_URL;
  delete process.env.GUARDIAN_MRV_SUBMIT_URL;
  try {
    assert.equal(guardianStatus().configured, false);
    const result = await executeGuardianMrv(request);
    assert.equal(result.status, "NOT_CONFIGURED");
    assert.equal(result.executionId, null);
    assert.match(result.idempotencyKey, /^[a-f0-9]{64}$/);
  } finally {
    if (previous === undefined) delete process.env.GUARDIAN_MRV_SUBMIT_URL;
    else process.env.GUARDIAN_MRV_SUBMIT_URL = previous;
  }
});

test("Guardian MRV rejects a VERIFIED response without an authoritative execution id", async () => {
  const previousUrl = process.env.GUARDIAN_MRV_SUBMIT_URL;
  const previousFetch = globalThis.fetch;
  process.env.GUARDIAN_MRV_SUBMIT_URL = "https://guardian.test/mrv";
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "POST");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("x-rupaykg-contract"), "rupaykg:guardian-mrv:v1");
    assert.equal(headers.get("idempotency-key")?.length, 64);
    return new Response(JSON.stringify({ status: "VERIFIED" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const result = await executeGuardianMrv(request);
    assert.equal(result.status, "UNAVAILABLE");
    assert.equal(result.executionId, null);
    assert.match(result.message, /execution identifier/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.GUARDIAN_MRV_SUBMIT_URL;
    else process.env.GUARDIAN_MRV_SUBMIT_URL = previousUrl;
  }
});

test("Guardian MRV accepts VERIFIED only with an authoritative execution id", async () => {
  const previousUrl = process.env.GUARDIAN_MRV_SUBMIT_URL;
  const previousFetch = globalThis.fetch;
  process.env.GUARDIAN_MRV_SUBMIT_URL = "https://guardian.test/mrv";
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "VERIFIED", executionId: "guardian-execution-1" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  try {
    const result = await executeGuardianMrv(request);
    assert.equal(result.status, "VERIFIED");
    assert.equal(result.executionId, "guardian-execution-1");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.GUARDIAN_MRV_SUBMIT_URL;
    else process.env.GUARDIAN_MRV_SUBMIT_URL = previousUrl;
  }
});
