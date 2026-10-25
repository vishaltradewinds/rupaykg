import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Tests run from apps/dist/src; read the corresponding checked-in source file.
const source = readFileSync(fileURLToPath(new URL("../../src/bm-wa03001-baseline-routes.ts", import.meta.url)), "utf8");

test("BM WA03.001 baseline evidence must be verified and have a valid SHA-256 content hash", () => {
  assert.match(source, /status='VERIFIED' and content_hash ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(source, /Every baseline evidence item must be VERIFIED with a valid SHA-256 content hash and belong to this activity/);
});

test("baseline submission and independent decision share the same evidence gate", () => {
  assert.equal((source.match(/evidenceIsVerifiedForActivity\(/g) ?? []).length, 3);
  assert.match(source, /Baseline evidence is no longer fully verified with a valid SHA-256 content hash for this activity/);
});
