import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1";
const databaseUrl = process.env.DATABASE_URL;

test("migration 043 fails closed when existing BWG rows violate the new quantity invariant", {
  skip: !enabled || !databaseUrl ? "requires disposable PostgreSQL integration-test mode and DATABASE_URL" : false,
}, async () => {
  const sourceDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationRunner = path.join(sourceDir, "migrate.js");
  const migrationCandidates = [
    path.resolve(sourceDir, "../../migrations/043_bwg_epr_invariants.sql"),
    path.resolve(sourceDir, "../../../migrations/043_bwg_epr_invariants.sql"),
  ];
  let migrationSql: string | undefined;
  for (const candidate of migrationCandidates) {
    try {
      migrationSql = await readFile(candidate, "utf8");
      break;
    } catch {
      // Try the source-tree or compiled-container layout.
    }
  }
  assert.ok(migrationSql, "Could not locate migration 043 in the repository tree");

  const baseUrl = new URL(databaseUrl!);
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const adminPool = new Pool({
    connectionString: adminUrl.toString(),
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });
  const dbName = `rupaykg_migration_043_check_${process.pid}_${Date.now()}`;
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${dbName}`;
  const fixtureDir = await mkdtemp(path.join(tmpdir(), "rupaykg-migration-043-"));

  try {
    await writeFile(path.join(fixtureDir, "001_bwg_epr_invariants.sql"), migrationSql!, "utf8");
    await adminPool.query(`CREATE DATABASE "${dbName}"`);

    const seedPool = new Pool({
      connectionString: testUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
    try {
      await seedPool.query(`
        CREATE TABLE bwg_epr_reports (
          id integer PRIMARY KEY,
          fulfilled_quantity numeric NOT NULL,
          obligated_quantity numeric NOT NULL
        )
      `);
      await seedPool.query(
        "INSERT INTO bwg_epr_reports(id, fulfilled_quantity, obligated_quantity) VALUES (1, 12, 10)",
      );
    } finally {
      await seedPool.end();
    }

    const child = spawnSync(process.execPath, [migrationRunner], {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: testUrl.toString(),
        RUPAYKG_RUN_DB_INTEGRATION_TESTS: "1",
        RUPAYKG_TEST_MIGRATION_DIR: fixtureDir,
      },
      timeout: 30_000,
    });
    assert.equal(child.error, undefined, "migration runner process should start and finish normally");
    assert.notEqual(child.status, 0, "check constraint migration must reject violating historical rows");
    assert.match(
      `${child.stdout}\n${child.stderr}`,
      /Migration 001_bwg_epr_invariants\.sql failed/,
      "runner should identify the failing migration",
    );

    const verifyPool = new Pool({
      connectionString: testUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
    try {
      const rows = await verifyPool.query(
        "SELECT id, fulfilled_quantity, obligated_quantity FROM bwg_epr_reports ORDER BY id",
      );
      assert.deepEqual(rows.rows, [{ id: 1, fulfilled_quantity: "12", obligated_quantity: "10" }],
        "failed constraint validation must preserve historical data for manual review");
      const constraint = await verifyPool.query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.bwg_epr_reports'::regclass
            AND conname = 'bwg_epr_reports_fulfilled_le_obligated'
        ) AS exists`,
      );
      assert.equal(constraint.rows[0]?.exists, false, "failed migration must not leave a partial check constraint");
      const ledger = await verifyPool.query<{ version: string; filename: string }>(
        "SELECT version, filename FROM schema_migrations ORDER BY version",
      );
      assert.deepEqual(ledger.rows, [], "failed migration must not record a successful ledger row");
    } finally {
      await verifyPool.end();
    }
  } finally {
    await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await adminPool.end();
    await rm(fixtureDir, { recursive: true, force: true });
  }
});
