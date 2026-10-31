import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { selectMigrationFilenames, type MigrationPhase } from "./migration-order.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : {
    rejectUnauthorized: true,
    ...(process.env.DATABASE_CA_CERT?.trim() ? { ca: process.env.DATABASE_CA_CERT.trim() } : {}),
  },
});

try {
  const phase = (process.env.RUPAYKG_MIGRATION_PHASE ?? "all") as MigrationPhase;
  if (process.env.NODE_ENV === "production") {
    if (process.env.RUPAYKG_ALLOW_PRODUCTION_MIGRATIONS !== "true"
      || process.env.RUPAYKG_PRODUCTION_MIGRATION_APPROVED !== "true"
      || !process.env.RUPAYKG_PRODUCTION_CHANGE_ID?.trim()
      || !process.env.RUPAYKG_PRODUCTION_BACKUP_REFERENCE?.trim()
      || phase !== "production-upgrade") {
      throw new Error("PRODUCTION_MIGRATION_BLOCKED: require explicit approval, change ID, backup reference and production-upgrade phase");
    }
    const ledgerExists = await pool.query<{ present: boolean }>(
      "select to_regclass('public.schema_migrations') is not null as present",
    );
    if (!ledgerExists.rows[0]?.present) {
      throw new Error("PRODUCTION_MIGRATION_BLOCKED: schema_migrations is absent; baseline must be reconciled manually");
    }
    const manifestCandidates = [
      path.resolve(process.cwd(), "docs/engineering/PRODUCTION_MIGRATION_LEDGER_MANIFEST_2026-10-31.json"),
      path.resolve(process.cwd(), "../docs/engineering/PRODUCTION_MIGRATION_LEDGER_MANIFEST_2026-10-31.json"),
      path.resolve(process.cwd(), "docs/PRODUCTION_MIGRATION_LEDGER_MANIFEST_2026-10-31.json"),
    ];
    let manifestText: string | null = null;
    for (const candidate of manifestCandidates) {
      try { manifestText = await readFile(candidate, "utf8"); break; } catch { /* try next known runtime location */ }
    }
    if (!manifestText) throw new Error("PRODUCTION_MIGRATION_BLOCKED: captured production ledger manifest is missing");
    const manifest = JSON.parse(manifestText) as {
      count: number;
      production_migration_order: Array<{ version: string; filename: string }>;
    };
    const liveLedger = await pool.query<{ version: string; filename: string }>(
      "select version,filename from schema_migrations order by applied_at,version",
    );
    const expected = manifest.production_migration_order.map(({ version, filename }) => ({ version, filename }));
    if (manifest.count !== 92 || expected.length !== 92
      || JSON.stringify(liveLedger.rows) !== JSON.stringify(expected)) {
      throw new Error("PRODUCTION_MIGRATION_BLOCKED: live ledger does not exactly match the captured 92-row production baseline; reconcile manually");
    }
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
  const allFiles = (await readdir(migrationDir)).filter((name) => /^\d+_.+\.sql$/.test(name));
  const files = selectMigrationFilenames(allFiles, phase);

  for (const filename of files) {
    const version = filename.split("_", 1)[0]!;
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
