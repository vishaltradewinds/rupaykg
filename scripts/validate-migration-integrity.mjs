import { readFile } from "node:fs/promises";

const runner = await readFile("apps/src/migrate.ts", "utf8");
const helper = await readFile("apps/src/migration-integrity.ts", "utf8");
const tests = await readFile("apps/src/migration-integrity.test.ts", "utf8");
const checks = [
  [/sha256Hex\\(bytes\\)/, "exact-byte SHA-256"],
  [/assertNoOrphanedMigrations\\(/, "orphan-ledger detection"],
  [/LEGACY_UNVERIFIED: non-empty migration ledger/, "legacy-ledger fail-closed behavior"],
  [/TextDecoder\\("utf-8", \\{ fatal: true \\}\\)/, "strict UTF-8 validation"],
  [/checksum_sha256\\) values/, "checksum ledger insert"],
  [/pg_advisory_lock/, "serialized migration execution"],
  [/begin/, "transactional migration execution"],
  [/assertCriticalPostconditions\\(client, migration\\.filename\\)/, "catalog postconditions before ledger commit"],
];
for (const [pattern, label] of checks) if (!pattern.test(runner)) throw new Error(`migration runner missing ${label}`);
for (const code of ["LEGACY_UNVERIFIED", "MIGRATION_CHECKSUM_DRIFT", "MIGRATION_FILENAME_DRIFT", "MIGRATION_LEDGER_ORPHAN", "MIGRATION_CHECKSUM_INVALID"]) {
  if (!helper.includes(code) || !tests.includes(code)) throw new Error(`migration integrity missing coverage for ${code}`);
}
console.log("Validated migration checksum, ledger, transaction and test contracts.");
