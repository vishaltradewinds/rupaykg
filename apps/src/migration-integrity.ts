import { createHash } from "node:crypto";

export type MigrationLedgerRow = {
  version: string;
  filename: string;
  checksum_sha256: string | null;
};

export type MigrationManifestEntry = {
  version: string;
  filename: string;
  checksum: string;
};

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function classifyRecordedMigration(
  row: MigrationLedgerRow,
  source: MigrationManifestEntry | undefined,
): "VERIFIED" {
  if (!source) throw new Error(`MIGRATION_LEDGER_ORPHAN: ${row.version}`);
  if (row.filename !== source.filename) throw new Error(`MIGRATION_FILENAME_DRIFT: ${row.version}`);
  if (row.checksum_sha256 === null) throw new Error(`LEGACY_UNVERIFIED: ${row.version}`);
  if (!/^[a-f0-9]{64}$/.test(row.checksum_sha256)) throw new Error(`MIGRATION_CHECKSUM_INVALID: ${row.version}`);
  if (row.checksum_sha256 !== source.checksum) throw new Error(`MIGRATION_CHECKSUM_DRIFT: ${row.version}`);
  return "VERIFIED";
}

export function assertNoOrphanedMigrations(
  rows: MigrationLedgerRow[],
  manifest: Map<string, MigrationManifestEntry>,
): void {
  for (const row of rows) classifyRecordedMigration(row, manifest.get(row.version));
}
