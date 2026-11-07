import fs from "node:fs";
import path from "node:path";

const candidates = ["migrations", "db/migrations", "drizzle", "db"];
const found = [];

function walk(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/^\d+_.+\.sql$/i.test(entry.name)) found.push(full);
  }
}

for (const candidate of candidates) walk(path.resolve(candidate));

const unique = [...new Set(found)].sort();
const numbers = new Map();
for (const file of unique) {
  const m = path.basename(file).match(/^(\d+)_/);
  if (!m) continue;
  const n = Number(m[1]);
  if (numbers.has(n)) {
    throw new Error(`G-002 MIGRATION INVENTORY BLOCKED: duplicate migration number ${n}: ${numbers.get(n)} and ${file}`);
  }
  numbers.set(n, file);
}

const ordered = [...numbers.entries()].sort((a,b) => a[0]-b[0]);
console.log("=== RUPAYKG G-002 MIGRATION INVENTORY ===");
console.log(`migration SQL files: ${unique.length}`);
console.log(`unique numeric versions: ${ordered.length}`);
if (ordered.length) {
  console.log(`first version: ${ordered[0][0]}`);
  console.log(`last version: ${ordered[ordered.length-1][0]}`);
}
console.log("This is repository inventory evidence only; it does not establish production ledger parity.");
