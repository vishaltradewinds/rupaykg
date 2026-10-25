import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { readProductionConfig } from "./production-config.js";

// Validate the complete production contract before any database connection or DDL.
const productionConfig = process.env.NODE_ENV === "production" ? readProductionConfig() : null;
const databaseUrl = productionConfig?.migrationDatabaseUrl ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const databaseSsl = productionConfig?.databaseSsl ?? process.env.DATABASE_SSL;
const databaseCaCert = productionConfig?.databaseCaCert ?? process.env.DATABASE_CA_CERT?.trim() ?? "";
const ssl = databaseSsl === "false"
  ? false
  : { rejectUnauthorized: true, ...(databaseCaCert ? { ca: databaseCaCert } : {}) };

const pool = new Pool({ connectionString: databaseUrl, max: 1, ssl });

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

  // Preflight the entire inventory before applying any migration. Without this,
  // a mismatch late in the sorted list can be discovered only after earlier
  // migrations have already committed, leaving the deployment partially advanced.
  const appliedResult = await pool.query<{ version: string; filename: string }>(
    "select version, filename from schema_migrations",
  );
  const applied = new Map(appliedResult.rows.map((row) => [row.version, row.filename]));
  const conflicts = files.flatMap((filename) => {
    const version = filename.split("_", 1)[0]!;
    const recorded = applied.get(version);
    return recorded && recorded !== filename
      ? [{ version, recorded, expected: filename }]
      : [];
  });
  if (conflicts.length > 0) {
    const details = conflicts
      .map(({ version, recorded, expected }) => `${version}: recorded ${recorded}; repository has ${expected}`)
      .join("; ");
    throw new Error(`Migration inventory preflight failed before applying migrations: ${details}`);
  }

  for (const filename of files) {
    const version = filename.split("_", 1)[0]!;
    if (applied.has(version)) continue;

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
