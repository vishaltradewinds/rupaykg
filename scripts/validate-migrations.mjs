import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dir = path.resolve("migrations");
const files = (await readdir(dir)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
const numbers = new Map();
const objects = new Map();
const contentHashes = new Map();

const patterns = [
  ["type", /create\s+type\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi],
  ["table", /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi],
  ["sequence", /create\s+sequence\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi],
  ["index", /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi],
  ["trigger", /create\s+trigger\s+([a-z0-9_]+)/gi],
  ["function", /create\s+(?:or\s+replace\s+)?function\s+([a-z0-9_]+)/gi],
];

for (const file of files) {
  const number = Number(file.match(/^\d+/)[0]);
  const priorNumberFile = numbers.get(number);
  if (priorNumberFile) {
    throw new Error(`duplicate migration number ${number}: ${priorNumberFile} and ${file}`);
  }
  numbers.set(number, file);

  const sql = await readFile(path.join(dir, file), "utf8");
  const normalizedSql = sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const hash = createHash("sha256").update(normalizedSql).digest("hex");
  const priorHashFile = contentHashes.get(hash);
  if (priorHashFile) {
    throw new Error(`duplicate migration content: ${priorHashFile} and ${file}`);
  }
  contentHashes.set(hash, file);

  for (const [kind, pattern] of patterns) {
    for (const match of sql.matchAll(pattern)) {
      const object = match[1].toLowerCase();
      const key = `${kind}:${object}`;
      // The matched declaration itself contains the CREATE modifiers. Looking
      // backward for the previous "create" can accidentally inspect an unrelated
      // earlier statement and misclassify valid CREATE OR REPLACE declarations.
      const declaration = match[0].toLowerCase();
      const replaceable = kind === "function" && /create\s+or\s+replace\s+function/.test(declaration);
      const guarded = /if\s+not\s+exists/.test(declaration);
      const prior = objects.get(key);

      // Repeated declarations may be intentional when the later migration explicitly
      // replaces a function or guards creation with IF NOT EXISTS. These are tracked
      // rather than treated as a hard collision; migration-path tests must still prove
      // the resulting schema is correct.
      if (prior && !replaceable && !guarded) {
        throw new Error(`duplicate unguarded database ${kind} '${object}' in ${prior.file} and ${file}`);
      }
      if (!prior) objects.set(key, { file, replaceable, guarded });
    }
  }
}

console.log(`Validated ${files.length} migrations and ${objects.size} schema objects.`);
