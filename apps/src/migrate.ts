import { createHash } from "node:crypto";
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

const checksum = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const validChecksum = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

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
    manifest.set(version, { filename, bytes, checksum: checksum(bytes) });
  }

  const lock = await pool.connect();
  try {
    await lock.query("select pg_advisory_lock(hashtext('rupaykg:migration-runner:v2'))");
    const ledger = await lock.query<{ version: string; filename: string; checksum_sha256: string | null }>(
      "select version, filename, checksum_sha256 from schema_migrations order by version",
    );
    const recorded = new Map(ledger.rows.map((row) => [row.version, row]));

    // Detect rows whose source file disappeared or was renamed.
    for (const row of ledger.rows) {
      const source = manifest.get(row.version);
      if (!source) {
        throw new Error(`MIGRATION_LEDGER_ORPHAN: version ${row.version} (${row.filename}) has no matching repository migration`);
      }
      if (source.filename !== row.filename) {
        throw new Error(`MIGRATION_FILENAME_DRIFT: version ${row.version} is recorded as ${row.filename}, repository has ${source.filename}`);
      }
      if (row.checksum_sha256 === null) {
        throw new Error(`LEGACY_UNVERIFIED: version ${row.version} (${row.filename}) has no historical SHA-256. Stop for reviewed reconciliation; do not backfill from current files.`);
      }
      if (!validChecksum(row.checksum_sha256)) {
        throw new Error(`MIGRATION_CHECKSUM_INVALID: version ${row.version} has malformed checksum metadata`);
      }
      if (row.checksum_sha256 !== source.checksum) {
        throw new Error(`MIGRATION_CHECKSUM_DRIFT: version ${row.version} (${row.filename}) differs from the applied SHA-256`);
      }
    }

    for (const [version, migration] of manifest) {
      if (recorded.has(version)) continue;
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(migration.bytes.toString("utf8"));
        await client.query(
          "insert into schema_migrations(version, filename, checksum_sha256) values ($1, $2, $3)",
          [version, migration.filename, migration.checksum],
        );
        await client.query("commit");
        console.log(`Applied ${migration.filename} sha256=${migration.checksum}`);
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Migration ${migration.filename} failed; ledger row was not committed`, { cause: error });
      } finally {
        client.release();
      }
    }
    console.log(`Database migrations are current (${files.length} files; SHA-256 verified).`);
  } finally {
    try { await lock.query("select pg_advisory_unlock(hashtext('rupaykg:migration-runner:v2'))"); }
    finally { lock.release(); }
  }
} finally {
  await pool.end();
}
