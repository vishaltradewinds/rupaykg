import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
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
    const manifestPath = path.resolve(process.cwd(), "docs/engineering/PRODUCTION_MIGRATION_LEDGER_MANIFEST_2026-10-31.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      count: number;
      production_migration_order: Array<{ version: string; filename: string }>;
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
  } finally {
    await pool.end();
  }
});
