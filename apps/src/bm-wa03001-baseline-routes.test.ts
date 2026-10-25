import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Tests run from apps/dist/src; read the corresponding checked-in source file.
const source = readFileSync(fileURLToPath(new URL("../../src/bm-wa03001-baseline-routes.ts", import.meta.url)), "utf8");

test("BM WA03.001 baseline evidence must be verified and content-addressed", () => {
  assert.match(source, /status='VERIFIED' and \(content_hash is not null or content_uri is not null\)/);
  assert.match(source, /Every baseline evidence item must be VERIFIED, content-addressed, and belong to this activity/);
});

test("baseline submission and independent decision share the same evidence gate", () => {
  assert.equal((source.match(/evidenceIsVerifiedForActivity\(/g) ?? []).length, 3);
  assert.match(source, /Baseline evidence is no longer fully verified and content-addressed for this activity/);
});
