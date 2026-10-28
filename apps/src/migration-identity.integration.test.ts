import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1";
const databaseUrl = process.env.DATABASE_URL;

test("migration runner fails closed on legacy filename identity before applying candidate DDL", {
  skip: !enabled || !databaseUrl ? "requires disposable PostgreSQL integration-test mode and DATABASE_URL" : false,
}, async () => {
  const sourceDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationRunner = path.join(sourceDir, "migrate.js");
  const baseUrl = new URL(databaseUrl!);
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const adminPool = new Pool({ connectionString: adminUrl.toString(), ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
  const dbName = `rupaykg_migration_guard_${process.pid}_${Date.now()}`;
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${dbName}`;

  try {
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
    const testPool = new Pool({ connectionString: testUrl.toString(), ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
    try {
      await testPool.query(`
        CREATE TABLE schema_migrations (
          version text PRIMARY KEY,
          filename text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await testPool.query(
        "INSERT INTO schema_migrations(version, filename) VALUES ($1, $2)",
        ["20261018", "20261018_cpcb_swm_stakeholder_workspaces.sql"],
      );
    } finally {
      await testPool.end();
    }

    const child = spawnSync(process.execPath, [migrationRunner], {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: testUrl.toString() },
      timeout: 30_000,
    });
    assert.notEqual(child.status, 0, "runner must reject the historical filename conflict");
    assert.match(`${child.stdout}\n${child.stderr}`, /MIGRATION_IDENTITY_CONFLICT/);
    assert.match(`${child.stdout}\n${child.stderr}`, /No migrations were applied/);

    const verifyPool = new Pool({ connectionString: testUrl.toString(), ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
    try {
      const ledger = await verifyPool.query<{ version: string; filename: string }>(
        "SELECT version, filename FROM schema_migrations ORDER BY version",
      );
      assert.deepEqual(ledger.rows, [{
        version: "20261018",
        filename: "20261018_cpcb_swm_stakeholder_workspaces.sql",
      }]);
      const tables = await verifyPool.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
      );
      assert.deepEqual(tables.rows, [], "guard must reject before candidate migration DDL creates tables");
    } finally {
      await verifyPool.end();
    }
  } finally {
    await adminPool.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [dbName],
    );
    await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await adminPool.end();
  }
});
