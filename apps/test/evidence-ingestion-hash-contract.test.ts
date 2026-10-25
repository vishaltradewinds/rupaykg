import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("field-sync evidence ingestion requires a lowercase 64-character SHA-256 digest", async () => {
  const route = await read("apps/src/sync-routes.ts");
  assert.ok(route.includes("!contentHash || !/^[0-9a-f]{64}$/.test(contentHash)"));
  assert.ok(route.includes("a lowercase 64-character SHA-256 contentHash"));
});
