import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { runMigrations } from "../apps/src/migrate.js";

if (process.env.DATABASE_URL == null || process.env.RUPAYKG_RUN_MIGRATION_HISTORY_TESTS !== "1") {
  throw new Error("Set DATABASE_URL and RUPAYKG_RUN_MIGRATION_HISTORY_TESTS=1 for this disposable-PostgreSQL acceptance test.");
}

const temp = await mkdtemp(path.join(os.tmpdir(), "rupaykg-history-preflight-"));
const catalog = path.join(temp, "migrations");
await mkdir(catalog);
await writeFile(
  path.join(catalog, "001_should_not_run.sql"),
  "insert into migration_preflight_sentinel(marker) values ('MIGRATION_SQL_EXECUTED');\\n",
  "utf8",
);

const suffix = randomUUID().replaceAll("-", "");
const scenarios = [
  {
    name: "missing-source",
    schema: "history_missing_" + suffix,
    row: ["000", "000_removed_from_release.sql"],
    expectedReason: "SOURCE_MISSING",
  },
  {
    name: "version-filename-mismatch",
    schema: "history_mismatch_" + suffix,
    row: ["999", "001_should_not_run.sql"],
    expectedReason: "VERSION_FILENAME_MISMATCH",
  },
];
const admin = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
});
const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const created: string[] = [];
const scenarioPools: Pool[] = [];
let connected = false;

try {
  await admin.query("select 1");
  connected = true;
  for (const scenario of scenarios) {
    await admin.query("create schema " + quote(scenario.schema));
    created.push(scenario.schema);
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
      options: "-c search_path=" + scenario.schema + ",public",
    });
    scenarioPools.push(pool);
    await pool.query("create table migration_preflight_sentinel(marker text not null)");
    await pool.query("create table schema_migrations(version text primary key, filename text not null, applied_at timestamptz not null default now())");
    await pool.query("insert into schema_migrations(version, filename) values ($1, $2)", scenario.row);

    await assert.rejects(
      runMigrations(pool, catalog),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        assert.match(message, /MIGRATION_HISTORY_UNRESOLVED/);
        assert.match(message, new RegExp(scenario.expectedReason));
        return true;
      },
      scenario.name + ": runner must reject unresolved migration history before executing migration SQL",
    );

    const markerCount = (await pool.query("select count(*)::int as n from migration_preflight_sentinel")).rows[0].n;
    assert.equal(markerCount, 0, scenario.name + ": no migration SQL may execute before history preflight completes");
    const ledgerCount = (await pool.query("select count(*)::int as n from schema_migrations")).rows[0].n;
    assert.equal(ledgerCount, 1, scenario.name + ": failed preflight must not change the applied ledger");
    console.log("PASS " + scenario.name + ": rejected before migration SQL; sentinel and ledger preserved.");
  }
} finally {
  await Promise.all(scenarioPools.map((pool) => pool.end().catch(() => undefined)));
  if (connected) {
    for (const schema of created.reverse()) {
      await admin.query("drop schema if exists " + quote(schema) + " cascade").catch(() => undefined);
    }
  }
  await admin.end().catch(() => undefined);
  await rm(temp, { recursive: true, force: true });
}
