export type AppliedMigrationRecord = { version: string; filename: string };

export type MigrationHistoryConflict = {
  version: string;
  filename: string;
  reason: "SOURCE_MISSING" | "VERSION_FILENAME_MISMATCH";
};

/** Pure canonical migration-history checks. This module performs no I/O. */
export function findMigrationHistoryConflicts(
  records: readonly AppliedMigrationRecord[],
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
    if (!match || record.version !== match[1]) {
      conflicts.push({ ...record, reason: "VERSION_FILENAME_MISMATCH" });
    }
  }
  return conflicts;
}

/** A release must never contain two files claiming the same numeric version. */
export function findMigrationCatalogVersionConflicts(availableFilenames: readonly string[]): string[] {
  const byVersion = new Map<string, string[]>();
  for (const filename of availableFilenames) {
    const match = /^(\\d+)_.*\\.sql$/.exec(filename);
    if (!match) continue;
    const files = byVersion.get(match[1]) ?? [];
    files.push(filename);
    byVersion.set(match[1], files);
  }
  return [...byVersion.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([version, files]) => `${version}:${files.sort().join("|")}`);
}

/** Fail closed on every history/catalogue conflict before any migration SQL. */
export function assertMigrationHistoryConsistent(
  records: readonly AppliedMigrationRecord[],
  availableFilenames: readonly string[],
): void {
  const catalogConflicts = findMigrationCatalogVersionConflicts(availableFilenames);
  if (catalogConflicts.length) {
    throw new Error(
      `MIGRATION_HISTORY_UNRESOLVED: migration catalog contains conflicting version prefixes: ${catalogConflicts.join(", ")}`,
    );
  }
  const conflicts = findMigrationHistoryConflicts(records, availableFilenames);
  if (conflicts.length) {
    const detail = conflicts.map(({ version, filename, reason }) => `${version}:${filename}:${reason}`).join(", ");
    throw new Error(
      `MIGRATION_HISTORY_UNRESOLVED: reconcile the applied migration ledger before applying SQL: ${detail}`,
    );
  }
}

/** @deprecated Compatibility wrapper; new callers should use the canonical contract. */
export function findOrphanedMigrationRecords(
  records: readonly AppliedMigrationRecord[],
  availableFilenames: readonly string[],
): AppliedMigrationRecord[] {
  const available = new Set(availableFilenames);
  return records.filter((record) => !available.has(record.filename));
}

/** @deprecated Compatibility wrapper; new callers should use the canonical contract. */
export function findMismatchedMigrationVersions(
  records: readonly AppliedMigrationRecord[],
): AppliedMigrationRecord[] {
  return records.filter((record) => {
    const match = /^(\\d+)_.*\\.sql$/.exec(record.filename);
    return !match || record.version !== match[1];
  });
}

/** @deprecated Compatibility wrapper; new callers should use the canonical contract. */
export function assertNoOrphanedMigrationRecords(
  records: readonly AppliedMigrationRecord[],
  availableFilenames: readonly string[],
): void {
  assertMigrationHistoryConsistent(records, availableFilenames);
}
