import test from "node:test";
import assert from "node:assert/strict";
import { evidenceReviewTransitionFailure } from "./evidence-vault-routes.js";

test("captured evidence can receive an initial approval or rejection", () => {
  assert.equal(evidenceReviewTransitionFailure("CAPTURED", "APPROVED"), null);
  assert.equal(evidenceReviewTransitionFailure("CAPTURED", "REJECTED"), null);
});

test("verified evidence can be revoked by a later rejection", () => {
  assert.equal(evidenceReviewTransitionFailure("VERIFIED", "REJECTED"), null);
});

test("verified evidence cannot be approved again on the same immutable version", () => {
  assert.match(
    evidenceReviewTransitionFailure("VERIFIED", "APPROVED") ?? "",
    /only be revoked by a rejection review/i,
  );
});

test("rejected evidence is terminal and replacement must be a new version", () => {
  assert.match(
    evidenceReviewTransitionFailure("REJECTED", "APPROVED") ?? "",
    /upload a new version/i,
  );
  assert.match(
    evidenceReviewTransitionFailure("REJECTED", "REJECTED") ?? "",
    /upload a new version/i,
  );
});

test("unknown statuses and decisions fail closed", () => {
  assert.match(evidenceReviewTransitionFailure("UNKNOWN", "APPROVED") ?? "", /does not permit review/i);
  assert.match(evidenceReviewTransitionFailure("CAPTURED", "MAYBE") ?? "", /must be APPROVED or REJECTED/i);
});
