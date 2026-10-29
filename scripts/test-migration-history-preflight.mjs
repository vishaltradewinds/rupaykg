import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";

if (process.env.DATABASE_URL == null || process.env.RUPAYKG_RUN_MIGRATION_HISTORY_TESTS !== "1") {
  throw new Error("Set DATABASE_URL and RUPAYKG_RUN_MIGRATION_HISTORY_TESTS=1 for this disposable-PostgreSQL acceptance test.");
}

const { Client } = pg;
const suffix = Date.now() + "_" + Math.floor(Math.random() * 1e6);
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
const temp = await mkdtemp(path.join(os.tmpdir(), "rupaykg-history-preflight-"));
const catalog = path.join(temp, "migrations");
await mkdir(catalog);
await writeFile(
  path.join(catalog, "001_should_not_run.sql"),
  "insert into migration_preflight_sentinel(marker) values ('MIGRATION_SQL_EXECUTED');\n",
  "utf8",
);

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.DATABASE_SSL === "false" ? {} : { ssl: { rejectUnauthorized: false } }),
});
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
const runRunner = (schema) => spawnSync(
  "node_modules/.bin/tsx",
  ["apps/src/migrate.ts"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RUPAYKG_RUN_MIGRATION_HISTORY_TESTS: "1",
      RUPAYKG_TEST_MIGRATIONS_DIR: catalog,
      PGOPTIONS: "-c search_path=" + schema + ",public",
    },
    encoding: "utf8",
    timeout: 120000,
  },
);
const created = [];
let connected = false;
try {
  await client.connect();
  connected = true;
  for (const scenario of scenarios) {
    await client.query("create schema " + quote(scenario.schema));
    created.push(scenario.schema);
    await client.query("set search_path to " + quote(scenario.schema) + ", public");
    await client.query("create table migration_preflight_sentinel(marker text not null)");
    await client.query("create table schema_migrations(version text primary key, filename text not null, applied_at timestamptz not null default now())");
    await client.query("insert into schema_migrations(version, filename) values ($1, $2)", scenario.row);

    const result = runRunner(scenario.schema);
    const output = result.stderr + result.stdout;
    assert.notEqual(result.status, 0, scenario.name + ": runner must reject unresolved migration history");
    assert.match(output, /MIGRATION_HISTORY_UNRESOLVED/, scenario.name + ": must fail in the preflight gate");
    assert.match(output, new RegExp(scenario.expectedReason), scenario.name + ": expected conflict reason must be reported");

    await client.query("set search_path to " + quote(scenario.schema) + ", public");
    const markerCount = (await client.query("select count(*)::int as n from migration_preflight_sentinel")).rows[0].n;
    assert.equal(markerCount, 0, scenario.name + ": no migration SQL may execute before history preflight completes");
    const ledgerCount = (await client.query("select count(*)::int as n from schema_migrations")).rows[0].n;
    assert.equal(ledgerCount, 1, scenario.name + ": failed preflight must not change the applied ledger");
    console.log("PASS " + scenario.name + ": rejected before migration SQL; sentinel and ledger preserved.");
  }
} finally {
  try {
    if (connected) {
      for (const schema of created.reverse()) {
        await client.query("drop schema if exists " + quote(schema) + " cascade");
      }
    }
  } finally {
    if (connected) await client.end().catch(() => {});
    await rm(temp, { recursive: true, force: true });
  }
}
