import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "docs/engineering/PRODUCTION_MIGRATION_LEDGER_MANIFEST_2026-10-31.json");
const migrationDir = path.join(root, "migrations");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sourceFiles = (await readdir(migrationDir)).filter((name) => /^\\d+_.+\\.sql$/.test(name)).sort();
const rows = manifest.rows;
const exceptions = manifest.source_exceptions ?? [];
const fail = (message) => { console.error(`MIGRATION_LEDGER_PARITY_FAILED: ${message}`); process.exitCode = 1; };

if (!Array.isArray(rows) || manifest.row_count !== rows.length) fail("manifest row count does not match rows");
const versions = new Set();
const filenames = new Set();
for (const row of rows) {
  if (versions.has(row.version)) fail(`duplicate ledger version ${row.version}`);
  if (filenames.has(row.filename)) fail(`duplicate ledger filename ${row.filename}`);
  versions.add(row.version); filenames.add(row.filename);
}
const exceptionByFilename = new Map(exceptions.map((entry) => [entry.filename, entry]));
for (const exception of exceptions) {
  if (!filenames.has(exception.filename)) fail(`source exception is not present in captured ledger: ${exception.filename}`);
}
const expectedSources = rows.map((row) => row.filename).filter((filename) => !exceptionByFilename.has(filename)).sort();
const missingSources = expectedSources.filter((filename) => !sourceFiles.includes(filename));
const unexpectedSources = sourceFiles.filter((filename) => !expectedSources.includes(filename));
if (missingSources.length) fail(`ledger entries missing from repository: ${missingSources.join(", ")}`);
if (unexpectedSources.length) fail(`repository migrations absent from captured ledger: ${unexpectedSources.join(", ")}`);
if (process.exitCode) process.exit(1);
console.log(`Migration ledger parity verified: ${rows.length} captured production rows, ${sourceFiles.length} repository sources, ${exceptions.length} documented historical source exception(s).`);
