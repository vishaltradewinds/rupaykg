import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("BM-T-011 submission and independent review require VERIFIED SHA-256 evidence", async () => {
  const route = await read("apps/src/bm-t-011-assessment-routes.ts");
  assert.ok(route.includes("status='VERIFIED' and content_hash ~ '^[0-9a-f]{64}$'"));
  assert.match(route, /Every BM-T-011 evidence item must be VERIFIED with a valid SHA-256 content hash and belong to this activity/);
  assert.match(route, /Assessment evidence is no longer verified with a valid SHA-256 content hash/);
  assert.equal((route.match(/evidenceIsVerified\(/g) ?? []).length, 3);
});
