import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const routeFiles = [
  "apps/src/server.ts",
  "apps/src/value-routes.ts",
  "apps/src/sync-routes.ts",
  "apps/src/registry-routes.ts",
  "apps/src/platform-admin-routes.ts",
  "apps/src/mrv-routes.ts",
  "apps/src/workspace-routes.ts",
  "apps/src/evidence-vault-routes.ts",
  "apps/src/statutory-routes.ts",
  "apps/src/auth-routes.ts",
  "apps/src/onboarding-hierarchy-routes.ts",
  "apps/src/bwg-routes.ts",
  "apps/src/cpcb-swm-routes.ts",
  "apps/src/intelligence-routes.ts",
] as const;

test("request-path database access stays transaction-context-bound", async () => {
  const violations: string[] = [];

  for (const relativePath of routeFiles) {
    const source = await readFile(path.resolve(process.cwd(), relativePath), "utf8");
    const lines = source.split("\n");

    lines.forEach((line, index) => {
      if (/\bpool\.(query|connect)\b/.test(line) || /\bPool\s*\|\s*PoolClient\b/.test(line)) {
        violations.push(`${relativePath}:${index + 1}:${line.trim()}`);
      }
    });
  }

  assert.deepEqual(violations, [], `raw/shared request-path database access detected:\n${violations.join("\n")}`);
});
