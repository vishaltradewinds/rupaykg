import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("Guardian MRV only consumes VERIFIED evidence with a valid SHA-256 content hash", async () => {
  const route = await read("apps/src/mrv-routes.ts");
  assert.ok(route.includes("e2.status='VERIFIED' and e2.content_hash ~ '^[0-9a-f]{64}$'"));
  assert.ok(route.includes("status='VERIFIED' and content_hash ~ '^[0-9a-f]{64}$'"));
  assert.match(route, /e\.content_hash evidence_content_hash/);
  assert.match(route, /valid SHA-256 content hash are required before Guardian MRV/);
});
