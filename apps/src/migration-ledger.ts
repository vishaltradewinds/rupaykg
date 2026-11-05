export type AppliedMigrationRecord = { version: string; filename: string };

/**
 * Refuse to apply new migrations when the ledger references a migration file
 * absent from the current release. This commonly indicates a renamed or
 * removed migration and requires an explicit, reviewed reconciliation.
 */
export function findOrphanedMigrationRecords(
  records: readonly AppliedMigrationRecord[],
  availableFilenames: readonly string[],
): AppliedMigrationRecord[] {
  const available = new Set(availableFilenames);
  return records.filter((record) => !available.has(record.filename));
}

export function assertNoOrphanedMigrationRecords(
  records: readonly AppliedMigrationRecord[],
  availableFilenames: readonly string[],
): void {
  const orphaned = findOrphanedMigrationRecords(records, availableFilenames);
  if (orphaned.length === 0) return;
  const details = orphaned
    .map(({ version, filename }) => `${version} (${filename})`)
    .join(", ");
  throw new Error(
    `Migration ledger references files absent from this release: ${details}. ` +
    "Stop before applying migrations and complete a reviewed migration-history reconciliation.",
  );
}
