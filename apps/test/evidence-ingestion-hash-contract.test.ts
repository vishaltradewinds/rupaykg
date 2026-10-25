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

test("legal onboarding evidence requires a SHA-256 digest before legal verification", async () => {
  const intake = await read("apps/src/auth-routes.ts");
  const verification = await read("apps/src/onboarding-hierarchy-routes.ts");
  const ui = await read("apps/web/src/main.tsx");
  assert.ok(intake.includes("contentHash&&!/^[0-9a-f]{64}$/.test(contentHash)"));
  assert.ok(verification.includes("and content_hash ~ '^[0-9a-f]{64}$'"));
  assert.ok(ui.includes("Document content hash must be a lowercase 64-character SHA-256 digest."));
});
