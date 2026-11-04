import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "pg";
import type { Pool as PoolType } from "pg";
import { migrationCatalogVersionConflicts, migrationHistoryConflicts } from "./migration-history.js";
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

  const catalogConflicts = migrationCatalogVersionConflicts(files);
  if (catalogConflicts.length) {
    throw new Error(
      `MIGRATION_HISTORY_UNRESOLVED: migration catalog contains conflicting version prefixes: ${catalogConflicts.join(", ")}`,
    );
  }

  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      filename text not null,
      applied_at timestamptz not null default now(),
      source_sha256 text,
      source_sha256_required boolean not null default false,
      constraint schema_migrations_source_sha256_required_check
        check (not source_sha256_required or source_sha256 is not null)
    )
  `);

  // Older ledgers may not have source_sha256. Detect this without mutating
  // their schema, then validate the complete filename/version history first.
  const columnCheck = await pool.query<{ source_sha256: boolean; source_sha256_required: boolean }>(
    "select " +
      "exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'schema_migrations' and column_name = 'source_sha256') as source_sha256, " +
      "exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'schema_migrations' and column_name = 'source_sha256_required') as source_sha256_required",
  );
  const hasChecksumColumn = columnCheck.rows[0]?.source_sha256 === true;
  const hasRequiredFlag = columnCheck.rows[0]?.source_sha256_required === true;
  const applied = hasChecksumColumn && hasRequiredFlag
    ? await pool.query<{ version: string; filename: string; source_sha256: string | null; source_sha256_required: boolean }>(
        "select version, filename, source_sha256, source_sha256_required from schema_migrations order by version",
      )
    : hasChecksumColumn
      ? await pool.query<{ version: string; filename: string; source_sha256: string | null; source_sha256_required?: false }>(
          "select version, filename, source_sha256 from schema_migrations order by version",
        )
      : await pool.query<{ version: string; filename: string; source_sha256?: null; source_sha256_required?: false }>(
          "select version, filename from schema_migrations order by version",
        );

  const conflicts = migrationHistoryConflicts(applied.rows, new Set(files));
  if (conflicts.length) {
    const detail = conflicts.map((row) => `${row.version}:${row.filename}:${row.reason}`).join(", ");
    throw new Error(`MIGRATION_HISTORY_UNRESOLVED: reconcile the applied migration ledger before applying SQL: ${detail}`);
  }

  // A trusted digest proves only that this release's SQL bytes match the bytes
  // recorded when that migration was applied. Legacy NULL digests remain
  // explicitly unattested; never backfill them from the current checkout.
  const digestConflicts: string[] = [];
  if (hasChecksumColumn) {
    for (const row of applied.rows) {
      if (!row.source_sha256) {
        if ("source_sha256_required" in row && row.source_sha256_required === true) {
          digestConflicts.push(`${row.version}:${row.filename}:REQUIRED_SOURCE_CHECKSUM_MISSING`);
        }
        continue;
      }
      const sqlBytes = await readFile(path.join(migrationDir, row.filename));
      const actual = createHash("sha256").update(sqlBytes).digest("hex");
      if (!/^[a-f0-9]{64}$/.test(row.source_sha256) || actual !== row.source_sha256) {
        digestConflicts.push(`${row.version}:${row.filename}:SOURCE_CHECKSUM_MISMATCH`);
      }
    }
  }
  if (digestConflicts.length) {
    throw new Error(`MIGRATION_HISTORY_UNRESOLVED: migration source checksum mismatch: ${digestConflicts.join(", ")}`);
  }

  // Only after complete ledger preflight succeeds may an existing legacy ledger
  // be extended. This is additive and deliberately does not attest old rows.
  if (!hasChecksumColumn) {
    await pool.query("alter table schema_migrations add column source_sha256 text");
  }
  if (!hasRequiredFlag) {
    await pool.query("alter table schema_migrations add column source_sha256_required boolean not null default false");
  }
  await pool.query(`
    do $checksum_constraint$
    begin
      if not exists (
        select 1 from pg_constraint
        where conname = 'schema_migrations_source_sha256_required_check'
          and conrelid = 'schema_migrations'::regclass
      ) then
        alter table schema_migrations
          add constraint schema_migrations_source_sha256_required_check
          check (not source_sha256_required or source_sha256 is not null);
      end if;
    end;
    $checksum_constraint$;
  `);
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

    const sqlBytes = await readFile(path.join(migrationDir, filename));
    const sql = sqlBytes.toString("utf8");
    const sourceSha256 = createHash("sha256").update(sqlBytes).digest("hex");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into schema_migrations(version, filename, source_sha256, source_sha256_required) values ($1, $2, $3, true)",
        [version, filename, sourceSha256],
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
