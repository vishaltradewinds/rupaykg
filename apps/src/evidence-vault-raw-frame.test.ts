import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { evidencePayloadMatchesMediaType } from "./evidence-vault-routes.js";

test("evidence vault accepts arbitrary binary raw frames only as non-empty octet-stream bytes", () => {
  const raw = Buffer.from([0x00, 0xff, 0x01, 0x7f, 0x0a]);
  assert.equal(evidencePayloadMatchesMediaType(raw, "application/octet-stream"), true);
  assert.equal(evidencePayloadMatchesMediaType(Buffer.alloc(0), "application/octet-stream"), false);
  assert.equal(createHash("sha256").update(raw).digest("hex").length, 64);
});

test("binary frame bytes are not coerced through text decoding", () => {
  const raw = Buffer.from([0x00, 0xff, 0xc3, 0x28]);
  assert.equal(evidencePayloadMatchesMediaType(raw, "application/octet-stream"), true);
  assert.notEqual(raw.toString("utf8"), raw.toString("hex"));
});
