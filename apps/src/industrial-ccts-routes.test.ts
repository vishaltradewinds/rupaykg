import test from "node:test";
import assert from "node:assert/strict";
import { isOfficialCctsReviewReference, isSha256Digest } from "./industrial-ccts-routes.js";

test("CCTS rule review accepts HTTPS links on recognized official authority domains", () => {
  assert.equal(isOfficialCctsReviewReference("https://beeindia.gov.in/view_content.php?lang=1&lid=571"), true);
  assert.equal(isOfficialCctsReviewReference("https://powermin.gov.in/notification.pdf"), true);
  assert.equal(isOfficialCctsReviewReference("https://subdomain.egazette.nic.in/notice"), true);
});

test("CCTS rule review rejects insecure, credential-bearing, and lookalike source URLs", () => {
  assert.equal(isOfficialCctsReviewReference("http://beeindia.gov.in/notice"), false);
  assert.equal(isOfficialCctsReviewReference("https://beeindia.gov.in.attacker.example/notice"), false);
  assert.equal(isOfficialCctsReviewReference("https://attacker.example/?next=beeindia.gov.in"), false);
  assert.equal(isOfficialCctsReviewReference("https://user:pass@beeindia.gov.in/notice"), false);
  assert.equal(isOfficialCctsReviewReference("not a URL"), false);
});

test("CCTS review evidence hashes must be 64 hexadecimal characters", () => {
  assert.equal(isSha256Digest("a".repeat(64)), true);
  assert.equal(isSha256Digest("A".repeat(64)), true);
  assert.equal(isSha256Digest("a".repeat(63)), false);
  assert.equal(isSha256Digest("g".repeat(64)), false);
});
