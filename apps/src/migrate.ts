import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
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
  const prefixCounts = new Map<string, number>();
  for (const filename of files) {
    const prefix = filename.slice(0, filename.indexOf("_"));
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
  }
  const protectedMigrations = new Set([
    "097_shakti_tenant_isolation_runtime_contract.sql",
    "098_shakti_authentication_bootstrap.sql",
    "099_shakti_rls_policy_foundation.sql",
    "100_shakti_production_ddl_runtime_role_split.sql",
  ]);
  const allowProtected = process.env.RUPAYKG_ALLOW_PROTECTED_SHAKTI_MIGRATIONS === "1";
  const protectedApplied = await pool.query<{ filename: string }>("select filename from schema_migrations where filename = any($1::text[])", [[...protectedMigrations]]);
  const appliedProtected = new Set(protectedApplied.rows.map((row) => row.filename));
  const pendingProtected = files.filter((name) => protectedMigrations.has(name) && !appliedProtected.has(name));
  if (pendingProtected.length && !allowProtected) throw new Error(`Protected Shakti migrations require RUPAYKG_ALLOW_PROTECTED_SHAKTI_MIGRATIONS=1: ${pendingProtected.join(", ")}`);

  for (const filename of files) {
    const stem = filename.replace(/\.sql$/, "");
    const prefix = filename.slice(0, filename.indexOf("_"));
    const version = (prefixCounts.get(prefix) ?? 0) > 1 ? stem : prefix;
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
