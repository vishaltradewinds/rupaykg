import assert from "node:assert/strict";
import { copyFile, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { runMigrations } from "../apps/src/migrate.js";

type LedgerRow = [version: string, filename: string];

async function main(): Promise<void> {
  if (process.env.DATABASE_URL == null || process.env.RUPAYKG_RUN_MIGRATION_HISTORY_TESTS !== "1") {
    throw new Error("Set DATABASE_URL and RUPAYKG_RUN_MIGRATION_HISTORY_TESTS=1 for this disposable-PostgreSQL acceptance test.");
  }

  const temp = await mkdtemp(path.join(os.tmpdir(), "rupaykg-history-preflight-"));
  const catalog = path.join(temp, "migrations");
  await mkdir(catalog);
  await writeFile(
    path.join(catalog, "001_should_not_run.sql"),
    "insert into migration_preflight_sentinel(marker) values ('MIGRATION_SQL_EXECUTED');\n",
    "utf8",
  );

  // Use the exact shared historical source files from this checkout. This makes
  // the production/staging-shaped cases fail only on their environment-specific
  // orphan records, rather than on unrelated missing fixture files.
  const sharedHistoricalFiles = [
    "20261018_cpcb_swm_stakeholder_workspaces.sql",
    "20261019_cpcb_bwg_workflow_tracking.sql",
    "20261020_ccts_methodology_registry.sql",
    "20261021_evidence_artifact_vault.sql",
  ];
  for (const filename of sharedHistoricalFiles) {
    await copyFile(path.resolve(process.cwd(), "migrations", filename), path.join(catalog, filename));
  }

  const suffix = randomUUID().replaceAll("-", "");
  const sharedRows: LedgerRow[] = sharedHistoricalFiles.map((filename) => [filename.split("_", 1)[0], filename]);
  const scenarios: Array<{
    name: string;
    schema: string;
    rows: LedgerRow[];
    expectedReason: "SOURCE_MISSING" | "VERSION_FILENAME_MISMATCH";
    expectedFilenamePattern: RegExp;
  }> = [
    {
      name: "single-missing-source",
      schema: "history_missing_" + suffix,
      rows: [["000", "000_removed_from_release.sql"]],
      expectedReason: "SOURCE_MISSING",
      expectedFilenamePattern: /000_removed_from_release\.sql/,
    },
    {
      name: "version-filename-mismatch",
      schema: "history_mismatch_" + suffix,
      rows: [["999", "001_should_not_run.sql"]],
      expectedReason: "VERSION_FILENAME_MISMATCH",
      expectedFilenamePattern: /999:001_should_not_run\.sql/,
    },
    {
      name: "production-ledger-missing-verification-096",
      schema: "history_prod_096_" + suffix,
      rows: [...sharedRows, ["096", "096_verification_authorization_provenance.sql"]],
      expectedReason: "SOURCE_MISSING",
      expectedFilenamePattern: /096:096_verification_authorization_provenance\.sql/,
    },
    {
      name: "staging-ledger-missing-async-ai-20261022-25",
      schema: "history_stage_async_" + suffix,
      rows: [
        ...sharedRows,
        ["20261022", "20261022_async_mirror_inbox.sql"],
        ["20261023", "20261023_async_mirror_worker_leases.sql"],
        ["20261024", "20261024_ai_intake_rate_limits.sql"],
        ["20261025", "20261025_ai_evidence_intake_jobs.sql"],
      ],
      expectedReason: "SOURCE_MISSING",
      expectedFilenamePattern: /20261022:20261022_async_mirror_inbox\.sql.*20261023:20261023_async_mirror_worker_leases\.sql.*20261024:20261024_ai_intake_rate_limits\.sql.*20261025:20261025_ai_evidence_intake_jobs\.sql/,
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
      for (const row of scenario.rows) {
        await pool.query("insert into schema_migrations(version, filename) values ($1, $2)", row);
      }

      await assert.rejects(
        runMigrations(pool, catalog),
        (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          assert.match(message, /MIGRATION_HISTORY_UNRESOLVED/);
          assert.match(message, new RegExp(scenario.expectedReason));
          assert.match(message, scenario.expectedFilenamePattern);
          return true;
        },
        scenario.name + ": runner must reject unresolved migration history before executing migration SQL",
      );

      const markerCount = (await pool.query("select count(*)::int as n from migration_preflight_sentinel")).rows[0].n;
      assert.equal(markerCount, 0, scenario.name + ": no migration SQL may execute before history preflight completes");
      const ledger = (await pool.query("select version, filename from schema_migrations order by version")).rows;
      assert.deepEqual(
        ledger,
        [...scenario.rows].sort(([a], [b]) => a.localeCompare(b)).map(([version, filename]) => ({ version, filename })),
        scenario.name + ": failed preflight must preserve every ledger row exactly",
      );
      console.log("PASS " + scenario.name + ": rejected before migration SQL; sentinel and complete ledger preserved.");
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
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
