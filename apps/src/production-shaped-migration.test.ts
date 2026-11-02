import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

const enabled = process.env.CI === "true" && process.env.NODE_ENV !== "production"
  && process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test("production-shaped migration order preserves 023 and production-only verifier provenance", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: true },
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
    const reportRoot = process.env.GITHUB_WORKSPACE ?? path.resolve(process.cwd(), "..");
    const baselineSnapshotPath = path.join(reportRoot, "artifacts", "production-shaped-baseline.json");
    const baselineSnapshot = JSON.parse(await readFile(baselineSnapshotPath, "utf8")) as {
      ledger: Array<{ version: string; filename: string; applied_at: string }>;
      schema: Record<string, Array<Record<string, unknown>>>;
    };
    assert.deepEqual(
      baselineSnapshot.ledger.map(({ version, filename }) => ({ version, filename })),
      manifest.production_migration_order.map(({ version, filename }) => ({ version, filename })),
      "pre-upgrade snapshot must match the exact captured production migration identities; applied_at is regenerated in the disposable fixture",
    );
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
    const baselineVerifier = baselineSnapshot.schema.functions?.find((entry) => entry.function_name === "prevent_invalid_verification");
    assert.ok(baselineVerifier, "pre-upgrade verifier function definition must be captured");
    const baselineVerifierDefinition = String(baselineVerifier.definition ?? "");
    const baselineVerifierHash = createHash("sha256").update(baselineVerifierDefinition).digest("hex");
    const upgradedVerifierHash = createHash("sha256").update(definition).digest("hex");
    assert.equal(upgradedVerifierHash, baselineVerifierHash, "proposed chain must not alter production verifier function definition");

    const scopeTriggers = await pool.query<{ trigger_name: string; definition: string }>(
      `select t.tgname as trigger_name, pg_get_triggerdef(t.oid, true) as definition
         from pg_trigger t
         join pg_class c on c.oid=t.tgrelid
         where not t.tgisinternal
           and t.tgname in ('government_crosswalk_request_source_scope','government_crosswalk_source_scope')
         order by t.tgname`,
    );
    assert.equal(scopeTriggers.rows.length, 2, "both crosswalk source-scope triggers must exist");
    for (const trigger of scopeTriggers.rows) {
      assert.match(trigger.definition, /UPDATE OF .*status/i, trigger.trigger_name + " must revalidate source scope on status transitions");
    }

    const pg = await pool.query<{ version: string }>("select version()");
    const tables = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name",
    );
    const columnsAfter = await pool.query<{ table_name: string; column_name: string }>(
      "select table_name,column_name from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
    );
    const reportDir = path.join(reportRoot, "artifacts");
    await mkdir(reportDir, { recursive: true });
    const afterSchema = {
      tables: tables.rows,
      columns: columnsAfter.rows,
      constraints: (await pool.query("select c.relname as table_name,con.conname as constraint_name,con.contype as constraint_type,pg_get_constraintdef(con.oid) as definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,con.conname")).rows,
      indexes: (await pool.query("select tablename as table_name,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname")).rows,
      triggers: (await pool.query("select c.relname as table_name,t.tgname as trigger_name,pg_get_triggerdef(t.oid,true) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname")).rows,
      functions: (await pool.query("select p.proname as function_name,pg_get_function_identity_arguments(p.oid) as identity_arguments,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by p.proname,pg_get_function_identity_arguments(p.oid)")).rows,
    };
    const keyFields: Record<string, string[]> = {
      tables: ["table_name"],
      columns: ["table_name", "column_name"],
      constraints: ["table_name", "constraint_name"],
      indexes: ["table_name", "indexname"],
      triggers: ["table_name", "trigger_name"],
      functions: ["function_name", "identity_arguments"],
    };
    const schemaDiff = Object.fromEntries(Object.entries(keyFields).map(([category, fields]) => {
      const key = (row: Record<string, unknown>) => fields.map((field) => String(row[field] ?? "")).join("::");
      const before = (baselineSnapshot.schema[category] ?? []).map(key);
      const after = (afterSchema[category as keyof typeof afterSchema] as Array<Record<string, unknown>>).map(key);
      const beforeSet = new Set(before);
      const afterSet = new Set(after);
      return [category, {
        before_count: before.length,
        after_count: after.length,
        added: after.filter((value) => !beforeSet.has(value)),
        removed: before.filter((value) => !afterSet.has(value)),
      }];
    }));
    const report = {
      report_version: 1,
      generated_at: new Date().toISOString(),
      candidate_commit: process.env.RUPAYKG_CANDIDATE_HEAD_SHA ?? "local-unpinned",
      workflow_commit: process.env.GITHUB_SHA ?? "local-unpinned",
      database: { engine: "PostgreSQL", version: pg.rows[0]?.version ?? "unknown", disposable_ci_only: true },
      baseline: {
        manifest_path: "docs/engineering/PRODUCTION_MIGRATION_LEDGER_MANIFEST_2026-10-31.json",
        manifest_sha256: createHash("sha256").update(manifestText).digest("hex"),
        migration_count: baseline.length,
        ordered_migration_identities: baseline.map(({ version, filename, applied_at }) => ({ version, filename, applied_at })),
        reconstructed_fixture_ledger: baselineSnapshot.ledger,
      },
      upgraded_ledger: entries,
      schema_diff: schemaDiff,
      schema_after: {
        public_table_count: tables.rowCount ?? tables.rows.length,
        public_tables: tables.rows.map((row) => row.table_name),
        public_column_count: columnsAfter.rowCount ?? columnsAfter.rows.length,
        columns: columnsAfter.rows,
      },
      verifier: {
        function: "prevent_invalid_verification()",
        baseline_definition_sha256: baselineVerifierHash,
        upgraded_definition_sha256: upgradedVerifierHash,
        unchanged: upgradedVerifierHash === baselineVerifierHash,
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
        { name: "source_scope_triggers_revalidate_status_transitions", result: "PASS" },
      ],
      exit_status: "PASS",
      limitations: [
        "Catalog schema diff compares object identities; reviewers must inspect changed definitions for semantic safety.",
        "Verifier function byte-for-byte equality is checked; independent semantic review of the function and surrounding authorization model is still required.",
        "This disposable PostgreSQL run is not a production data clone or live Neon rehearsal.",
      ],
    };
    await writeFile(path.join(reportDir, "production-shaped-migration-report.json"), JSON.stringify(report, null, 2) + "\n");
  } finally {
    await pool.end();
  }
});
