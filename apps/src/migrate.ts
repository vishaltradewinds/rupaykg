import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { findLegacyIdentityConflicts, findVersionFilenameConflicts, LEGACY_MIGRATION_IDENTITIES } from "./migration-identity.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
});

try {
  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      filename text not null,
      applied_at timestamptz not null default now()
    )
  `);

  // Support both CI/source execution (/repo/apps/src) and the production
  // container (/app/apps/dist/src). Never assume a single filesystem root.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];
  // A temporary migration directory is permitted only for explicitly enabled
  // integration tests. Production runs always use the repository/container tree.
  const testMigrationDir =
    process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && process.env.NODE_ENV === "test"
      ? process.env.RUPAYKG_TEST_MIGRATION_DIR
      : undefined;
  const migrationDir = testMigrationDir ?? candidates.find((candidate) => existsSync(candidate));
  if (!migrationDir) throw new Error(`Migration directory not found. Checked: ${candidates.join(", ")}`);
  const files = (await readdir(migrationDir))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();

  // Fail closed on known filename-identity changes. Never silently re-run
  // equivalent DDL against a database whose ledger records the old identity.
  const legacyNames = Object.values(LEGACY_MIGRATION_IDENTITIES);
  const legacyRows = legacyNames.length
    ? await pool.query<{ filename: string }>(
        "select filename from schema_migrations where filename = any($1::text[])",
        [legacyNames],
      )
    : { rows: [] as Array<{ filename: string }> };
  const identityConflicts = findLegacyIdentityConflicts(
    files,
    legacyRows.rows.map((row) => row.filename),
  );
  if (identityConflicts.length > 0) {
    const details = identityConflicts
      .map(({ candidate, recordedLegacy }) => `${recordedLegacy} -> ${candidate}`)
      .join("; ");
    throw new Error(
      `MIGRATION_IDENTITY_CONFLICT: database ledger contains historical migration filename(s) replaced by this migration tree: ${details}. No migrations were applied. Require reviewed, environment-specific reconciliation before proceeding.`,
    );
  }

  // Preflight all existing version/filename identities before applying any migration.
  // This prevents a late collision from being discovered only after earlier DDL ran.
  const recordedRows = await pool.query<{ version: string; filename: string }>(
    "select version, filename from schema_migrations",
  );
  const versionConflicts = findVersionFilenameConflicts(files, recordedRows.rows);
  if (versionConflicts.length > 0) {
    const details = versionConflicts
      .map(({ version, recorded, candidate }) => `${version}: ledger=${recorded}, candidate=${candidate}`)
      .join("; ");
    throw new Error(
      `MIGRATION_VERSION_CONFLICT: existing migration version/filename identity differs from this migration tree: ${details}. No migrations were applied.`,
    );
  }

  for (const filename of files) {
    const version = filename.split("_", 1)[0];
    const existing = await pool.query<{ version: string; filename: string }>(
      "select version, filename from schema_migrations where version = $1",
      [version],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].filename !== filename) {
        throw new Error(`Migration version ${version} is already recorded as ${existing.rows[0].filename}, not ${filename}`);
      }
      continue;
    }

    const sql = await readFile(path.join(migrationDir, filename), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into schema_migrations(version, filename) values ($1, $2)",
        [version, filename],
      );
      await client.query("commit");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`Migration ${filename} failed`, { cause: error });
    } finally {
      client.release();
    }
  }

  console.log(`Database migrations are current (${files.length} files).`);
} finally {
  await pool.end();
}
