import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("apps/src");
const violations = [];
const explicitExceptions = new Map([
  ["apps/src/acceptance-seed.ts", "disposable acceptance fixture only"],
  ["apps/src/migrate.ts", "protected migrator implementation; not request-path access"],
  ["apps/src/server.ts", "global health probe only; no tenant data authorization path"],
  ["apps/src/auth-routes.ts", "identity/bootstrap/control-plane operations; tenant-scoped onboarding mutations require separate boundary review"],
]);
const exceptionHits = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      const text = await readFile(full, "utf8");
      const patterns = [
        { label: "direct pool.query", re: /\bpool\.query\s*\(/g },
        { label: "direct pool.connect", re: /\bpool\.connect\s*\(/g },
        { label: "permission check against shared pool", re: /hasOrganizationPermission\s*\(\s*pool\s*,/g },
        { label: "geography check against shared pool", re: /authorizeGeography\s*\(\s*pool\s*,/g },
      ];
      for (const pattern of patterns) {
        if (pattern.re.test(text)) {
          const relative = path.relative(process.cwd(), full).replaceAll("\\", "/");
          const exception = explicitExceptions.get(relative);
          if (exception) exceptionHits.push(relative + ": " + pattern.label + " — " + exception);
          else violations.push(relative + ": " + pattern.label);
        }
      }
    }
  }
}

await walk(root);
if (exceptionHits.length) {
  console.log("Protected database access audit: explicit exceptions");
  for (const hit of exceptionHits) console.log(hit);
}
if (violations.length) {
  console.error("Protected database access audit: FAIL — tenant/request-path shared-pool access remains");
  for (const violation of violations) console.error(violation);
  process.exit(2);
}
console.log("Protected database access audit: PASS — no unclassified unsafe shared-pool patterns found.");
