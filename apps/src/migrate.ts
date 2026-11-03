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
    const constraints = await client.query(`
      select count(*)::integer as total
        from pg_constraint
       where conrelid in ('public.mrv_submission_jobs'::regclass, 'public.mrv_submission_job_events'::regclass)
    `);
    if (Number(constraints.rows[0]?.total ?? 0) < 12) {
      throw new Error(`MIGRATION_POSTCONDITION_FAILED: ${filename} expected at least 12 queue/event constraints`);
    }
    const requiredIndexes = await client.query(`
      select indexname from pg_indexes
       where schemaname = 'public'
         and indexname = any(array[
           'activities_id_org_geo_uq', 'evidence_id_activity_uq',
           'verifications_id_evidence_activity_uq', 'mrv_submission_jobs_activity_idx',
           'mrv_submission_jobs_org_status_idx', 'mrv_submission_jobs_provider_hcs_tx_idx',
           'mrv_submission_job_events_job_idx'
         ])
    `);
    const indexNames = new Set(requiredIndexes.rows.map((row) => row.indexname));
    for (const name of [
      "activities_id_org_geo_uq", "evidence_id_activity_uq", "verifications_id_evidence_activity_uq",
      "mrv_submission_jobs_activity_idx", "mrv_submission_jobs_org_status_idx",
      "mrv_submission_jobs_provider_hcs_tx_idx", "mrv_submission_job_events_job_idx",
    ]) {
      if (!indexNames.has(name)) throw new Error(`MIGRATION_POSTCONDITION_FAILED: ${filename} missing index ${name}`);
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

const migrationReport = { status: "RUNNING", applied: [] as string[], verified: [] as string[], pending: [] as string[] };

const pool = new Pool({
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
  // Do not mutate an existing historical ledger merely to discover it is legacy.
  // An old non-empty ledger without checksum metadata is blocked before ALTER.
  const checksumColumn = await pool.query(
    "select exists(select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'schema_migrations' and column_name = 'checksum_sha256') as present",
  );
  if (checksumColumn.rows[0]?.present !== true) {
    const count = await pool.query<{ total: number }>("select count(*)::integer as total from schema_migrations");
    if (Number(count.rows[0]?.total ?? 0) > 0) {
      throw new Error("LEGACY_UNVERIFIED: non-empty migration ledger has no checksum_sha256 column; no ledger schema change was made");
    }
    await pool.query("alter table schema_migrations add column if not exists checksum_sha256 text");
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations")];
  const migrationDir = candidates.find((candidate) => existsSync(candidate));
  if (!migrationDir) throw new Error(`Migration directory not found. Checked: ${candidates.join(", ")}`);

  const files = (await readdir(migrationDir))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  const manifest = new Map<string, { filename: string; bytes: Buffer; checksum: string }>();
  for (const filename of files) {
    const version = filename.split("_", 1)[0];
    if (manifest.has(version)) throw new Error(`Duplicate migration version in repository: ${version}`);
    const bytes = await readFile(path.join(migrationDir, filename));
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
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

    migrationReport.verified.push(...ledger.rows.map((row) => row.version));
    migrationReport.pending.push(...[...manifest].filter(([version]) => !recorded.has(version)).map(([, migration]) => migration.filename));

    // A previously recorded migration is not accepted on ledger evidence alone.
    // Re-check critical catalog postconditions on every run, including rehearsals.
    for (const [version, migration] of manifest) {
      if (recorded.has(version)) await assertCriticalPostconditions(lock, migration.filename);
    }

    for (const [version, migration] of manifest) {
      if (recorded.has(version)) continue;
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(migration.bytes.toString("utf8"));
        await assertCriticalPostconditions(client, migration.filename);
        await client.query(
          "insert into schema_migrations(version, filename, checksum_sha256) values ($1, $2, $3)",
          [version, migration.filename, migration.checksum],
        );
        await client.query("commit");
        migrationReport.applied.push(migration.filename);
        migrationReport.pending = migrationReport.pending.filter((filename) => filename !== migration.filename);
      } catch (error) {
        await client.query("rollback");
        throw new Error("Migration " + migration.filename + " failed; ledger row was not committed", { cause: error });
      } finally {
        client.release();
      }
    }

    migrationReport.status = "CURRENT";
    console.log(JSON.stringify(migrationReport, null, 2));
  } finally {
    try {
      await lock.query("select pg_advisory_unlock(hashtext('rupaykg:migration-runner:v2'))");
    } finally {
      lock.release();
    }
  }
} catch (error) {
  migrationReport.status = "BLOCKED";
  console.error(JSON.stringify({
    ...migrationReport,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  throw error;
} finally {
  await pool.end();
}
