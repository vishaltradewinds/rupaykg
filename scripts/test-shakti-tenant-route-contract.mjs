#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const routes = [
  "apps/src/bwg-routes.ts",
  "apps/src/cpcb-swm-routes.ts",
  "apps/src/epr-return-routes.ts",
  "apps/src/evidence-vault-routes.ts",
  "apps/src/intelligence-routes.ts",
  "apps/src/mrv-routes.ts",
  "apps/src/statutory-routes.ts",
  "apps/src/sync-routes.ts",
  "apps/src/value-routes.ts",
  "apps/src/workspace-routes.ts",
  "apps/src/registry-routes.ts",
];

const violations = [];
for (const relative of routes) {
  const source = fs.readFileSync(path.resolve(relative), "utf8");
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (/\bpool\.query\s*\(/.test(line) || /\bpool\.connect\s*\(/.test(line)) {
      violations.push(`${relative}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length) {
  console.error("Tenant-route transaction contract FAILED:");
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log(`Tenant-route transaction contract PASSED: ${routes.length} reviewed route files contain no direct pool.query/pool.connect calls.`);
