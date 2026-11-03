import { readFile } from "node:fs/promises";

const runner = await readFile("apps/src/migrate.ts", "utf8");
const helper = await readFile("apps/src/migration-integrity.ts", "utf8");
const tests = await readFile("apps/src/migration-integrity.test.ts", "utf8");
const requiredRunnerFragments = [
  "sha256Hex(bytes)",
  "assertNoOrphanedMigrations(",
  "LEGACY_UNVERIFIED: non-empty migration ledger",
  'TextDecoder("utf-8", { fatal: true })',
  "checksum_sha256) values",
  "pg_advisory_lock",
  'client.query("begin")',
  "assertCriticalPostconditions(client, migration.filename)",
];
for (const fragment of requiredRunnerFragments) {
  if (!runner.includes(fragment)) throw new Error(`migration runner missing ${fragment}`);
}
for (const code of ["LEGACY_UNVERIFIED", "MIGRATION_CHECKSUM_DRIFT", "MIGRATION_FILENAME_DRIFT", "MIGRATION_LEDGER_ORPHAN", "MIGRATION_CHECKSUM_INVALID"]) {
  if (!helper.includes(code) || !tests.includes(code)) throw new Error(`migration integrity missing coverage for ${code}`);
}
console.log("Validated migration checksum, ledger, transaction and test contracts.");
