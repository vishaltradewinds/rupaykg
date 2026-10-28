import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*--.*$/gm, " ");
}

function stripDollarQuotedBodies(sql: string): string {
  // BEGIN/COMMIT tokens inside PL/pgSQL function bodies are procedural
  // block syntax, not top-level transaction commands sent to the runner.
  return sql.replace(/(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)[\s\S]*?\1/g, " ");
}

function findTransactionIncompatibilities(sql: string): string[] {
  const clean = stripDollarQuotedBodies(stripSqlComments(sql));
  const checks: Array<[string, RegExp]> = [
    ["CREATE INDEX CONCURRENTLY", /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i],
    ["DROP INDEX CONCURRENTLY", /\bDROP\s+INDEX\s+CONCURRENTLY\b/i],
    ["REINDEX CONCURRENTLY", /\bREINDEX\b[^;]*\bCONCURRENTLY\b/i],
    ["VACUUM", /\bVACUUM\b/i],
    ["CREATE/DROP DATABASE", /\b(?:CREATE|DROP)\s+DATABASE\b/i],
    ["explicit transaction control", /^\s*(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT|PREPARE\s+TRANSACTION)\s*;?/im],
  ];
  return checks.filter(([, pattern]) => pattern.test(clean)).map(([name]) => name);
}

test("migration SQL is compatible with the runner's per-file PostgreSQL transaction", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationDirs = [
    path.resolve(here, "../../migrations"),
    path.resolve(here, "../../../migrations"),
  ];
  let migrationDir: string | undefined;
  for (const candidate of migrationDirs) {
    try {
      await readdir(candidate);
      migrationDir = candidate;
      break;
    } catch {
      // Try the next source/container layout.
    }
  }
  assert.ok(migrationDir, `Could not locate migrations directory: ${migrationDirs.join(", ")}`);

  const files = (await readdir(migrationDir!))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  assert.ok(files.length > 0, "Expected migration SQL files to be present");

  const findings: string[] = [];
  for (const filename of files) {
    const sql = await readFile(path.join(migrationDir!, filename), "utf8");
    const issues = findTransactionIncompatibilities(sql);
    for (const issue of issues) findings.push(`${filename}: ${issue}`);
  }
  assert.deepEqual(
    findings,
    [],
    "Migration runner wraps each file in BEGIN/COMMIT; review or redesign incompatible SQL before release.",
  );
});
