import test from "node:test";
import assert from "node:assert/strict";
import { mrvSourceDigest } from "./mrv-source-snapshot.js";

test("MRV source digest is canonical and independent of object key order", () => {
  const left = { schema: "rupaykg:mrv-source-snapshot:v1", observation: { unit: "kg", value: "12.5" }, evidence: [{ id: "e-1", hash: "abc" }] };
  const right = { evidence: [{ hash: "abc", id: "e-1" }], observation: { value: "12.5", unit: "kg" }, schema: "rupaykg:mrv-source-snapshot:v1" };
  assert.equal(mrvSourceDigest(left), mrvSourceDigest(right));
});

test("MRV source digest changes when any observation or evidence version changes", () => {
  const baseline = { observations: [{ id: "o-1", observed_value: "12.5" }], evidence: [{ id: "e-1", artifact_sha256: "abc" }] };
  assert.notEqual(mrvSourceDigest(baseline), mrvSourceDigest({ ...baseline, observations: [{ id: "o-1", observed_value: "12.6" }] }));
  assert.notEqual(mrvSourceDigest(baseline), mrvSourceDigest({ ...baseline, evidence: [{ id: "e-1", artifact_sha256: "def" }] }));
});

test("MRV source digest is a SHA-256 hex digest", () => {
  assert.match(mrvSourceDigest({ a: 1 }), /^[0-9a-f]{64}$/);
});
