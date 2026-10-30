import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { Pool as PoolType } from "pg";
import { runMigrations } from "./migrate.js";

type QueryResult = { rows: Array<Record<string, unknown>> };

function fakePool(options: {
  ledgerExists: boolean;
  applied?: Array<{ version: string; filename: string }>;
  lockFails?: boolean;
}) {
  const calls: string[] = [];
  let releaseCount = 0;
  async function query(sql: string): Promise<QueryResult> {
    const normalized = sql.replace(/\\s+/g, " ").trim();
    calls.push(normalized);
    if (normalized.startsWith("select pg_advisory_lock") && options.lockFails) {
      throw new Error("simulated advisory lock failure");
    }
    if (normalized.includes("to_regclass('schema_migrations')")) {
      return { rows: [{ ledger_exists: options.ledgerExists ? "schema_migrations" : null }] };
    }
    if (normalized.startsWith("select version, filename from schema_migrations order by version")) {
      return { rows: options.applied ?? [] };
    }
    if (normalized.startsWith("select pg_advisory_lock") || normalized.startsWith("select pg_advisory_unlock")) {
      return { rows: [{ pg_advisory_lock: null }] };
    }
    return { rows: [] };
  }
  const pool = {
    async query(sql: string) {
      return query(sql);
    },
    async connect() {
      return {
        query,
        release() {
          releaseCount += 1;
        },
      };
    },
  };
  return { pool: pool as unknown as PoolType, calls, getReleaseCount: () => releaseCount };
}

async function withCatalog(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rupaykg-migration-preflight-"));
  try {
    await writeFile(path.join(dir, "001_safe.sql"), "select 1;", "utf8");
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("conflicting existing ledger fails before ledger DDL and pending SQL, then releases lock", async () => {
  await withCatalog(async (dir) => {
    const { pool, calls, getReleaseCount } = fakePool({
      ledgerExists: true,
      applied: [{ version: "096", filename: "096_missing_from_catalogue.sql" }],
    });

    await assert.rejects(runMigrations(pool, dir), /MIGRATION_HISTORY_UNRESOLVED/);
    assert.equal(calls.some((sql) => sql.startsWith("create table if not exists schema_migrations")), false);
    assert.equal(calls.some((sql) => sql === "select 1;"), false);
    assert.ok(calls[0].startsWith("select pg_advisory_lock"));
    assert.ok(calls.at(-1)?.startsWith("select pg_advisory_unlock"));
    assert.equal(getReleaseCount(), 1);
  });
});

test("fresh database validates empty history before creating ledger and applying SQL", async () => {
  await withCatalog(async (dir) => {
    const { pool, calls, getReleaseCount } = fakePool({ ledgerExists: false });
    await runMigrations(pool, dir);

    const lockIndex = calls.findIndex((sql) => sql.startsWith("select pg_advisory_lock"));
    const preflightIndex = calls.findIndex((sql) => sql.includes("to_regclass('schema_migrations')"));
    const createIndex = calls.findIndex((sql) => sql.startsWith("create table if not exists schema_migrations"));
    const pendingSqlIndex = calls.findIndex((sql) => sql === "select 1;");
    const unlockIndex = calls.findIndex((sql) => sql.startsWith("select pg_advisory_unlock"));
    assert.ok(lockIndex >= 0);
    assert.ok(preflightIndex > lockIndex);
    assert.ok(createIndex > preflightIndex);
    assert.ok(pendingSqlIndex > createIndex);
    assert.ok(unlockIndex > pendingSqlIndex);
    assert.equal(getReleaseCount(), 1);
  });
});

test("failed advisory lock acquisition releases connection without database mutation", async () => {
  await withCatalog(async (dir) => {
    const { pool, calls, getReleaseCount } = fakePool({ ledgerExists: false, lockFails: true });
    await assert.rejects(runMigrations(pool, dir), /simulated advisory lock failure/);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].startsWith("select pg_advisory_lock"));
    assert.equal(getReleaseCount(), 1);
  });
});


test(
  "real PostgreSQL serializes concurrent migration runners in an isolated schema",
  { skip: process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS !== "1" || !process.env.DATABASE_URL },
  async () => {
    const adminPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      ...(process.env.DATABASE_SSL === "false" ? { ssl: false } : {}),
    });
    const schema = `rk_migration_test_${randomUUID().replace(/-/g, "")}`;
    let migrationPool: Pool | undefined;
    try {
      await adminPool.query(`create schema "${schema}"`);
      migrationPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 2,
        options: `-c search_path=${schema}`,
        ...(process.env.DATABASE_SSL === "false" ? { ssl: false } : {}),
      });
      const dir = await mkdtemp(path.join(os.tmpdir(), "rupaykg-real-pg-migrations-"));
      try {
        await writeFile(
          path.join(dir, "001_lock_test.sql"),
          "select pg_sleep(0.25); create table migration_probe (id integer);",
          "utf8",
        );

        await Promise.all([
          runMigrations(migrationPool as unknown as PoolType, dir),
          runMigrations(migrationPool as unknown as PoolType, dir),
        ]);

        const ledger = await adminPool.query(
          `select version, filename from "${schema}".schema_migrations order by version`,
        );
        const probe = await adminPool.query(
          "select to_regclass($1)::text as probe",
          [`${schema}.migration_probe`],
        );
        assert.deepEqual(ledger.rows, [{ version: "001", filename: "001_lock_test.sql" }]);
        assert.equal(probe.rows[0]?.probe, `${schema}.migration_probe`);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    } finally {
      await migrationPool?.end();
      await adminPool.query(`drop schema if exists "${schema}" cascade`);
      await adminPool.end();
    }
  },
);


test(
  "real PostgreSQL releases the advisory lock when migration SQL fails",
  { skip: process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS !== "1" || !process.env.DATABASE_URL },
  async () => {
    const adminPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      ...(process.env.DATABASE_SSL === "false" ? { ssl: false } : {}),
    });
    const schema = `rk_migration_failure_test_${randomUUID().replace(/-/g, "")}`;
    let migrationPool: Pool | undefined;
    let probePool: Pool | undefined;
    try {
      await adminPool.query(`create schema "${schema}"`);
      const options = `-c search_path=${schema}`;
      const ssl = process.env.DATABASE_SSL === "false" ? { ssl: false as const } : {};
      migrationPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, options, ...ssl });
      probePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, options, ...ssl });
      const dir = await mkdtemp(path.join(os.tmpdir(), "rupaykg-migration-failure-"));
      try {
        await writeFile(path.join(dir, "001_fail.sql"), "select * from migration_table_that_does_not_exist;", "utf8");
        await assert.rejects(
          runMigrations(migrationPool as unknown as PoolType, dir),
          /Migration 001_fail\.sql failed/,
        );

        const lockProbe = await probePool.query(
          "select pg_try_advisory_lock($1, $2) as acquired",
          [1380270932, 1380270923],
        );
        assert.equal(lockProbe.rows[0]?.acquired, true);
        await probePool.query("select pg_advisory_unlock($1, $2)", [1380270932, 1380270923]);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    } finally {
      await probePool?.end();
      await migrationPool?.end();
      await adminPool.query(`drop schema if exists "${schema}" cascade`);
      await adminPool.end();
    }
  },
);
