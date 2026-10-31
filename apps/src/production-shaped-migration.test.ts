import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("production-shaped migration order preserves 023 and production-only verifier provenance", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 2,
  });
  try {
    const ledger = await pool.query<{ version: string; filename: string }>(
      "select version, filename from schema_migrations order by applied_at, version",
    );
    const entries = ledger.rows;
    const manifestRelativePath = "docs/engineering/PRODUCTION_MIGRATION_LEDGER_MANIFEST_2026-10-31.json";
    const manifestCandidates = [
      path.resolve(process.cwd(), manifestRelativePath),
      path.resolve(process.cwd(), "..", manifestRelativePath),
    ];
    const manifestPath = manifestCandidates.find((candidate) => existsSync(candidate));
    assert.ok(manifestPath, "production migration manifest must be available from repository or workspace root");
    const manifestText = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(manifestText) as {
      count: number;
      production_migration_order: Array<{ version: string; filename: string; applied_at: string }>;
    };
    assert.equal(manifest.count, 92, "production manifest must contain all 92 observed rows");
    const baseline = manifest.production_migration_order;
    assert.equal(baseline.length, 92);
    const baselineActual = entries.slice(0, baseline.length).map(({ version, filename }) => ({ version, filename }));
    assert.deepEqual(baselineActual, baseline.map(({ version, filename }) => ({ version, filename })),
      "the first 92 applied migration identities must exactly match the live production ledger manifest");
    const indexOf = (version: string) => entries.findIndex((entry) => entry.version === version);
    for (const version of ["001", "023", "087", "20261018", "20261019", "20261020", "20261021", "096", "20261022"]) {
      assert.notEqual(indexOf(version), -1, "expected migration " + version + " in reconstructed baseline/upgrade");
    }
    assert.ok(indexOf("023") < indexOf("20261018"), "023 must remain in the historical baseline");
    assert.ok(indexOf("20261021") < indexOf("096"), "production migration 096 must follow the 20261018–20261021 baseline");
    assert.ok(indexOf("096") < indexOf("20261022"), "proposed chain must follow production migration 096");
    assert.equal(entries.find((entry) => entry.version === "096")?.filename, "096_verification_authorization_provenance.sql");

    const columns = await pool.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='public' and table_name='verifications'",
    );
    const columnNames = new Set(columns.rows.map((row) => row.column_name));
    for (const name of ["authorization_membership_id", "authorization_role_id", "authorization_permissions_snapshot", "authorization_checked_at"]) {
      assert.ok(columnNames.has(name), "missing verifier provenance column " + name);
    }

    const fn = await pool.query<{ definition: string }>(
      "select pg_get_functiondef('prevent_invalid_verification()'::regprocedure) as definition",
    );
    const definition = fn.rows[0]?.definition ?? "";
    for (const guard of ["activity_organization_id", "activity_actor", "membership_row", "authorization_permissions_snapshot", "authorization_checked_at"]) {
      assert.ok(definition.includes(guard), "verifier authorization guard missing " + guard);
    }

    const pg = await pool.query<{ version: string }>("select version()");
    const tables = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
    );
    const columnsAfter = await pool.query<{ table_name: string; column_name: string }>(
      "select table_name,column_name from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
    );
    const reportRoot = process.env.GITHUB_WORKSPACE ?? path.resolve(process.cwd(), "..");
    const reportDir = path.join(reportRoot, "artifacts");
    await mkdir(reportDir, { recursive: true });
    const report = {
      report_version: 1,
      generated_at: new Date().toISOString(),
      candidate_commit: process.env.GITHUB_SHA ?? "local-unpinned",
      database: { engine: "PostgreSQL", version: pg.rows[0]?.version ?? "unknown", disposable_ci_only: true },
      baseline: {
        manifest_path: "docs/engineering/PRODUCTION_MIGRATION_LEDGER_MANIFEST_2026-10-31.json",
        manifest_sha256: createHash("sha256").update(manifestText).digest("hex"),
        migration_count: baseline.length,
        ordered_migration_identities: baseline.map(({ version, filename, applied_at }) => ({ version, filename, applied_at })),
      },
      upgraded_ledger: entries,
      schema_after: {
        public_table_count: tables.rowCount ?? tables.rows.length,
        public_tables: tables.rows.map((row) => row.table_name),
        public_column_count: columnsAfter.rowCount ?? columnsAfter.rows.length,
        columns: columnsAfter.rows,
      },
      verifier: {
        function: "prevent_invalid_verification()",
        definition_sha256: createHash("sha256").update(definition).digest("hex"),
        required_guard_markers: ["activity_organization_id", "activity_actor", "membership_row", "authorization_permissions_snapshot", "authorization_checked_at"],
        provenance_columns: ["authorization_membership_id", "authorization_role_id", "authorization_permissions_snapshot", "authorization_checked_at"],
      },
      assertions: [
        { name: "exact_92_row_production_baseline", result: "PASS" },
        { name: "migration_023_preserved", result: "PASS" },
        { name: "production_only_096_preserved", result: "PASS" },
        { name: "proposed_upgrade_after_096", result: "PASS" },
        { name: "verifier_provenance_columns_preserved", result: "PASS" },
        { name: "verifier_function_guard_markers_preserved", result: "PASS" },
      ],
      exit_status: "PASS",
      limitations: [
        "Schema snapshot is post-upgrade only; it is not a full before/after schema diff.",
        "Verifier function hash is post-upgrade only; independent semantic review is still required.",
        "This disposable PostgreSQL run is not a production data clone or live Neon rehearsal.",
      ],
    };
    await writeFile(path.join(reportDir, "production-shaped-migration-report.json"), JSON.stringify(report, null, 2) + "\n");
  } finally {
    await pool.end();
  }
});
