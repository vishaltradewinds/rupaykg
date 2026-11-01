import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { assertProductionMigrationTarget } from "./production-config.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const ssl =
  process.env.DATABASE_SSL === "false"
    ? undefined
    : process.env.DATABASE_SSL === "require"
      ? {
          rejectUnauthorized: true,
          ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT } : {}),
        }
      : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString: databaseUrl,
  // One connection holds the advisory lock while a second executes migration SQL.
  max: 2,
  ssl,
});

const lockClient = await pool.connect();
let migrationLockAcquired = false;

try {
  const lock = await lockClient.query<{ locked: boolean }>(
    "select pg_try_advisory_lock(20261101, 1) as locked",
  );
  migrationLockAcquired = lock.rows[0]?.locked === true;
  if (!migrationLockAcquired) {
    throw new Error("Another RupayKg migration run is already active; refusing concurrent execution");
  }

  if (process.env.NODE_ENV === "production") {
    const expectedBranchId = process.env.RUPAYKG_EXPECTED_NEON_BRANCH_ID?.trim() ?? "";
    const expectedDatabaseName = process.env.RUPAYKG_EXPECTED_DATABASE_NAME?.trim() ?? "";
    const expectedRoleName = process.env.RUPAYKG_EXPECTED_DATABASE_ROLE?.trim() ?? "";
    const identity = await lockClient.query<{
      branch_id: string | null;
      database_name: string;
      role_name: string;
    }>(`select current_setting('neon.branch_id', true) as branch_id,
              current_database() as database_name,
              current_user as role_name`);
    const connected = identity.rows[0];
    if (!connected) throw new Error("PRODUCTION_MIGRATION_TARGET_MISMATCH: database identity could not be read");
    assertProductionMigrationTarget(
      { expectedBranchId, expectedDatabaseName, expectedRoleName },
      {
        branchId: connected.branch_id,
        databaseName: connected.database_name,
        roleName: connected.role_name,
      },
    );
    console.log("Verified exact production migration target identity.");
  }

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
  const migrationDir = candidates.find((candidate) => existsSync(candidate));
  if (!migrationDir) throw new Error(`Migration directory not found. Checked: ${candidates.join(", ")}`);
  const files = (await readdir(migrationDir))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();

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
  if (migrationLockAcquired) {
    try {
      await lockClient.query("select pg_advisory_unlock(20261101, 1)");
    } finally {
      lockClient.release();
    }
  } else {
    lockClient.release();
  }
  await pool.end();
}
