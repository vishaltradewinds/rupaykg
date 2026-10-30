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

  // Reject empty/ambiguous release catalogues before connecting to the database.
  assertMigrationCatalogConsistent(files);

  // Hold a PostgreSQL session-level advisory lock on the same connection used
  // for every preflight and migration statement. This serializes concurrent
  // migrators even across the per-migration transaction boundaries.
  const client = await pool.connect();
  const lockKeys = [1380270932, 1380270923] as const;
  let lockAcquired = false;
  let clientReleased = false;
  try {
    try {
      await client.query("select pg_advisory_lock($1, $2)", [...lockKeys]);
      lockAcquired = true;
    } catch (lockError) {
      // The server may have acquired the session lock before the response was
      // lost. Destroy this connection rather than return an uncertain session
      // to the pool.
      client.release(lockError instanceof Error ? lockError : new Error("Migration advisory-lock acquisition failed"));
      clientReleased = true;
      throw lockError;
    }

    // Inspect whether the ledger exists before any DDL. A conflicting existing
    // ledger must fail closed without even bootstrapping schema_migrations.
    const ledger = await client.query<{ ledger_exists: string | null }>(
      "select to_regclass('schema_migrations')::text as ledger_exists",
    );
    const applied = ledger.rows[0]?.ledger_exists
      ? await client.query<{ version: string; filename: string }>(
          "select version, filename from schema_migrations order by version",
        )
      : { rows: [] as { version: string; filename: string }[] };

    // For a fresh database this validates an empty history; for an existing one,
    // it reconciles the complete ledger. Both paths stop before DDL on conflict.
    assertMigrationHistoryConsistent(applied.rows, files);

    // Only bootstrap the ledger after catalogue/history preflight succeeds.
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        filename text not null,
        applied_at timestamptz not null default now()
      )
    `);

    for (const filename of files) {
      const version = filename.split("_", 1)[0];
      const existing = await client.query<{ version: string; filename: string }>(
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
        try {
          await client.query("rollback");
        } catch (rollbackError) {
          // A failed rollback leaves transaction/session state uncertain. Destroy
          // the connection so it cannot be reused by the pool; PostgreSQL releases
          // session advisory locks when the connection is closed.
          const connectionError = new Error(
            `Migration ${filename} failed and rollback also failed; destroying database connection`,
            { cause: rollbackError },
          );
          client.release(connectionError);
          clientReleased = true;
          lockAcquired = false;
          throw new AggregateError(
            [error, rollbackError],
            `Migration ${filename} failed and rollback failed`,
            { cause: error },
          );
        }
        throw new Error(`Migration ${filename} failed`, { cause: error });
      }
    }

    console.log(`Database migrations are current (${files.length} files).`);
  } finally {
    if (lockAcquired) {
      try {
        await client.query("select pg_advisory_unlock($1, $2)", [...lockKeys]);
      } catch (unlockError) {
        // A session-level lock may still be held if unlock fails. Destroy the
        // connection instead of returning a possibly locked session to the pool.
        client.release(unlockError instanceof Error ? unlockError : new Error("Failed to release migration advisory lock"));
        clientReleased = true;
        throw unlockError;
      }
    }
    if (!clientReleased) client.release();
  }
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
    let migrationDir: string | undefined;
    if (testMigrationDir) {
      migrationDir = path.resolve(testMigrationDir);
    } else {
      for (const candidate of candidates) {
        try {
          const entries = await readdir(candidate);
          if (entries.some((name) => /^\d+_.+\.sql$/.test(name))) {
            migrationDir = candidate;
            break;
          }
        } catch {
          // Try the next supported source/container layout.
        }
      }
    }
    if (!migrationDir || !existsSync(migrationDir)) {
      throw new Error(`MIGRATION_CATALOG_EMPTY: no numbered SQL migration directory found. Checked: ${[testMigrationDir, ...candidates].filter(Boolean).join(", ")}`);
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
