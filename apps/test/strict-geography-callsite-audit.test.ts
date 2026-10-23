import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const highImpactRouteFiles = [
  "mrv-routes.ts",
  "epr-return-routes.ts",
  "statutory-routes.ts",
  "value-routes.ts",
  "cpcb-swm-routes.ts",
  "sync-routes.ts",
  "workspace-routes.ts",
];

function sourceFor(fileName: string): string {
  const path = [
    `../src/${fileName}`,
    `../../src/${fileName}`,
  ].map((relative) => fileURLToPath(new URL(relative, import.meta.url))).find(existsSync);
  if (!path) throw new Error(`High-impact route source not found: ${fileName}`);
  return readFileSync(path, "utf8");
}

test("high-impact route call sites never use the permissive legacy geography helper", () => {
  for (const fileName of highImpactRouteFiles) {
    const source = sourceFor(fileName);
    assert.doesNotMatch(
      source,
      /\borganization_has_geography_scope\s*\(/,
      `${fileName} must not authorize high-impact work using the legacy unscoped fallback`,
    );
  }
});

test("high-impact route call sites use the strict geography helper", () => {
  for (const fileName of highImpactRouteFiles) {
    assert.match(
      sourceFor(fileName),
      /\borganization_has_explicit_geography_scope\s*\(/,
      `${fileName} must retain explicit verified geography-scope authorization`,
    );
  }
});
