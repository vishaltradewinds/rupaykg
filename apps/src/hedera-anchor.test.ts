import test from "node:test";
import assert from "node:assert/strict";
import { createHcsTransactionId, integrityHash, reconcileHcsTransaction, verifyHcsMessage, type AnchorPayload } from "./hedera-anchor.js";

const timestamp = "1791620000.123456789";
const topicId = "0.0.12345";
const payload: AnchorPayload = {
  schema: "rupaykg:mrv:v1",
  activityId: "activity-1",
  verificationId: "verification-1",
  evidenceId: "evidence-1",
  guardianPolicyId: "policy-1",
  guardianExecutionId: "guardian-execution-1",
  mrvStatus: "VERIFIED",
  methodologyCode: "BM WA03.001",
  quantity: 125,
  unit: "kg",
  metadata: { evidenceCount: 1 },
};

function withEnvironment<T>(fn: () => Promise<T>) {
  const previousNetwork = process.env.HEDERA_NETWORK;
  const previousTopic = process.env.HEDERA_TOPIC_ID;
  const previousFetch = globalThis.fetch;
  process.env.HEDERA_NETWORK = "testnet";
  process.env.HEDERA_TOPIC_ID = topicId;
  return fn().finally(() => {
    globalThis.fetch = previousFetch;
    if (previousNetwork === undefined) delete process.env.HEDERA_NETWORK;
    else process.env.HEDERA_NETWORK = previousNetwork;
    if (previousTopic === undefined) delete process.env.HEDERA_TOPIC_ID;
    else process.env.HEDERA_TOPIC_ID = previousTopic;
  });
}

test("Mirror Node verification confirms exact provenance after JSON omits undefined optional fields", async () => {
  await withEnvironment(async () => {
    const wirePayload: AnchorPayload = { ...payload, methodologyCode: undefined, quantity: undefined, unit: undefined, metadata: undefined };
    const hash = integrityHash(wirePayload);
    const anchored = JSON.parse(JSON.stringify({ ...wirePayload, integrityHash: hash, anchoredAt: "2026-10-10T00:00:00.000Z" })) as Record<string, unknown>;
    globalThis.fetch = async (input, init) => {
      assert.match(String(input), /testnet\.mirrornode\.hedera\.com/);
      assert.ok(init?.signal, "Mirror Node message verification must use a bounded request signal");
      return new Response(JSON.stringify({ messages: [{
        consensus_timestamp: timestamp,
        sequence_number: 7,
        topic_id: topicId,
        message: Buffer.from(JSON.stringify(anchored), "utf8").toString("base64"),
      }] }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const result = await verifyHcsMessage(timestamp, topicId, hash, payload.activityId, payload.verificationId, payload.evidenceId, payload.guardianExecutionId);
    assert.equal(result.verified, true);
    assert.equal("sequenceNumber" in result ? result.sequenceNumber : null, 7);
  });
});

test("Mirror Node verification rejects a mismatched activity even when a message exists", async () => {
  await withEnvironment(async () => {
    const hash = integrityHash(payload);
    const anchored = { ...payload, integrityHash: hash, anchoredAt: "2026-10-10T00:00:00.000Z" };
    globalThis.fetch = async () => new Response(JSON.stringify({ messages: [{
      consensus_timestamp: timestamp,
      sequence_number: 8,
      topic_id: topicId,
      message: Buffer.from(JSON.stringify(anchored), "utf8").toString("base64"),
    }] }), { status: 200, headers: { "content-type": "application/json" } });
    const result = await verifyHcsMessage(timestamp, topicId, hash, "different-activity", payload.verificationId, payload.evidenceId, payload.guardianExecutionId);
    assert.equal(result.verified, false);
    assert.match(String(result.error), /activityId/);
  });
});

test("MRV integrity hash survives JSON serialization when optional fields are undefined", () => {
  const withUndefined = { ...payload, methodologyCode: undefined, quantity: undefined, unit: undefined, metadata: undefined };
  const serialized = JSON.parse(JSON.stringify(withUndefined)) as AnchorPayload;
  assert.equal(integrityHash(withUndefined), integrityHash(serialized));
});

test("HCS transaction ID can be generated before submission for durable persistence", () => {
  const previous = { account: process.env.HEDERA_OPERATOR_ID, key: process.env.HEDERA_OPERATOR_KEY, topic: process.env.HEDERA_TOPIC_ID };
  process.env.HEDERA_OPERATOR_ID = "0.0.1234";
  process.env.HEDERA_OPERATOR_KEY = "a".repeat(64);
  process.env.HEDERA_TOPIC_ID = topicId;
  try {
    const transactionId = createHcsTransactionId();
    const [accountId, timestamp] = transactionId.split("@");
    assert.equal(accountId, "0.0.1234");
    assert.match(timestamp ?? "", /^[0-9]+[.][0-9]+$/);
  } finally {
    if (previous.account === undefined) delete process.env.HEDERA_OPERATOR_ID; else process.env.HEDERA_OPERATOR_ID = previous.account;
    if (previous.key === undefined) delete process.env.HEDERA_OPERATOR_KEY; else process.env.HEDERA_OPERATOR_KEY = previous.key;
    if (previous.topic === undefined) delete process.env.HEDERA_TOPIC_ID; else process.env.HEDERA_TOPIC_ID = previous.topic;
  }
});

test("Mirror Node reconciles a persisted HCS transaction ID and verifies the exact topic payload", async () => {
  await withEnvironment(async () => {
    const hash = integrityHash(payload);
    const anchored = { ...payload, integrityHash: hash, anchoredAt: "2026-10-10T00:00:00.000Z" };
    const mirrorId = "0.0.1234-1791620000-123456789";
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/transactions/")) {
        assert.ok(url.endsWith(encodeURIComponent(mirrorId)));
        return new Response(JSON.stringify({ transactions: [{ transaction_id: mirrorId, name: "CONSENSUS_SUBMIT_MESSAGE", entity_id: topicId, result: "SUCCESS", consensus_timestamp: timestamp }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ messages: [{ consensus_timestamp: timestamp, sequence_number: 11, topic_id: topicId, message: Buffer.from(JSON.stringify(anchored), "utf8").toString("base64") }] }), { status: 200 });
    };
    const result = await reconcileHcsTransaction("0.0.1234@1791620000.123456789", topicId, hash, payload.activityId, payload.verificationId, payload.evidenceId, payload.guardianExecutionId);
    assert.equal(result.status, "CONFIRMED");
    if (result.status === "CONFIRMED") assert.equal(result.consensusTimestamp, timestamp);
  });
});

test("Mirror Node 404 is pending and never treated as proof of non-submission", async () => {
  await withEnvironment(async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({}), { status: 404 });
    const result = await reconcileHcsTransaction("0.0.1234@1791620000.123456789", topicId);
    assert.equal(result.status, "PENDING");
  });
});


test("HCS ambiguous outcome polls the same persisted transaction ID until Mirror Node confirms it", async () => {
  await withEnvironment(async () => {
    const hash = integrityHash(payload);
    const anchored = { ...payload, integrityHash: hash, anchoredAt: "2026-10-10T00:00:00.000Z" };
    const transactionId = "0.0.1234@1791620000.123456789";
    const mirrorId = "0.0.1234-1791620000-123456789";
    const transactionLookups: string[] = [];
    let lookupCount = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/transactions/")) {
        transactionLookups.push(url);
        lookupCount += 1;
        if (lookupCount === 1) return new Response(JSON.stringify({}), { status: 404 });
        return new Response(JSON.stringify({ transactions: [{
          transaction_id: mirrorId,
          name: "CONSENSUS_SUBMIT_MESSAGE",
          entity_id: topicId,
          result: "SUCCESS",
          consensus_timestamp: timestamp,
        }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ messages: [{
        consensus_timestamp: timestamp,
        sequence_number: 12,
        topic_id: topicId,
        message: Buffer.from(JSON.stringify(anchored), "utf8").toString("base64"),
      }] }), { status: 200 });
    };
    const pending = await reconcileHcsTransaction(transactionId, topicId, hash, payload.activityId, payload.verificationId, payload.evidenceId, payload.guardianExecutionId);
    assert.equal(pending.status, "PENDING");
    const confirmed = await reconcileHcsTransaction(transactionId, topicId, hash, payload.activityId, payload.verificationId, payload.evidenceId, payload.guardianExecutionId);
    assert.equal(confirmed.status, "CONFIRMED");
    assert.equal(transactionLookups.length, 2);
    assert.equal(transactionLookups[0], transactionLookups[1], "reconciliation must query the exact same persisted HCS transaction ID");
  });
});


test("Mirror Node reconciliation rejects unrelated transaction IDs instead of falling back to the first record", async () => {
  await withEnvironment(async () => {
    const transactionId = "0.0.1234@1791620000.123456789";
    const unrelatedMirrorId = "0.0.1234-1791620001-987654321";
    let messageLookupAttempted = false;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/transactions/")) {
        return new Response(JSON.stringify({ transactions: [{
          transaction_id: unrelatedMirrorId,
          name: "CONSENSUS_SUBMIT_MESSAGE",
          entity_id: topicId,
          result: "SUCCESS",
          consensus_timestamp: timestamp,
        }] }), { status: 200 });
      }
      messageLookupAttempted = true;
      return new Response(JSON.stringify({ messages: [] }), { status: 200 });
    };
    const result = await reconcileHcsTransaction(transactionId, topicId);
    assert.equal(result.status, "MISMATCH");
    assert.equal(messageLookupAttempted, false, "unrelated transaction must not reach message verification");
  });
});
