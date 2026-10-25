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
  // Resolve and validate the complete local migration inventory before any DDL.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];
  const migrationDir = candidates.find((candidate) => existsSync(candidate));
  if (!migrationDir) throw new Error(`Migration directory not found. Checked: ${candidates.join(", ")}`);

  const files = (await readdir(migrationDir))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  const expected = new Map<string, string>();
  for (const filename of files) {
    const version = filename.split("_", 1)[0]!;
    const previous = expected.get(version);
    if (previous) throw new Error(`Duplicate migration version ${version}: ${previous} and ${filename}`);
    expected.set(version, filename);
  }

  // Read-only full-ledger preflight. Any unexplained history stops the run before DDL.
  const ledgerExists = await pool.query<{ ledger: string | null }>(
    "select to_regclass('public.schema_migrations')::text as ledger",
  );
  const applied = new Map<string, string>();
  if (ledgerExists.rows[0]?.ledger) {
    const ledger = await pool.query<{ version: string; filename: string }>(
      "select version, filename from public.schema_migrations order by version",
    );
    for (const row of ledger.rows) applied.set(row.version, row.filename);

    const mismatched = ledger.rows.filter((row) => expected.has(row.version) && expected.get(row.version) !== row.filename);
    const unexpected = ledger.rows.filter((row) => !expected.has(row.version));
    if (mismatched.length || unexpected.length) {
      const details = [
        ...mismatched.map((row) => `version ${row.version}: ledger=${row.filename}, repository=${expected.get(row.version)}`),
        ...unexpected.map((row) => `version ${row.version}: ledger filename ${row.filename} has no matching migration file`),
      ];
      throw new Error("Migration preflight failed; no schema changes were made. Reconcile authoritative history first:\n" + details.join("\n"));
    }
  } else {
    await pool.query(`
      create table public.schema_migrations (
        version text primary key,
        filename text not null,
        applied_at timestamptz not null default now()
      )
    `);
  }

  // The preflight passed; apply only migrations absent from the ledger.
  for (const filename of files) {
    const version = filename.split("_", 1)[0]!;
    if (applied.has(version)) continue;

    const sql = await readFile(path.join(migrationDir, filename), "utf8");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations(version, filename) values ($1, $2)",
        [version, filename],
      );
      await client.query("commit");
      applied.set(version, filename);
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
