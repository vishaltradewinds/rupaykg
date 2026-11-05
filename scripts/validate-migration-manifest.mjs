import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const manifestPath = process.env.MIGRATOR_MANIFEST_PATH;
if (!manifestPath) throw new Error("MIGRATOR_MANIFEST_PATH is required");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.migrations) || manifest.migrations.length === 0) throw new Error("Migration manifest must contain a non-empty migrations array");

const here = path.dirname(new URL(import.meta.url).pathname);
const candidates = [path.resolve(here, "../migrations"), path.resolve(here, "../../migrations")];
const migrationDir = candidates.find((candidate) => existsSync(candidate));
if (!migrationDir) throw new Error(`Migration directory not found. Checked: ${candidates.join(", ")}`);

const files = (await readdir(migrationDir)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
const expected = new Map();
const expectedVersions = new Set();
for (const entry of manifest.migrations) {
  if (!entry || typeof entry.filename !== "string" || typeof entry.sha256 !== "string") throw new Error("Invalid migration manifest entry");
  if (!/^\d+_.+\.sql$/.test(entry.filename)) throw new Error(`Invalid migration filename: ${entry.filename}`);
  if (!/^[a-f0-9]{64}$/i.test(entry.sha256)) throw new Error(`Invalid migration SHA-256: ${entry.filename}`);
  const version = entry.filename.split("_", 1)[0];
  if (expectedVersions.has(version)) throw new Error(`Duplicate manifest migration version: ${version}`);
  expectedVersions.add(version);
  if (expected.has(entry.filename)) throw new Error(`Duplicate manifest filename: ${entry.filename}`);
  expected.set(entry.filename, entry.sha256.toLowerCase());
}
if (files.length !== expected.size || files.some((name) => !expected.has(name))) throw new Error("Migration manifest does not exactly match the active SQL source inventory");
for (const filename of files) {
  const actual = createHash("sha256").update(await readFile(path.join(migrationDir, filename))).digest("hex");
  if (actual !== expected.get(filename)) throw new Error(`Migration checksum mismatch: ${filename}`);
}
console.log(`Migration source manifest: PASS (${files.length} files)`);
