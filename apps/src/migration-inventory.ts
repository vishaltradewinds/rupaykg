export type AppliedMigrationIdentity = { version: string; filename: string };
export type MigrationFilenameConflict = { version: string; recorded: string; expected: string };

/**
 * Return every migration-version collision before the runner applies any SQL.
 * A migration version is immutable: a new migration must use a new version.
 */
export function findMigrationFilenameConflicts(
  filenames: string[],
  appliedRows: AppliedMigrationIdentity[],
): MigrationFilenameConflict[] {
  const applied = new Map(appliedRows.map((row) => [row.version, row.filename]));
  return filenames.flatMap((filename) => {
    const version = filename.split("_", 1)[0]!;
    const recorded = applied.get(version);
    return recorded && recorded !== filename
      ? [{ version, recorded, expected: filename }]
      : [];
  });
}
