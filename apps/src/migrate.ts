import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "pg";
import type { Pool as PoolType } from "pg";
import { migrationHistoryConflicts } from "./migration-history.js";

export async function runMigrations(pool: PoolType, migrationDir: string): Promise<void> {
  if (!existsSync(migrationDir)) throw new Error(`Migration directory not found: ${migrationDir}`);
  const files = (await readdir(migrationDir))
    .filter((name) => /^\\d+_.+\\.sql$/.test(name))
    .sort();

  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      filename text not null,
      applied_at timestamptz not null default now()
    )
  `);

  // Reconcile every applied ledger row before running any migration-file SQL.
  // Missing sources and version/filename mismatches must fail before the loop.
  const applied = await pool.query<{ version: string; filename: string }>(
    "select version, filename from schema_migrations order by version",
  );
  const historyConflicts = migrationHistoryConflicts(applied.rows, new Set(files));
  if (historyConflicts.length) {
    const detail = historyConflicts.map((row) => `${row.version}:${row.filename}:${row.reason}`).join(", ");
    throw new Error(`MIGRATION_HISTORY_UNRESOLVED: reconcile the applied migration ledger before applying SQL: ${detail}`);
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
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });

  try {
    // Support source execution (/repo/apps/src) and production container
    // execution (/app/apps/dist/src) without runtime-selectable catalog overrides.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];
    const migrationDir = candidates.find((candidate) => existsSync(candidate));
    if (!migrationDir) throw new Error(`Migration directory not found. Checked: ${candidates.join(", ")}`);
    await runMigrations(pool, migrationDir);
  } finally {
    await pool.end();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
