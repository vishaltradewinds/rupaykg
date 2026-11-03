import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { assertNoOrphanedMigrations, sha256Hex } from "./migration-integrity.js";

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
      applied_at timestamptz not null default now(),
      checksum_sha256 text
    )
  `);
  // Existing installations receive a nullable column. NULL is deliberately
  // preserved as LEGACY_UNVERIFIED; never invent historical byte provenance.
  await pool.query("alter table schema_migrations add column if not exists checksum_sha256 text");

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];
  const migrationDir = candidates.find((candidate) => existsSync(candidate));
  if (!migrationDir) throw new Error(`Migration directory not found. Checked: ${candidates.join(", ")}`);

  const files = (await readdir(migrationDir))
    .filter((name) => /^\\d+_.+\\.sql$/.test(name))
    .sort();
  const manifest = new Map<string, { filename: string; bytes: Buffer; checksum: string }>();
  for (const filename of files) {
    const version = filename.split("_", 1)[0];
    if (manifest.has(version)) throw new Error(`Duplicate migration version in repository: ${version}`);
    const bytes = await readFile(path.join(migrationDir, filename));
    manifest.set(version, { filename, bytes, checksum: sha256Hex(bytes) });
  }

  const lock = await pool.connect();
  try {
    await lock.query("select pg_advisory_lock(hashtext('rupaykg:migration-runner:v2'))");
    const ledger = await lock.query<{ version: string; filename: string; checksum_sha256: string | null }>(
      "select version, filename, checksum_sha256 from schema_migrations order by version",
    );
    const recorded = new Map(ledger.rows.map((row) => [row.version, row]));

    // Validate every historical row before applying anything new. Legacy NULL
    // hashes are explicit LEGACY_UNVERIFIED states and require reviewed recovery.
    assertNoOrphanedMigrations(
      ledger.rows,
      new Map([...manifest].map(([version, item]) => [version, {
        version,
        filename: item.filename,
        checksum: item.checksum,
      }])),
    );
