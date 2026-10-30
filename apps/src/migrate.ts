import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { assertMigrationHistoryConsistent } from "./migration-ledger.js";
import { readProductionConfig } from "./production-config.js";

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
          rejectUnauthorized: productionConfig !== null || process.env.DATABASE_SSL === "require",
          ...((productionConfig?.databaseCaCert || process.env.DATABASE_CA_CERT)
            ? { ca: productionConfig?.databaseCaCert || process.env.DATABASE_CA_CERT }
            : {}),
        },
      }),
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
  // Test-only override is gated by the acceptance-test flag.
  const testMigrationDir = process.env.RUPAYKG_RUN_DUAL_LEDGER_TESTS === "1"
    ? process.env.RUPAYKG_TEST_MIGRATIONS_DIR
    : undefined;
  const migrationDir = testMigrationDir
    ? path.resolve(testMigrationDir)
    : candidates.find((candidate) => existsSync(candidate));
  if (!migrationDir || !existsSync(migrationDir)) throw new Error(`Migration directory not found. Checked: ${[testMigrationDir, ...candidates].filter(Boolean).join(", ")}`);
  const files = (await readdir(migrationDir))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();

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
