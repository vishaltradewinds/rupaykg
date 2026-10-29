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
