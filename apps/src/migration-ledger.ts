import { assertMigrationHistoryConsistent, findMigrationHistoryConflicts, findMigrationCatalogVersionConflicts } from "./migration-history.js";
export type { AppliedMigrationSource as AppliedMigrationRecord } from "./migration-history.js";
import type { AppliedMigrationSource } from "./migration-history.js";

/** Compatibility wrapper: canonical semantics live in migration-history.ts. */
export function findOrphanedMigrationRecords(records: readonly AppliedMigrationSource[], availableFilenames: readonly string[]): AppliedMigrationSource[] {
  const available = new Set(availableFilenames);
  return records.filter((record) => !available.has(record.filename));
}

/** Compatibility wrapper: canonical semantics live in migration-history.ts. */
export function findMismatchedMigrationVersions(records: readonly AppliedMigrationSource[]): AppliedMigrationSource[] {
  return records.filter((record) => {
    const match = /^(\d+)_.*\.sql$/.exec(record.filename);
    return !match || record.version !== match[1];
  });
}

/** Compatibility wrapper; all checks delegate to the canonical contract. */
export function assertNoOrphanedMigrationRecords(records: readonly AppliedMigrationSource[], availableFilenames: readonly string[]): void {
  assertMigrationHistoryConsistent(records, availableFilenames);
}

export { findMigrationHistoryConflicts, findMigrationCatalogVersionConflicts };
