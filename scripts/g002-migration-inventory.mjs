import crypto from "node:crypto";
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
const rows = [];
for (const file of unique) {
  const m = path.basename(file).match(/^(\d+)_/);
  if (!m) continue;
  const n = Number(m[1]);
  if (numbers.has(n)) throw new Error(`G-002 MIGRATION INVENTORY BLOCKED: duplicate migration number ${n}: ${numbers.get(n)} and ${file}`);
  numbers.set(n, file);
}
for (const [version, file] of [...numbers.entries()].sort((a,b)=>a[0]-b[0])) {
  const bytes = fs.readFileSync(file);
  rows.push({version, file:path.relative(process.cwd(),file).replaceAll("\\","/"), sha256:crypto.createHash("sha256").update(bytes).digest("hex"), bytes:bytes.length});
}
const manifest = {
  repository:"vishaltradewinds/rupaykg",
  purpose:"G-002 migration authority reconciliation; repository evidence only",
  generatedAt:new Date().toISOString(),
  migrationSqlFileCount:rows.length,
  firstVersion:rows[0]?.version ?? null,
  lastVersion:rows.at(-1)?.version ?? null,
  migrations:rows
};
const out=path.resolve("docs/G002_PRIMARY_MIGRATION_INVENTORY.json");
fs.writeFileSync(out, JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify(manifest,null,2));
console.log(`Wrote ${out}`);
