import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "pg";
import type { Pool as PoolType } from "pg";
import { assertMigrationCatalogConsistent, assertMigrationHistoryConsistent } from "./migration-history.js";
import { readProductionConfig } from "./production-config.js";

/**
 * Apply migrations only after validating the complete applied-history ledger.
 * Missing source files and version/filename mismatches fail before pending SQL.
 */
export async function runMigrations(pool: PoolType, migrationDir: string): Promise<void> {
  if (!existsSync(migrationDir)) throw new Error(`Migration directory not found: ${migrationDir}`);
  const files = (await readdir(migrationDir))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();

  // Reject empty/ambiguous release catalogues before any database DDL.
  assertMigrationCatalogConsistent(files);

  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      filename text not null,
      applied_at timestamptz not null default now()
    )
  `);

  // Reconcile every recorded row before executing any pending migration SQL.
  const applied = await pool.query<{ version: string; filename: string }>(
    "select version, filename from schema_migrations order by version",
  );
  assertMigrationHistoryConsistent(applied.rows, files);

  for (const filename of files) {
    const version = filename.split("_", 1)[0];
    const existing = await pool.query<{ version: string; filename: string }>(
      "select version, filename from schema_migrations where version = $1",
      [version],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].filename !== filename) {
        // Defensive assertion; the complete-ledger preflight above should catch this.
        throw new Error(`MIGRATION_HISTORY_UNRESOLVED: migration version ${version} is recorded as ${existing.rows[0].filename}, not ${filename}`);
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

  const productionConfig = process.env.NODE_ENV === "production" ? readProductionConfig() : null;
  const pool = new Pool({
    connectionString: productionConfig?.databaseUrl ?? databaseUrl,
    max: 1,
    ...(productionConfig?.databaseSsl === "false" || (!productionConfig && process.env.DATABASE_SSL === "false")
      ? {}
      : {
          ssl: {
            // Production requires verified TLS; non-production retains the
            // existing developer/test behavior unless TLS is explicitly disabled.
            rejectUnauthorized: productionConfig !== null || process.env.DATABASE_SSL === "require",
            ...((productionConfig?.databaseCaCert || process.env.DATABASE_CA_CERT)
              ? { ca: productionConfig?.databaseCaCert || process.env.DATABASE_CA_CERT }
              : {}),
          },
        }),
  });

  try {
    // Support source execution (/repo/apps/src) and production container
    // execution (/app/apps/dist/src) without a runtime-selectable production catalog.
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];

    // Isolated acceptance tests may supply a disposable catalog only when the
    // explicit test flag is set. Never allow this override in production.
    const testMigrationDir = process.env.NODE_ENV !== "production" &&
      process.env.RUPAYKG_RUN_DUAL_LEDGER_TESTS === "1"
      ? process.env.RUPAYKG_TEST_MIGRATIONS_DIR
      : undefined;
    const migrationDir = testMigrationDir
      ? path.resolve(testMigrationDir)
      : candidates.find((candidate) => existsSync(candidate));
    if (!migrationDir || !existsSync(migrationDir)) {
      throw new Error(`Migration directory not found. Checked: ${[testMigrationDir, ...candidates].filter(Boolean).join(", ")}`);
    }

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
