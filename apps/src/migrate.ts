import { readdir, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const caPath = process.env.DATABASE_SSL_CA_CERT;
const ssl =
  process.env.DATABASE_SSL === "false"
    ? undefined
    : process.env.DATABASE_SSL_STRICT === "true"
      ? { rejectUnauthorized: true, ...(caPath ? { ca: readFileSync(caPath, "utf8") } : {}) }
      : { rejectUnauthorized: false };

if (process.env.DATABASE_SSL_STRICT === "true" && !caPath) {
  throw new Error("DATABASE_SSL_CA_CERT is required when DATABASE_SSL_STRICT=true");
}

const pool = new Pool({ connectionString: databaseUrl, max: 1, ssl });

try {
  const identity = await pool.query<{ database_name: string; current_user: string; session_user: string }>(`
    select current_database() as database_name, current_user, session_user
  `);
  const row = identity.rows[0];
  if (!row) throw new Error("Database identity query returned no row");

  const expectedDatabase = process.env.MIGRATOR_EXPECTED_DATABASE;
  const expectedUser = process.env.MIGRATOR_EXPECTED_USER;
  if (expectedDatabase && row.database_name !== expectedDatabase) {
    throw new Error(`Protected migrator target database mismatch: expected ${expectedDatabase}`);
  }
  if (expectedUser && (row.current_user !== expectedUser || row.session_user !== expectedUser)) {
    throw new Error("Protected migrator target role mismatch");
  }
  if (process.env.MIGRATOR_MODE === "true") {
    console.log(`Protected migrator target verified: database=${row.database_name}, user=${row.current_user}`);
  }

  await pool.query("select pg_advisory_lock(hashtext('rupaykg:protected:migrations'))");

  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      filename text not null,
      applied_at timestamptz not null default now()
    )
  `);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];
  const migrationDir = candidates.find((candidate) => existsSync(candidate));
  if (!migrationDir) throw new Error(`Migration directory not found. Checked: ${candidates.join(", ")}`);
  const files = (await readdir(migrationDir)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();

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
      await client.query("insert into schema_migrations(version, filename) values ($1, $2)", [version, filename]);
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
  await pool.query("select pg_advisory_unlock(hashtext('rupaykg:protected:migrations'))").catch(() => {});
  await pool.end();
}
