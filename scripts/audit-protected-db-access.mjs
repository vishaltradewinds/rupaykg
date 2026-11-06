import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("apps/src");
const violations = [];

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
        if (pattern.re.test(text)) violations.push(`${full}: ${pattern.label}`);
      }
    }
  }
}

await walk(root);
if (violations.length) {
  console.error("Protected database access audit: FAIL");
  for (const violation of violations) console.error(violation);
  process.exit(2);
}
console.log("Protected database access audit: PASS — no configured unsafe shared-pool patterns found.");
