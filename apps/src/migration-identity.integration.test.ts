import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1";
const databaseUrl = process.env.DATABASE_URL;

const migrationVersion = (filename: string): string => filename.slice(0, filename.indexOf("_"));

const legacyPairs = [
  ["20261018_cpcb_swm_stakeholder_workspaces.sql", "088_cpcb_swm_stakeholder_workspaces.sql"],
  ["20261019_cpcb_bwg_workflow_tracking.sql", "089_cpcb_bwg_workflow_tracking.sql"],
  ["20261020_ccts_methodology_registry.sql", "090_ccts_methodology_registry.sql"],
  ["20261021_evidence_artifact_vault.sql", "091_evidence_artifact_vault.sql"],
] as const;

test("migration runner rejects each known legacy identity and mixed history before candidate DDL", {
  skip: !enabled || !databaseUrl ? "requires disposable PostgreSQL integration-test mode and DATABASE_URL" : false,
}, async (t) => {
  const sourceDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationRunner = path.join(sourceDir, "migrate.js");
  const baseUrl = new URL(databaseUrl!);
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const adminPool = new Pool({
    connectionString: adminUrl.toString(),
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });

  const scenarios = [
    ...legacyPairs.map(([legacy, candidate]) => ({ name: `legacy ${legacy}`, pairs: [[legacy, candidate] as const] })),
    { name: "mixed legacy identities", pairs: [legacyPairs[0], legacyPairs[2]] },
  ];

  try {
    for (const [index, scenario] of scenarios.entries()) {
      await t.test(scenario.name, async () => {
        const dbName = `rupaykg_migration_guard_${process.pid}_${Date.now()}_${index}`;
        const testUrl = new URL(baseUrl);
        testUrl.pathname = `/${dbName}`;
        await adminPool.query(`CREATE DATABASE "${dbName}"`);

        try {
          const testPool = new Pool({
            connectionString: testUrl.toString(),
            ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
          });
          try {
            await testPool.query(`
              CREATE TABLE schema_migrations (
                version text PRIMARY KEY,
                filename text NOT NULL,
                applied_at timestamptz NOT NULL DEFAULT now()
              )
            `);
            for (const [legacy] of scenario.pairs) {
              const version = migrationVersion(legacy);
              await testPool.query(
                "INSERT INTO schema_migrations(version, filename) VALUES ($1, $2)",
                [version, legacy],
              );
            }
          } finally {
            await testPool.end();
          }

          const child = spawnSync(process.execPath, [migrationRunner], {
            encoding: "utf8",
            env: { ...process.env, DATABASE_URL: testUrl.toString() },
            timeout: 30_000,
          });
          assert.equal(child.error, undefined, "migration runner process should start and finish normally");
          assert.notEqual(child.status, 0, "runner must reject the historical filename conflict");
          assert.match(`${child.stdout}\n${child.stderr}`, /MIGRATION_IDENTITY_CONFLICT/);
          assert.match(`${child.stdout}\n${child.stderr}`, /No migrations were applied/);

          const verifyPool = new Pool({
            connectionString: testUrl.toString(),
            ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
          });
          try {
            const ledger = await verifyPool.query<{ version: string; filename: string }>(
              "SELECT version, filename FROM schema_migrations ORDER BY version",
            );
            assert.deepEqual(
              ledger.rows,
              scenario.pairs
                .map(([legacy]) => ({ version: migrationVersion(legacy), filename: legacy }))
                .sort((a, b) => a.version.localeCompare(b.version)),
              "rejected state must preserve exact historical ledger tuples",
            );
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
        }
      });
    }
  } finally {
    await adminPool.end();
  }
});


test("migration runner preflights late version conflicts before any candidate DDL", {
  skip: !enabled || !databaseUrl ? "requires disposable PostgreSQL integration-test mode and DATABASE_URL" : false,
}, async () => {
  const sourceDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationRunner = path.join(sourceDir, "migrate.js");
  const baseUrl = new URL(databaseUrl!);
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const adminPool = new Pool({
    connectionString: adminUrl.toString(),
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });
  const dbName = `rupaykg_version_conflict_${process.pid}_${Date.now()}`;
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${dbName}`;

  try {
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
    const seedPool = new Pool({
      connectionString: testUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
    try {
      await seedPool.query(`
        CREATE TABLE schema_migrations (
          version text PRIMARY KEY,
          filename text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await seedPool.query(
        "INSERT INTO schema_migrations(version, filename) VALUES ($1, $2)",
        ["091", "091_unexpected_historical_name.sql"],
      );
    } finally {
      await seedPool.end();
    }

    const child = spawnSync(process.execPath, [migrationRunner], {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: testUrl.toString() },
      timeout: 30_000,
    });
    assert.equal(child.error, undefined, "migration runner process should start and finish normally");
    assert.notEqual(child.status, 0, "runner must reject the conflicting version before applying migrations");
    assert.match(`${child.stdout}\n${child.stderr}`, /MIGRATION_VERSION_CONFLICT/);
    assert.match(`${child.stdout}\n${child.stderr}`, /No migrations were applied/);

    const verifyPool = new Pool({
      connectionString: testUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
    try {
      const ledger = await verifyPool.query<{ version: string; filename: string }>(
        "SELECT version, filename FROM schema_migrations ORDER BY version",
      );
      assert.deepEqual(ledger.rows, [{ version: "091", filename: "091_unexpected_historical_name.sql" }]);
      const tables = await verifyPool.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
      );
      assert.deepEqual(tables.rows, [], "preflight must reject before earlier candidate migrations create tables");
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



test("failed migration rolls back its DDL and does not write a ledger row", {
  skip: !enabled || !databaseUrl ? "requires disposable PostgreSQL integration-test mode and DATABASE_URL" : false,
}, async () => {
  const sourceDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationRunner = path.join(sourceDir, "migrate.js");
  const baseUrl = new URL(databaseUrl!);
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const adminPool = new Pool({
    connectionString: adminUrl.toString(),
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });
  const dbName = `rupaykg_transaction_rollback_${process.pid}_${Date.now()}`;
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${dbName}`;
  const fixtureDir = await mkdtemp(path.join(tmpdir(), "rupaykg-migration-fixture-"));

  try {
    await writeFile(
      path.join(fixtureDir, "001_transaction_rollback.sql"),
      "CREATE TABLE rollback_probe (id integer); SELECT 1 / 0;",
      "utf8",
    );
    await adminPool.query(`CREATE DATABASE "${dbName}"`);

    const child = spawnSync(process.execPath, [migrationRunner], {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: testUrl.toString(),
        RUPAYKG_TEST_MIGRATION_DIR: fixtureDir,
      },
      timeout: 30_000,
    });
    assert.equal(child.error, undefined, "migration runner process should start and finish normally");
    assert.notEqual(child.status, 0, "runner must fail on deliberately invalid migration SQL");
    assert.match(`${child.stdout}\n${child.stderr}`, /Migration 001_transaction_rollback\.sql failed/);

    const verifyPool = new Pool({
      connectionString: testUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
    try {
      const ledger = await verifyPool.query<{ version: string; filename: string }>(
        "SELECT version, filename FROM schema_migrations ORDER BY version",
      );
      assert.deepEqual(ledger.rows, [], "failed migration must not record a ledger row");
      const table = await verifyPool.query<{ exists: boolean }>(
        "SELECT to_regclass('public.rollback_probe') IS NOT NULL AS exists",
      );
      assert.equal(table.rows[0]?.exists, false, "DDL before the deliberate SQL error must roll back");
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
    await rm(fixtureDir, { recursive: true, force: true });
  }
});


test("migration runner skips an exact already-recorded ordinal identity without rerunning DDL", {
  skip: !enabled || !databaseUrl ? "requires disposable PostgreSQL integration-test mode and DATABASE_URL" : false,
}, async () => {
  const sourceDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationRunner = path.join(sourceDir, "migrate.js");
  const baseUrl = new URL(databaseUrl!);
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const adminPool = new Pool({
    connectionString: adminUrl.toString(),
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });
  const dbName = `rupaykg_ordinal_history_${process.pid}_${Date.now()}`;
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${dbName}`;
  const fixtureDir = await mkdtemp(path.join(tmpdir(), "rupaykg-ordinal-fixture-"));
  const filename = "088_existing_ordinal_history.sql";

  try {
    await writeFile(path.join(fixtureDir, filename), "CREATE TABLE ordinal_rerun_probe (id integer);", "utf8");
    await adminPool.query(`CREATE DATABASE "${dbName}"`);

    const seedPool = new Pool({
      connectionString: testUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
    try {
      await seedPool.query(`
        CREATE TABLE schema_migrations (
          version text PRIMARY KEY,
          filename text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await seedPool.query(
        "INSERT INTO schema_migrations(version, filename) VALUES ($1, $2)",
        ["088", filename],
      );
    } finally {
      await seedPool.end();
    }

    const child = spawnSync(process.execPath, [migrationRunner], {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        RUPAYKG_RUN_DB_INTEGRATION_TESTS: "1",
        DATABASE_URL: testUrl.toString(),
        RUPAYKG_TEST_MIGRATION_DIR: fixtureDir,
      },
      timeout: 30_000,
    });
    assert.equal(child.error, undefined, "migration runner process should start and finish normally");
    assert.equal(child.status, 0, `exact recorded identity should be skipped: ${child.stdout} ${child.stderr}`);

    const verifyPool = new Pool({
      connectionString: testUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
    try {
      const ledger = await verifyPool.query<{ version: string; filename: string }>(
        "SELECT version, filename FROM schema_migrations ORDER BY version",
      );
      assert.deepEqual(ledger.rows, [{ version: "088", filename }], "exact historical ledger tuple must remain unchanged");
      const table = await verifyPool.query<{ exists: boolean }>(
        "SELECT to_regclass('public.ordinal_rerun_probe') IS NOT NULL AS exists",
      );
      assert.equal(table.rows[0]?.exists, false, "already-recorded migration DDL must not execute again");
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
    await rm(fixtureDir, { recursive: true, force: true });
  }
});


test("migration runner rejects reverse deployment when date-prefixed candidate meets ordinal history", {
  skip: !enabled || !databaseUrl ? "requires disposable PostgreSQL integration-test mode and DATABASE_URL" : false,
}, async () => {
  const sourceDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationRunner = path.join(sourceDir, "migrate.js");
  const baseUrl = new URL(databaseUrl!);
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  const adminPool = new Pool({
    connectionString: adminUrl.toString(),
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });
  const dbName = `rupaykg_reverse_identity_${process.pid}_${Date.now()}`;
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${dbName}`;
  const fixtureDir = await mkdtemp(path.join(tmpdir(), "rupaykg-reverse-identity-fixture-"));
  const candidate = "20261018_cpcb_swm_stakeholder_workspaces.sql";
  const recorded = "088_cpcb_swm_stakeholder_workspaces.sql";

  try {
    await writeFile(path.join(fixtureDir, candidate), "CREATE TABLE reverse_identity_probe (id integer);", "utf8");
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
    const seedPool = new Pool({
      connectionString: testUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
    try {
      await seedPool.query(`
        CREATE TABLE schema_migrations (
          version text PRIMARY KEY,
          filename text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await seedPool.query(
        "INSERT INTO schema_migrations(version, filename) VALUES ($1, $2)",
        ["088", recorded],
      );
    } finally {
      await seedPool.end();
    }

    const child = spawnSync(process.execPath, [migrationRunner], {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        RUPAYKG_RUN_DB_INTEGRATION_TESTS: "1",
        DATABASE_URL: testUrl.toString(),
        RUPAYKG_TEST_MIGRATION_DIR: fixtureDir,
      },
      timeout: 30_000,
    });
    assert.equal(child.error, undefined, "migration runner process should start and finish normally");
    assert.notEqual(child.status, 0, "reverse identity conflict must be rejected");
    assert.match(`${child.stdout}\n${child.stderr}`, /MIGRATION_IDENTITY_CONFLICT/);
    assert.match(`${child.stdout}\n${child.stderr}`, /No migrations were applied/);

    const verifyPool = new Pool({
      connectionString: testUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
    });
    try {
      const ledger = await verifyPool.query<{ version: string; filename: string }>(
        "SELECT version, filename FROM schema_migrations ORDER BY version",
      );
      assert.deepEqual(ledger.rows, [{ version: "088", filename: recorded }], "reverse conflict must preserve ledger");
      const table = await verifyPool.query<{ exists: boolean }>(
        "SELECT to_regclass('public.reverse_identity_probe') IS NOT NULL AS exists",
      );
      assert.equal(table.rows[0]?.exists, false, "reverse conflict must reject before candidate DDL");
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
    await rm(fixtureDir, { recursive: true, force: true });
  }
});
