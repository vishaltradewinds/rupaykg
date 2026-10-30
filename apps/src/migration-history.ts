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
  const conflicts: Array<AppliedMigrationSource & { reason: "SOURCE_MISSING" | "VERSION_FILENAME_MISMATCH" }> = [];
  for (const row of applied) {
    if (!availableFiles.has(row.filename)) {
      conflicts.push({ ...row, reason: "SOURCE_MISSING" });
      continue;
    }
    const filenameVersion = row.filename.split("_", 1)[0];
    if (filenameVersion !== row.version) conflicts.push({ ...row, reason: "VERSION_FILENAME_MISMATCH" });
  }
  return conflicts;
}

/**
 * Reject release catalogs that contain multiple SQL files for the same numeric
 * version. Otherwise the runner could apply one file before discovering the
 * conflicting filename for that version later in the loop.
 */
export function migrationCatalogVersionConflicts(availableFiles: readonly string[]): string[] {
  const filenamesByVersion = new Map<string, string[]>();
  for (const filename of availableFiles) {
    const version = filename.split("_", 1)[0];
    const filenames = filenamesByVersion.get(version) ?? [];
    filenames.push(filename);
    filenamesByVersion.set(version, filenames);
  }
  return [...filenamesByVersion.entries()]
    .filter(([, filenames]) => filenames.length > 1)
    .map(([version, filenames]) => `${version}:${filenames.sort().join("|")}`);
}
