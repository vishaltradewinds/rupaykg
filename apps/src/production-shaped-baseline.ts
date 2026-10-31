import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for disposable baseline capture");
if (process.env.CI !== "true") throw new Error("Baseline capture is CI-only; refusing non-CI execution");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 1,
});

try {
  const [version, ledger, tables, columns, constraints, indexes, triggers, functions] = await Promise.all([
    pool.query<{ version: string }>("select version()"),
    pool.query("select version,filename,applied_at from schema_migrations order by applied_at,version"),
    pool.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name"),
    pool.query("select table_name,column_name,data_type,is_nullable,column_default,ordinal_position from information_schema.columns where table_schema='public' order by table_name,ordinal_position"),
    pool.query("select c.relname as table_name, con.conname as constraint_name, con.contype as constraint_type, pg_get_constraintdef(con.oid) as definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,con.conname"),
    pool.query("select tablename as table_name,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname"),
    pool.query("select c.relname as table_name,t.tgname as trigger_name,pg_get_triggerdef(t.oid,true) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname"),
    pool.query("select p.proname as function_name,pg_get_function_identity_arguments(p.oid) as identity_arguments,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by p.proname,pg_get_function_identity_arguments(p.oid)"),
  ]);
  const reportRoot = process.env.GITHUB_WORKSPACE ?? path.resolve(process.cwd(), "..");
  const reportDir = path.join(reportRoot, "artifacts");
  await mkdir(reportDir, { recursive: true });
  const snapshot = {
    snapshot_version: 1,
    captured_at: new Date().toISOString(),
    candidate_head_sha: process.env.RUPAYKG_CANDIDATE_HEAD_SHA ?? "unknown",
    database: { engine: "PostgreSQL", version: version.rows[0]?.version ?? "unknown", disposable_ci_only: true },
    ledger: ledger.rows,
    schema: {
      tables: tables.rows,
      columns: columns.rows,
      constraints: constraints.rows,
      indexes: indexes.rows,
      triggers: triggers.rows,
      functions: functions.rows,
    },
  };
  await writeFile(path.join(reportDir, "production-shaped-baseline.json"), JSON.stringify(snapshot, null, 2) + "\n");
  console.log("Captured production-shaped baseline: " + ledger.rowCount + " ledger rows; " + tables.rowCount + " tables.");
} finally {
  await pool.end();
}
