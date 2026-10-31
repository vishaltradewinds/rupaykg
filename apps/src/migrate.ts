import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { findDuplicateCandidateVersions, findLegacyIdentityConflicts, findVersionFilenameConflicts, LEGACY_MIGRATION_IDENTITIES } from "./migration-identity.js";

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

  // Refuse malformed pre-existing ledgers before querying migration identities or running DDL.
  // CREATE TABLE IF NOT EXISTS does not repair an existing table with an incompatible shape.
  const ledgerColumns = await pool.query<{ column_name: string }>(
    `select column_name from information_schema.columns
     where table_schema = current_schema() and table_name = 'schema_migrations'`,
  );
  const availableLedgerColumns = new Set(ledgerColumns.rows.map((row) => row.column_name));
  const missingLedgerColumns = ["version", "filename"].filter((column) => !availableLedgerColumns.has(column));
  if (missingLedgerColumns.length > 0) {
    throw new Error(
      `MIGRATION_LEDGER_SCHEMA_INVALID: schema_migrations is missing required column(s): ${missingLedgerColumns.join(", ")}. No migrations were applied; inspect and recover the ledger manually.`,
    );
  }

  const ledgerDefinition = await pool.query<{ column_name: string; is_nullable: string }>(
    `select column_name, is_nullable from information_schema.columns
     where table_schema = current_schema() and table_name = 'schema_migrations'`,
  );
  const nullableByColumn = new Map(ledgerDefinition.rows.map((row) => [row.column_name, row.is_nullable]));
  const primaryKeyColumns = await pool.query<{ column_name: string }>(
    `select kcu.column_name
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu
       on tc.constraint_catalog = kcu.constraint_catalog
      and tc.constraint_schema = kcu.constraint_schema
      and tc.constraint_name = kcu.constraint_name
      and tc.table_schema = kcu.table_schema
      and tc.table_name = kcu.table_name
     where tc.table_schema = current_schema()
       and tc.table_name = 'schema_migrations'
       and tc.constraint_type = 'PRIMARY KEY'`,
  );
  const primaryKeyNames = primaryKeyColumns.rows.map((row) => row.column_name);
  const ledgerDefinitionProblems: string[] = [];
  if (nullableByColumn.get("version") !== "NO") ledgerDefinitionProblems.push("version must be NOT NULL");
  if (nullableByColumn.get("filename") !== "NO") ledgerDefinitionProblems.push("filename must be NOT NULL");
  if (primaryKeyNames.length !== 1 || primaryKeyNames[0] !== "version") {
    ledgerDefinitionProblems.push("version must be the sole PRIMARY KEY column");
  }
  if (ledgerDefinitionProblems.length > 0) {
    throw new Error(
      `MIGRATION_LEDGER_SCHEMA_INVALID: ${ledgerDefinitionProblems.join("; ")}. No migrations were applied; inspect and recover the ledger manually.`,
    );
  }

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

  // Reject duplicate version prefixes before any candidate migration DDL. Otherwise
  // the first file could be applied before a later same-version filename conflicts.
  const duplicateVersions = findDuplicateCandidateVersions(files);
  if (duplicateVersions.length > 0) {
    const details = duplicateVersions
      .map(({ version, filenames }) => `${version}: ${filenames.join(", ")}`)
      .join("; ");
    throw new Error(
      `MIGRATION_CANDIDATE_VERSION_DUPLICATE: candidate migration tree contains duplicate version prefix(es): ${details}. No migrations were applied.`,
    );
  }

  // Fail closed on known filename-identity changes. Never silently re-run
  // equivalent DDL against a database whose ledger records the old identity.
  // Query both sides of every known pair so reverse deployments fail closed too.
  const legacyNames = [...Object.keys(LEGACY_MIGRATION_IDENTITIES), ...Object.values(LEGACY_MIGRATION_IDENTITIES)];
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
