import assert from "node:assert/strict";
import test from "node:test";
import { runMrvSubmissionWorkerOnce, type MrvRestrictedWorkerDependencies } from "./mrv-submission-worker-restricted.js";
import type { MrvJobLease, MrvSubmissionJob } from "./mrv-submission-jobs.js";
import type { MrvWorkerDatabaseApi } from "./mrv-worker-database-api.js";

const JOB_ID = "00000000-0000-4000-8000-000000000010";
const TOKEN = "00000000-0000-4000-8000-000000000001";

test("restricted worker fails closed before claiming when disabled", async () => {
  const previous = process.env.RUPAYKG_MRV_WORKER_ENABLED;
  delete process.env.RUPAYKG_MRV_WORKER_ENABLED;
  let claims = 0;
  const database = { claim: async () => { claims += 1; return null; } } as unknown as MrvWorkerDatabaseApi;
  try {
    await assert.rejects(() => runMrvSubmissionWorkerOnce(database, "worker-a"), /MRV_WORKER_DISABLED/);
    assert.equal(claims, 0);
  } finally {
    if (previous === undefined) delete process.env.RUPAYKG_MRV_WORKER_ENABLED;
    else process.env.RUPAYKG_MRV_WORKER_ENABLED = previous;
  }
});


function job(status: MrvSubmissionJob["status"], overrides: Partial<MrvSubmissionJob> = {}): MrvSubmissionJob {
  return {
    id: JOB_ID, idempotency_key: "a".repeat(64), payload_hash: "b".repeat(64),
    activity_id: "00000000-0000-4000-8000-000000000011",
    verification_id: "00000000-0000-4000-8000-000000000012",
    evidence_id: "00000000-0000-4000-8000-000000000013",
    organization_id: "00000000-0000-4000-8000-000000000014",
    geography_id: "00000000-0000-4000-8000-000000000015",
    requested_by_identity_id: "00000000-0000-4000-8000-000000000016",
    guardian_policy_id: "policy-v1", methodology_code: null, payload_snapshot: { observations: [], evidence: [] },
    status, attempt_count: 1, lease_owner: "worker-a", lease_token: TOKEN,
    lease_expires_at: new Date("2026-11-03T16:00:00.000Z"),
    next_attempt_at: new Date("2026-11-03T15:00:00.000Z"),
    guardian_idempotency_key: "stable-guardian-key", guardian_execution_id: "guardian-exec-1",
    guardian_status: "VERIFIED", guardian_result: null,
    hedera_network: "testnet", hedera_topic_id: "0.0.1234", hedera_transaction_id: "0.0.1234@1730646000.000000001",
    hedera_consensus_timestamp: null, hedera_status: null, mirror_verified_at: null,
    mirror_verification_digest: null, last_error_code: null, last_error_detail: null,
    created_at: new Date("2026-11-03T14:00:00.000Z"), updated_at: new Date("2026-11-03T15:00:00.000Z"), completed_at: null,
    ...overrides,
  };
}

function harness(current: MrvSubmissionJob, overrides: Record<string, unknown> = {}) {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const db = {
    claim: async (...args: unknown[]) => { calls.push({ name: "claim", args }); return { job: current, leaseToken: TOKEN } satisfies MrvJobLease; },
    authorize: async (...args: unknown[]) => { calls.push({ name: "authorize", args }); return true; },
    advance: async (...args: unknown[]) => { calls.push({ name: "advance", args }); return true; },
    release: async (...args: unknown[]) => { calls.push({ name: "release", args }); return true; },
    renew: async (...args: unknown[]) => { calls.push({ name: "renew", args }); return true; },
    persistGuardian: async (...args: unknown[]) => { calls.push({ name: "persistGuardian", args }); return true; },
    persistHedera: async (...args: unknown[]) => { calls.push({ name: "persistHedera", args }); return true; },
    finalize: async (...args: unknown[]) => { calls.push({ name: "finalize", args }); return true; },
  };
  const deps: MrvRestrictedWorkerDependencies = {
    executeGuardianMrv: async () => ({ status: "VERIFIED", executionId: "guardian-exec-2", policyId: "policy-v1", correlationId: "corr-1", idempotencyKey: "stable-guardian-key", message: "verified" }),
    createHcsTransactionId: () => "0.0.1234@1730646000.000000002",
    hederaStatus: () => ({ readStatus: "AVAILABLE", writeStatus: "AVAILABLE", consensusStatus: "CONFIGURED", network: "testnet", mirrorNodeEndpoint: "https://mirror.invalid", topicId: "0.0.1234", configured: true, syntheticData: false }),
    integrityHash: () => "c".repeat(64),
    reconcileHcsTransaction: async () => ({ status: "CONFIRMED", transactionId: current.hedera_transaction_id!, consensusTimestamp: "1730646000.000000001", verification: {} }),
    submitHcsAnchor: async () => ({ status: "CONSENSUS_CONFIRMED", transactionId: current.hedera_transaction_id, consensusTimestamp: "1730646000.000000001", topicId: "0.0.1234", network: "testnet", integrityHash: "c".repeat(64), message: "confirmed" }),
    ...overrides,
  } as MrvRestrictedWorkerDependencies;
  return { database: db as unknown as MrvWorkerDatabaseApi, deps, calls };
}

test("restricted worker advances CLAIMED without invoking a provider", async () => {
  const previous = process.env.RUPAYKG_MRV_WORKER_ENABLED;
  process.env.RUPAYKG_MRV_WORKER_ENABLED = "true";
  try {
    const h = harness(job("CLAIMED"));
    const result = await runMrvSubmissionWorkerOnce(h.database, "worker-a", h.deps);
    assert.deepEqual(result, { outcome: "STAGE_ADVANCED", jobId: JOB_ID, stage: "GUARDIAN_SUBMITTED" });
    assert.deepEqual(h.calls.map(call => call.name), ["claim", "authorize", "advance"]);
    assert.equal(h.calls[2].args[1], TOKEN);
  } finally {
    if (previous === undefined) delete process.env.RUPAYKG_MRV_WORKER_ENABLED;
    else process.env.RUPAYKG_MRV_WORKER_ENABLED = previous;
  }
});

test("restricted worker executes Guardian only from GUARDIAN_SUBMITTED and persists verified result", async () => {
  const previous = process.env.RUPAYKG_MRV_WORKER_ENABLED;
  process.env.RUPAYKG_MRV_WORKER_ENABLED = "true";
  try {
    let guardianCalls = 0;
    const h = harness(job("GUARDIAN_SUBMITTED"), {
      executeGuardianMrv: async () => {
        guardianCalls += 1;
        return { status: "VERIFIED", executionId: "guardian-exec-2", policyId: "policy-v1", correlationId: "corr-1", idempotencyKey: "stable-guardian-key", message: "verified" };
      },
    });
    const result = await runMrvSubmissionWorkerOnce(h.database, "worker-a", h.deps);
    assert.equal(result.stage, "GUARDIAN_VERIFIED");
    assert.equal(guardianCalls, 1);
    assert.deepEqual(h.calls.map(call => call.name), ["claim", "authorize", "renew", "advance"]);
    assert.equal(h.calls[3].args[2], "GUARDIAN_VERIFIED");
    assert.equal((h.calls[3].args[3] as Record<string, unknown>).guardian_execution_id, "guardian-exec-2");
  } finally {
    if (previous === undefined) delete process.env.RUPAYKG_MRV_WORKER_ENABLED;
    else process.env.RUPAYKG_MRV_WORKER_ENABLED = previous;
  }
});

test("restricted worker persists HCS transaction binding before the HCS_SUBMITTED stage", async () => {
  const previous = process.env.RUPAYKG_MRV_WORKER_ENABLED;
  process.env.RUPAYKG_MRV_WORKER_ENABLED = "true";
  try {
    const h = harness(job("GUARDIAN_VERIFIED"));
    const result = await runMrvSubmissionWorkerOnce(h.database, "worker-a", h.deps);
    assert.equal(result.stage, "HCS_SUBMITTED");
    assert.deepEqual(h.calls.map(call => call.name), ["claim", "authorize", "persistHedera", "advance"]);
    assert.equal(h.calls[2].args[4], "0.0.1234@1730646000.000000002");
    assert.equal(h.calls[3].args[2], "HCS_SUBMITTED");
  } finally {
    if (previous === undefined) delete process.env.RUPAYKG_MRV_WORKER_ENABLED;
    else process.env.RUPAYKG_MRV_WORKER_ENABLED = previous;
  }
});

test("restricted worker submits only the persisted HCS transaction ID", async () => {
  const previous = process.env.RUPAYKG_MRV_WORKER_ENABLED;
  process.env.RUPAYKG_MRV_WORKER_ENABLED = "true";
  try {
    let submittedId: string | undefined;
    const current = job("HCS_SUBMITTED");
    const h = harness(current, {
      submitHcsAnchor: async (_payload: unknown, transactionId: string) => {
        submittedId = transactionId;
        return { status: "CONSENSUS_CONFIRMED", transactionId, consensusTimestamp: "1730646000.000000001", topicId: "0.0.1234", network: "testnet", integrityHash: "c".repeat(64), message: "confirmed" };
      },
    });
    const result = await runMrvSubmissionWorkerOnce(h.database, "worker-a", h.deps);
    assert.equal(result.stage, "HCS_CONSENSUS_CONFIRMED");
    assert.equal(submittedId, current.hedera_transaction_id);
    assert.equal(h.calls.at(-1)?.name, "advance");
    assert.equal(h.calls.at(-1)?.args[2], "HCS_CONSENSUS_CONFIRMED");
  } finally {
    if (previous === undefined) delete process.env.RUPAYKG_MRV_WORKER_ENABLED;
    else process.env.RUPAYKG_MRV_WORKER_ENABLED = previous;
  }
});

test("restricted worker reconciles Mirror Node only after HCS consensus confirmation", async () => {
  const previous = process.env.RUPAYKG_MRV_WORKER_ENABLED;
  process.env.RUPAYKG_MRV_WORKER_ENABLED = "true";
  try {
    let reconciled = 0;
    const h = harness(job("HCS_CONSENSUS_CONFIRMED"), {
      reconcileHcsTransaction: async () => {
        reconciled += 1;
        return { status: "CONFIRMED", transactionId: "0.0.1234@1730646000.000000001", consensusTimestamp: "1730646000.000000001", verification: {} };
      },
    });
    const result = await runMrvSubmissionWorkerOnce(h.database, "worker-a", h.deps);
    assert.equal(result.stage, "MIRROR_VERIFIED");
    assert.equal(reconciled, 1);
    assert.equal(h.calls.at(-1)?.name, "advance");
    assert.equal(h.calls.at(-1)?.args[2], "MIRROR_VERIFIED");
  } finally {
    if (previous === undefined) delete process.env.RUPAYKG_MRV_WORKER_ENABLED;
    else process.env.RUPAYKG_MRV_WORKER_ENABLED = previous;
  }
});
