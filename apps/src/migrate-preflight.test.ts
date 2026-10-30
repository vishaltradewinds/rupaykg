import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Pool as PoolType } from "pg";
import { runMigrations } from "./migrate.js";

type QueryResult = { rows: Array<Record<string, unknown>> };

function fakePool(options: {
  ledgerExists: boolean;
  applied?: Array<{ version: string; filename: string }>;
}) {
  const calls: string[] = [];
  const pool = {
    async query(sql: string): Promise<QueryResult> {
      const normalized = sql.replace(/\s+/g, " ").trim();
      calls.push(normalized);
      if (normalized.includes("to_regclass('schema_migrations')")) {
        return { rows: [{ ledger_exists: options.ledgerExists ? "schema_migrations" : null }] };
      }
      if (normalized.startsWith("select version, filename from schema_migrations order by version")) {
        return { rows: options.applied ?? [] };
      }
      if (normalized.startsWith("create table if not exists schema_migrations")) {
        return { rows: [] };
      }
      if (normalized.startsWith("select version, filename from schema_migrations where version =")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
    async connect() {
      return {
        async query(sql: string) {
          calls.push(sql.replace(/\s+/g, " ").trim());
          return { rows: [] };
        },
        release() {},
      };
    },
  };
  return { pool: pool as unknown as PoolType, calls };
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

test("conflicting existing ledger fails before ledger DDL and pending SQL", async () => {
  await withCatalog(async (dir) => {
    const { pool, calls } = fakePool({
      ledgerExists: true,
      applied: [{ version: "096", filename: "096_missing_from_catalogue.sql" }],
    });

    await assert.rejects(
      runMigrations(pool, dir),
      /MIGRATION_HISTORY_UNRESOLVED/,
    );
    assert.equal(calls.some((sql) => sql.startsWith("create table if not exists schema_migrations")), false);
    assert.equal(calls.some((sql) => sql === "select 1;"), false);
    assert.ok(calls.findIndex((sql) => sql.startsWith("select version, filename from schema_migrations order by version")) <
      calls.findIndex((sql) => sql.startsWith("create table if not exists schema_migrations")) || !calls.some((sql) => sql.startsWith("create table if not exists schema_migrations")));
  });
});

test("fresh database validates empty history before creating ledger", async () => {
  await withCatalog(async (dir) => {
    const { pool, calls } = fakePool({ ledgerExists: false });
    await runMigrations(pool, dir);

    const preflightIndex = calls.findIndex((sql) => sql.includes("to_regclass('schema_migrations')"));
    const createIndex = calls.findIndex((sql) => sql.startsWith("create table if not exists schema_migrations"));
    const pendingSqlIndex = calls.findIndex((sql) => sql === "select 1;");
    assert.ok(preflightIndex >= 0);
    assert.ok(createIndex > preflightIndex);
    assert.ok(pendingSqlIndex > createIndex);
  });
});
