import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { assertMigrationCatalogConsistent, assertMigrationHistoryConsistent } from "./migration-history.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

// Validate the release catalogue before opening a database connection or issuing DDL.
const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];
let migrationDir: string | undefined;
let files: string[] = [];
for (const candidate of candidates) {
  try {
    const entries = await readdir(candidate);
    const sqlFiles = entries.filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    if (sqlFiles.length > 0) {
      migrationDir = candidate;
      files = sqlFiles;
      break;
    }
  } catch {
    // Try the next supported source/container layout.
  }
}
if (!migrationDir || files.length === 0) {
  throw new Error("MIGRATION_CATALOG_EMPTY: no numbered SQL migrations found. Checked: " + candidates.join(", "));
}
assertMigrationCatalogConsistent(files);

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
});

try {
  await pool.query(
    "create table if not exists schema_migrations (" +
    "version text primary key, filename text not null, applied_at timestamptz not null default now())"
  );

  const recorded = await pool.query<{ version: string; filename: string }>(
    "select version, filename from schema_migrations order by version",
  );
  assertMigrationHistoryConsistent(recorded.rows, files);

  for (const filename of files) {
    const version = filename.split("_", 1)[0];
    const existing = await pool.query<{ version: string; filename: string }>(
      "select version, filename from schema_migrations where version = $1",
      [version],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].filename !== filename) {
        throw new Error("Migration version " + version + " is already recorded as " + existing.rows[0].filename + ", not " + filename);
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
      console.log("Applied " + filename);
    } catch (error) {
      await client.query("rollback");
      throw new Error("Migration " + filename + " failed", { cause: error });
    } finally {
      client.release();
    }
  }

  console.log("Database migrations are current (" + files.length + " files).");
} finally {
  await pool.end();
}
