import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const webRoot = resolve(new URL("..", import.meta.url).pathname, "..");
const repoRoot = resolve(webRoot, "../..");
const dist = join(webRoot, "dist");
const indexPath = join(dist, "index.html");
const sourceApi = readFileSync(join(webRoot, "src", "api.ts"), "utf8");
const sourceApp = readFileSync(join(webRoot, "src", "App.tsx"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`Web production smoke failed: ${message}`);
}

assert(existsSync(indexPath), "Vite production index.html is missing");
const index = readFileSync(indexPath, "utf8");
assert(index.includes("<script") && index.includes("type=\"module\""), "production index does not reference the module entrypoint");

const assets = readdirSync(dist, { recursive: true }).filter(name => typeof name === "string" && /\.(js|css)$/.test(name));
assert(assets.length > 0, "production bundle contains no JS/CSS assets");

const requiredApiPaths = [
  "/health",
  "/api/v1/overview",
  "/api/v1/regulatory/sources",
  "/api/v1/geography/roots",
  "/api/v1/workspaces/resource-flows",
  "/api/v1/workspaces/mrv",
  "/api/v1/workspaces/compliance",
  "/api/v1/workspaces/carbon",
  "/api/v1/workspaces/registry",
  "/api/v1/workspaces/settlement",
  "/api/v1/workspaces/intelligence",
  "/api/v1/field-sync/conflicts",
];
for (const path of requiredApiPaths) assert(sourceApi.includes(`\"${path}`) || sourceApi.includes(`\`${path}`), `frontend API contract is missing ${path}`);

assert(sourceApi.includes("syntheticData: boolean"), "frontend does not model authoritative syntheticData state");
assert(sourceApp.includes("No fabricated metrics"), "UI does not explicitly communicate non-fabricated operating state");
assert(sourceApp.includes("Sessions are validated by the authoritative RupayKG API"), "UI does not communicate authoritative authentication");
assert(sourceApp.includes("UI display does not approve, issue, transfer or mutate carbon value"), "carbon UI does not declare non-mutating provenance semantics");
assert(sourceApp.includes("Advisory only"), "intelligence UI does not declare advisory-only semantics");
assert(sourceApp.includes("window.sessionStorage"), "session handling is not confined to browser session storage");
assert(existsSync(join(repoRoot, "apps", "api", "src", "api.ts")) === false, "smoke path resolution unexpectedly points at apps/src/api.ts");

const bundledText = assets
  .map(asset => readFileSync(join(dist, asset), "utf8"))
  .join("\n");
assert(!/demo data|mock data|sample data|fake data/i.test(bundledText), "production bundle contains demo/mock/sample/fake data marker");

console.log(`Web production smoke passed: ${assets.length} bundled assets, ${requiredApiPaths.length} authoritative API contracts, no demo/mock data markers.`);
