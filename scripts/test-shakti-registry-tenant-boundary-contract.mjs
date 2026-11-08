#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const failures = [];
function routeBlocks() {
  const matches = [...source.matchAll(/app\\.post\\("([^"]+)"/g)];
  return matches.map((m, i) => {
    const start = m.index;
    const next = matches[i + 1]?.index;
    return { route: m[1], block: source.slice(start, next ?? source.length).replace(/\\s+/g, " ").trim() };
  });
}
const routes = routeBlocks();
if (routes.length < 8) failures.push(`Expected registry transaction surface to contain at least 8 POST routes; found ${routes.length}`);
for (const { route, block } of routes) {
  if (!block.includes("withTenantTransaction(")) failures.push(`${route}: tenant-sensitive registry mutation is not bound to withTenantTransaction`);
  if (/pool\\.query\\s*\\(|pool\\.connect\\s*\\(/.test(block)) failures.push(`${route}: direct pool query/connect bypasses transaction boundary`);
}
const multiParty = routes.filter(({ route }) => route.startsWith("/api/v1/settlements"));
for (const { route, block } of multiParty) {
  if (!/canActForOrganization\\(auth, r?\\.rows\\[0\\]\\.(payer_id|payee_id)\\)|canActForOrganization\\(auth, payerId\\)|canActForOrganization\\(auth, payeeId\\)/.test(block)) failures.push(`${route}: multi-party organization authorization guard missing`);
}
if (failures.length) { console.error("Shakti registry tenant-boundary contract FAILED:"); for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log(`Shakti registry tenant-boundary contract PASSED: ${routes.length} registry mutation routes are transaction-bound and multi-party settlement routes retain explicit party authorization.`);