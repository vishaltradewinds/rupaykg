import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dir = path.resolve("migrations");
const files = (await readdir(dir)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
const numbers = new Set();
const objects = new Map();

for (const file of files) {
  const number = Number(file.match(/^\d+/)[0]);
  if (numbers.has(number)) throw new Error(`duplicate migration number: ${number} (${file})`);
  numbers.add(number);
  const sql = await readFile(path.join(dir, file), "utf8");
  // Resolve schema-qualified names instead of treating the schema itself as
  // the object name. Unqualified CREATE TABLE/TYPE statements target public.
  const patterns = [
    /create\s+type\s+(?:if\s+not\s+exists\s+)?(?:(?<schema>[a-z0-9_]+)\s*\.\s*)?(?<name>[a-z0-9_]+)/gi,
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?<schema>[a-z0-9_]+)\s*\.\s*)?(?<name>[a-z0-9_]+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of sql.matchAll(pattern)) {
      const schema = (match.groups?.schema ?? "public").toLowerCase();
      const name = match.groups?.name?.toLowerCase();
      if (!name) continue;
      const object = `${schema}.${name}`;
      const prior = objects.get(object);
      if (prior) throw new Error(`duplicate database object '${object}' in ${prior} and ${file}`);
      objects.set(object, file);
    }
  }
}

console.log(`Validated ${files.length} migrations and ${objects.size} schema objects.`);
