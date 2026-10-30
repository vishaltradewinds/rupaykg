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

/**
 * A ledger version must exactly match the numeric prefix of its recorded
 * filename. A mismatch can otherwise make the runner re-apply a migration
 * whose source file is present but recorded under the wrong version.
 */
export function findMismatchedMigrationVersions(
  records: readonly AppliedMigrationRecord[],
): AppliedMigrationRecord[] {
  return records.filter((record) => {
    const match = /^(\d+)_.*\.sql$/.exec(record.filename);
    return !match || record.version !== match[1];
  });
}

export function assertNoOrphanedMigrationRecords(
  records: readonly AppliedMigrationRecord[],
  availableFilenames: readonly string[],
): void {
  const orphaned = findOrphanedMigrationRecords(records, availableFilenames);
  if (orphaned.length > 0) {
    const details = orphaned
      .map(({ version, filename }) => `${version} (${filename})`)
      .join(", ");
    throw new Error(
      `Migration ledger references files absent from this release: ${details}. ` +
      "Stop before applying migrations and complete a reviewed migration-history reconciliation.",
    );
  }

  const mismatched = findMismatchedMigrationVersions(records);
  if (mismatched.length > 0) {
    const details = mismatched
      .map(({ version, filename }) => `${version} records ${filename} (expected version ${/^(\d+)_/.exec(filename)?.[1] ?? "a numeric filename prefix"})`)
      .join(", ");
    throw new Error(
      `Migration ledger version/filename prefix mismatch: ${details}. ` +
      "Stop before applying migrations and complete a reviewed migration-history reconciliation.",
    );
  }
}
