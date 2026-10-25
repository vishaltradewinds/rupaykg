import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("statutory determinations require VERIFIED evidence with a SHA-256 hash", async () => {
  const route = await read("apps/src/statutory-routes.ts");
  assert.ok(route.includes("e.status='VERIFIED'"));
  assert.ok(route.includes("e.content_hash ~ '^[0-9a-f]{64}$'"));
  assert.doesNotMatch(route, /content_hash is not null or e\.content_uri is not null/i);
});

test("value calculations and EPR credit eligibility require hash-valid evidence", async () => {
  const route = await read("apps/src/value-routes.ts");
  assert.ok(route.includes("e.content_hash ~ '^[0-9a-f]{64}$'"));
  assert.ok(route.includes("!evidenceRow.content_hash || !/^[0-9a-f]{64}$/.test(evidenceRow.content_hash)"));
  assert.doesNotMatch(route, /content_hash is not null or e\.content_uri is not null/i);
});
