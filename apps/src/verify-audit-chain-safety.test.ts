import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const verifierSource = readFileSync(fileURLToPath(new URL("../../src/verify-audit-chain.ts", import.meta.url)), "utf8");

test("audit-chain verifier uses a repeatable-read read-only transaction", () => {
  assert.match(verifierSource, /begin transaction isolation level repeatable read read only/i);
  assert.match(verifierSource, /mode: "READ_ONLY"/);
  assert.match(verifierSource, /rejectUnauthorized: true/);
});

test("audit-chain verifier does not issue database mutations or migrations", () => {
  assert.doesNotMatch(verifierSource, /\b(?:insert\s+into|update\s+[a-z_]+\s+set|delete\s+from|create\s+table|alter\s+table|drop\s+table)\b/i);
  assert.doesNotMatch(verifierSource, /migrate\.ts/);
});
