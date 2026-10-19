import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyGovBridgeSignature } from "./async-mirror-routes.js";

const secret = "test-only-secret-with-at-least-thirty-two-characters";
const body = JSON.stringify({ batchMetadata: { authorityCode: "MH-PCB" }, rawDataLogs: ["sample record"] });
const now = Date.parse("2026-10-19T10:00:00Z");
const timestamp = String(now);
const signature = "sha256=" + createHmac("sha256", secret).update(timestamp + "." + body, "utf8").digest("hex");

test("accepts a valid timestamp-bound HMAC signature", () => {
  assert.equal(verifyGovBridgeSignature(secret, timestamp, signature, body, now), true);
});

test("rejects invalid signatures and altered payloads", () => {
  assert.equal(verifyGovBridgeSignature(secret, timestamp, signature, body + " ", now), false);
  assert.equal(verifyGovBridgeSignature(secret, timestamp, "sha256=" + "0".repeat(64), body, now), false);
});

test("rejects stale timestamps, weak secrets and malformed headers", () => {
  assert.equal(verifyGovBridgeSignature(secret, String(now - 600_000), signature, body, now), false);
  assert.equal(verifyGovBridgeSignature("short", timestamp, signature, body, now), false);
  assert.equal(verifyGovBridgeSignature(secret, "not-a-timestamp", signature, body, now), false);
  assert.equal(verifyGovBridgeSignature(secret, timestamp, undefined, body, now), false);
});
