export type AppliedMigrationSource = { version: string; filename: string };
export type MigrationHistoryConflict = AppliedMigrationSource & { reason: "SOURCE_MISSING" | "VERSION_FILENAME_MISMATCH" };

/** Canonical, pure migration-history contract shared by startup and the runner. */
export function findMigrationHistoryConflicts(
  records: readonly AppliedMigrationSource[],
  availableFilenames: readonly string[],
): MigrationHistoryConflict[] {
  const available = new Set(availableFilenames);
  const conflicts: MigrationHistoryConflict[] = [];
  for (const record of records) {
    if (!available.has(record.filename)) {
      conflicts.push({ ...record, reason: "SOURCE_MISSING" });
      continue;
    }
    const match = /^(\\d+)_.*\\.sql$/.exec(record.filename);
    if (!match || record.version !== match[1]) conflicts.push({ ...record, reason: "VERSION_FILENAME_MISMATCH" });
  }
  return conflicts;
}

/** Reject duplicate version prefixes before any migration file is applied. */
export function findMigrationCatalogVersionConflicts(availableFilenames: readonly string[]): string[] {
  const byVersion = new Map<string, string[]>();
  for (const filename of availableFilenames) {
    const match = /^(\\d+)_.*\\.sql$/.exec(filename);
    if (!match) continue;
    const entries = byVersion.get(match[1]) ?? [];
    entries.push(filename);
    byVersion.set(match[1], entries);
  }
  return [...byVersion.entries()]
    .filter(([, filenames]) => filenames.length > 1)
    .map(([version, filenames]) => `${version}:${filenames.sort().join("|")}`);
}

export function assertMigrationHistoryConsistent(
  records: readonly AppliedMigrationSource[],
  availableFilenames: readonly string[],
): void {
  const catalogConflicts = findMigrationCatalogVersionConflicts(availableFilenames);
  if (catalogConflicts.length) {
    throw new Error(`MIGRATION_HISTORY_UNRESOLVED: migration catalog contains conflicting version prefixes: ${catalogConflicts.join(", ")}`);
  }
  const conflicts = findMigrationHistoryConflicts(records, availableFilenames);
  if (conflicts.length) {
    const detail = conflicts.map(({ version, filename, reason }) => `${version}:${filename}:${reason}`).join(", ");
    throw new Error(`MIGRATION_HISTORY_UNRESOLVED: reconcile the applied migration ledger before applying SQL: ${detail}`);
  }
}
