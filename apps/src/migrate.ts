import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { assertNoOrphanedMigrations, sha256Hex } from "./migration-integrity.js";

type SqlExecutor = { query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }> };

async function assertCriticalPostconditions(client: SqlExecutor, filename: string): Promise<void> {
  if (filename === "20261109_durable_mrv_submission_jobs.sql") {
    const result = await client.query(`
      select
        to_regclass('public.mrv_submission_jobs') is not null as jobs,
        to_regclass('public.mrv_submission_job_events') is not null as events,
        to_regprocedure('public.validate_mrv_submission_job_bindings()') is not null as binding_function,
        to_regprocedure('public.guard_mrv_submission_job_update()') is not null as update_guard_function,
        to_regprocedure('public.reject_mrv_submission_job_event_mutation()') is not null as event_guard_function,
        to_regprocedure('public.record_mrv_submission_job_event()') is not null as event_writer_function
    `);
    const row = result.rows[0];
    for (const key of ["jobs", "events", "binding_function", "update_guard_function", "event_guard_function", "event_writer_function"]) {
      if (row?.[key] !== true) throw new Error(`MIGRATION_POSTCONDITION_FAILED: ${filename} missing ${key}`);
    }
    const triggers = await client.query(`
      select tgname from pg_trigger
       where not tgisinternal
         and tgrelid in ('public.mrv_submission_jobs'::regclass, 'public.mrv_submission_job_events'::regclass)
    `);
    const names = new Set(triggers.rows.map((row) => row.tgname));
    for (const name of [
      "mrv_submission_job_binding_guard", "mrv_submission_job_update_guard",
      "mrv_submission_job_event_insert", "mrv_submission_job_event_update",
      "mrv_submission_job_events_no_update",
    ]) {
      if (!names.has(name)) throw new Error(`MIGRATION_POSTCONDITION_FAILED: ${filename} missing trigger ${name}`);
    }
  }

  if (filename === "20261113_mrv_worker_claim_index_reconcile.sql") {
    const result = await client.query(`
      select indexdef, indisvalid
        from pg_indexes i
        join pg_class c on c.relname = i.indexname and c.relnamespace = 'public'::regnamespace
        join pg_index x on x.indexrelid = c.oid
       where i.schemaname = 'public'
         and i.tablename = 'mrv_submission_jobs'
         and i.indexname = 'mrv_submission_jobs_claim_idx'
    `);
    const row = result.rows[0];
    const definition = typeof row?.indexdef === "string" ? row.indexdef : "";
    if (!row || row.indisvalid !== true ||
        !/\(next_attempt_at, created_at, id\)/i.test(definition) ||
        /'NEEDS_RECONCILIATION'/i.test(definition) ||
        !/'GUARDIAN_SUBMITTED'/i.test(definition) ||
        !/'HCS_CONSENSUS_CONFIRMED'/i.test(definition)) {
      throw new Error(`MIGRATION_POSTCONDITION_FAILED: ${filename} claim index does not match the required valid predicate and key order`);
    }
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const migrationReport = { status: "RUNNING", applied: [] as string[], verified: [] as string[], pending: [] as string[] };\n\nconst pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
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

    migrationReport.verified.push(...ledger.rows.map((row) => row.version));\n    migrationReport.pending.push(...[...manifest].filter(([version]) => !recorded.has(version)).map(([, migration]) => migration.filename));\n\n    // A previously recorded migration is not accepted on ledger evidence alone.
    // Re-check critical catalog postconditions on every run, including rehearsals.
    for (const [version, migration] of manifest) {
      if (recorded.has(version)) await assertCriticalPostconditions(lock, migration.filename);
    }
