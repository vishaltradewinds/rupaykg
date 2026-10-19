import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { readProductionConfig } from "./production-config.js";

// In production, validate the entire runtime contract before the first database
// connection or schema mutation. The API server and migration runner must share
// the same database target and certificate-verification policy.
const productionConfig = process.env.NODE_ENV === "production" ? readProductionConfig() : null;
const databaseUrl = productionConfig?.databaseUrl ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const ssl = productionConfig
  ? productionConfig.databaseSsl === "false"
    ? undefined
    : {
        rejectUnauthorized: true,
        ...(productionConfig.databaseCaCert ? { ca: productionConfig.databaseCaCert } : {}),
      }
  : process.env.DATABASE_SSL === "false"
    ? undefined
    : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ...(ssl ? { ssl } : {}),
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
  await pool.end();
}
