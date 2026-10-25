import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { Pool } from "pg";
import test from "node:test";

const migrationDir = fileURLToPath(new URL("../../../migrations/", import.meta.url));
const runnerPath = fileURLToPath(new URL("./migrate.js", import.meta.url));

function runRunner(databaseUrl: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runnerPath], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: databaseUrl,
        DATABASE_SSL: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { output += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { output += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
}

test("two simultaneous migration runners serialize safely on a fresh disposable database", async (t) => {
  const databaseUrl = process.env.RUPAYKG_MIGRATION_RACE_TEST_DATABASE_URL;
  if (!databaseUrl || process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS !== "1") {
    t.skip("requires the dedicated disposable PostgreSQL migration-race database");
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: false });
  try {
    const before = await pool.query<{ ledger: string | null }>(
      "select to_regclass('public.schema_migrations')::text as ledger",
    );
    assert.equal(before.rows[0]?.ledger, null, "race-test database must start without a migration ledger");

    // Start both processes before awaiting either result so they contend for the same lock.
    const results = await Promise.all([runRunner(databaseUrl), runRunner(databaseUrl)]);
    assert.deepEqual(
      results.map((result) => result.code),
      [0, 0],
      results.map((result) => result.output).join("\n--- runner output ---\n"),
    );

    const ledger = await pool.query<{ version: string; filename: string }>(
      "select version, filename from public.schema_migrations order by version",
    );
    const files = (await readdir(migrationDir)).filter((name) => /^\\d+_.+\\.sql$/.test(name)).sort();
    assert.equal(ledger.rows.length, files.length, "every repository migration must be recorded exactly once");
    assert.deepEqual(
      ledger.rows.map((row) => row.filename),
      files,
      "migration ledger must match the repository inventory after concurrent startup",
    );
  } finally {
    await pool.end();
  }
});
