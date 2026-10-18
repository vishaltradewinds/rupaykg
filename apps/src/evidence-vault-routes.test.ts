import test from "node:test";
import assert from "node:assert/strict";
import { decodeEvidenceBase64, evidencePayloadMatchesMediaType, sanitizeEvidenceFileName } from "./evidence-vault-routes.js";

test("evidence filenames are normalized and cannot retain path traversal", () => {
  assert.equal(sanitizeEvidenceFileName("../../meter-reading.pdf"), "__/__/meter-reading.pdf");
  assert.equal(sanitizeEvidenceFileName("   "), null);
  assert.equal(sanitizeEvidenceFileName("x".repeat(181)), null);
});

test("base64 decoder rejects malformed, empty and oversized input", () => {
  assert.equal(decodeEvidenceBase64("not base64!"), null);
  assert.equal(decodeEvidenceBase64(""), null);
  assert.equal(decodeEvidenceBase64(Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64")), null);
  assert.deepEqual(decodeEvidenceBase64(Buffer.from("%PDF-1.7\nexample").toString("base64")), Buffer.from("%PDF-1.7\nexample"));
});

test("evidence media type must match basic file signature or text content", () => {
  assert.equal(evidencePayloadMatchesMediaType(Buffer.from("%PDF-1.7\n"), "application/pdf"), true);
  assert.equal(evidencePayloadMatchesMediaType(Buffer.from("MZ\u0000\u0000"), "application/pdf"), false);
  assert.equal(evidencePayloadMatchesMediaType(Buffer.from([137,80,78,71,13,10,26,10]), "image/png"), true);
  assert.equal(evidencePayloadMatchesMediaType(Buffer.from([0xff,0xd8,0xff,0x00]), "image/jpeg"), true);
  assert.equal(evidencePayloadMatchesMediaType(Buffer.from("{\"reading\":12}"), "application/json"), true);
  assert.equal(evidencePayloadMatchesMediaType(Buffer.from("{bad json"), "application/json"), false);
  assert.equal(evidencePayloadMatchesMediaType(Buffer.from([0,1,2]), "text/plain"), false);
});
