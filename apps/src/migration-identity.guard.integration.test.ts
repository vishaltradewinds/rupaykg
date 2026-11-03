import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(sourceDir, "../../..");

describe("migration identity guard with isolated PostgreSQL schema", { skip: !enabled }, () => {
  const schema = `migration_guard_${process.pid}_${Date.now()}`;
  const baseUrl = new URL(process.env.DATABASE_URL!);
  const scopedUrl = new URL(baseUrl);
  scopedUrl.searchParams.set("options", `-csearch_path=${schema}`);
  const admin = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });

  after(async () => {
    try {
      await admin.query(`drop schema if exists "${schema}" cascade`);
    } finally {
      await admin.end();
    }
  });

  it("fails closed and leaves legacy ledger/schema unchanged", { timeout: 60_000 }, async () => {
    await admin.query(`create schema "${schema}"`);
    const db = new Pool({ connectionString: scopedUrl.toString(), ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
    try {
      await db.query("create table schema_migrations (version text primary key, filename text not null, applied_at timestamptz not null default now())");
      await db.query("insert into schema_migrations(version, filename) values ($1, $2)", ["20261018", "20261018_cpcb_swm_stakeholder_workspaces.sql"]);
      const result = spawnSync(process.execPath, [path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"), "src/migrate.ts"], {
        cwd: path.join(repoRoot, "apps"),
        encoding: "utf8",
        timeout: 45_000,
        env: { ...process.env, DATABASE_URL: scopedUrl.toString(), DATABASE_SSL: process.env.DATABASE_SSL ?? "false" },
      });
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
      assert.equal(result.error, undefined, output);
      assert.notEqual(result.status, 0, `Expected guard to stop the runner. Output:\n${output}`);
      assert.match(output, /MIGRATION_IDENTITY_CONFLICT/);
      assert.match(output, /No migrations were applied/);
      const ledger = await db.query("select version, filename from schema_migrations order by version");
      assert.deepEqual(ledger.rows, [{ version: "20261018", filename: "20261018_cpcb_swm_stakeholder_workspaces.sql" }]);
      const tables = await db.query("select tablename from pg_tables where schemaname = $1 and tablename <> 'schema_migrations' order by tablename", [schema]);
      assert.deepEqual(tables.rows, [], "No candidate migration DDL should run after a legacy identity conflict");
    } finally {
      await db.end();
    }
  });
});
