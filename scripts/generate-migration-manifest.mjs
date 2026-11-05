import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationDir = path.resolve(here, "../migrations");
const output = process.argv[2] || path.resolve(here, "../artifacts/migration-manifest.json");

const files = (await readdir(migrationDir))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();

const migrations = [];
for (const filename of files) {
  const sha256 = createHash("sha256")
    .update(await readFile(path.join(migrationDir, filename)))
    .digest("hex");
  migrations.push({ filename, sha256 });
}

const manifest = {
  schema: "rupaykg.migration-manifest.v1",
  generated_from: "active migration source inventory",
  migrations,
};

await writeFile(output, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Migration manifest generated: ${output} (${files.length} files)`);
