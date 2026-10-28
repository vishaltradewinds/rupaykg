import test from "node:test";
import assert from "node:assert/strict";
import { canonicalIntegrityHash, integrityHash, verifyHcsMessage, type AnchorPayload } from "./hedera-anchor.js";

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
    globalThis.fetch = async (input) => {
      assert.match(String(input), /testnet\.mirrornode\.hedera\.com/);
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


test("canonical source digests and HCS payload hash change when evidence changes", () => {
  const evidence = [{ id: "ev-1", content_hash: "sha256:aaa", status: "VERIFIED" }];
  const digest = canonicalIntegrityHash({ schema: "rupaykg:mrv-evidence:v1", evidence });
  const changedDigest = canonicalIntegrityHash({ schema: "rupaykg:mrv-evidence:v1", evidence: [{ ...evidence[0], content_hash: "sha256:bbb" }] });
  assert.notEqual(digest, changedDigest);
  assert.notEqual(integrityHash({ ...payload, metadata: { evidenceDigest: digest } }), integrityHash({ ...payload, metadata: { evidenceDigest: changedDigest } }));
});


test("Mirror Node verification rejects malformed JSON without accepting provenance", async () => {
  await withEnvironment(async () => {
    globalThis.fetch = async () => new Response("{not-json", { status: 200, headers: { "content-type": "application/json" } });
    const result = await verifyHcsMessage(timestamp, topicId);
    assert.equal(result.verified, false);
    assert.match(String(result.error), /malformed JSON/);
  });
});

test("Mirror Node verification rejects oversized response bodies", async () => {
  await withEnvironment(async () => {
    globalThis.fetch = async () => new Response("x".repeat(1024 * 1024 + 1), { status: 200, headers: { "content-type": "application/json" } });
    const result = await verifyHcsMessage(timestamp, topicId);
    assert.equal(result.verified, false);
    assert.match(String(result.error), /size limit/);
  });
});

test("Mirror Node network and timeout errors fail closed with sanitized errors", async () => {
  await withEnvironment(async () => {
    globalThis.fetch = async () => { throw Object.assign(new Error("secret endpoint token should not leak"), { name: "AbortError" }); };
    const result = await verifyHcsMessage(timestamp, topicId);
    assert.equal(result.verified, false);
    assert.equal(result.error, "Mirror Node request timed out");
    assert.equal(JSON.stringify(result).includes("secret endpoint token"), false);
  });
});

test("Mirror Node verification rejects malformed topic and timestamp before network access", async () => {
  await withEnvironment(async () => {
    let called = false;
    globalThis.fetch = async () => { called = true; return new Response("{}", { status: 200 }); };
    const badTopic = await verifyHcsMessage(timestamp, "https://attacker.invalid");
    const badTimestamp = await verifyHcsMessage("not-a-timestamp", topicId);
    assert.equal(badTopic.verified, false);
    assert.equal(badTimestamp.verified, false);
    assert.equal(called, false);
  });
});
