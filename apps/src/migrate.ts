import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { normalizePostgresConnectionString, readProductionConfig } from "./production-config.js";

const migrationLockKey = 7301202601;

// Production configuration must be validated before the migration runner can
// connect to or mutate any database. CI/local migration runs keep their own
// explicit DATABASE_URL/DATABASE_SSL contract.
if (process.env.NODE_ENV === "production") {
  const config = readProductionConfig();
  process.env.DATABASE_URL = config.databaseUrl;
  process.env.DATABASE_SSL = config.databaseSsl;
  process.env.DATABASE_CA_CERT = config.databaseCaCert;
  process.env.RUPAYKG_ALLOWED_ORIGINS = config.allowedOrigins.join(",");
  process.env.RUPAYKG_AUTH_MODE = config.authMode;
  process.env.RUPAYKG_SYNTHETIC_DATA = String(config.syntheticData);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({
  connectionString: normalizePostgresConnectionString(databaseUrl),
  max: 1,
  ssl: process.env.DATABASE_SSL === "false"
    ? undefined
    : {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_CA_CERT?.includes("BEGIN CERTIFICATE") ? { ca: process.env.DATABASE_CA_CERT } : {}),
      },
});

const client = await pool.connect();
let lockAcquired = false;
try {
  // A session-level advisory lock serializes startup migrations when more than
  // one application instance starts at the same time.
  await client.query("select pg_advisory_lock($1)", [migrationLockKey]);
  lockAcquired = true;

  await client.query(`
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
    .filter((name) => /^\\d+_.+\\.sql$/.test(name))
    .sort();

  for (const filename of files) {
    const version = filename.split("_", 1)[0];
    const existing = await client.query<{ version: string; filename: string }>(
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
    }
  }

  console.log(`Database migrations are current (${files.length} files).`);
} finally {
  try {
    if (lockAcquired) await client.query("select pg_advisory_unlock($1)", [migrationLockKey]);
  } finally {
    client.release();
    await pool.end();
  }
}
