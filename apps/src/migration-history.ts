export type AppliedMigrationSource = {
  version: string;
  filename: string;
};

/** Return ledger entries whose exact source file is absent from this release. */
export function missingMigrationSources(
  applied: readonly AppliedMigrationSource[],
  availableFiles: ReadonlySet<string>,
): AppliedMigrationSource[] {
  return applied.filter((row) => !availableFiles.has(row.filename));
}

/**
 * Validate every applied ledger row before executing any new migration SQL.
 * A present filename with a different version prefix is still a history conflict.
 */
export function migrationHistoryConflicts(
  applied: readonly AppliedMigrationSource[],
  availableFiles: ReadonlySet<string>,
): Array<AppliedMigrationSource & { reason: "SOURCE_MISSING" | "VERSION_FILENAME_MISMATCH" }> {
  return applied.flatMap((row) => {
    if (!availableFiles.has(row.filename)) return [{ ...row, reason: "SOURCE_MISSING" as const }];
    const filenameVersion = row.filename.split("_", 1)[0];
    if (filenameVersion !== row.version) return [{ ...row, reason: "VERSION_FILENAME_MISMATCH" as const }];
    return [];
  });
}
