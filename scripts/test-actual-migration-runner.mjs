import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

if (process.env.RUPAYKG_RUN_DUAL_LEDGER_TESTS !== "1") {
  console.log("Skipped actual migration-runner test (acceptance-test flag is not enabled).");
  process.exit(0);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const { Client } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureSource = path.join(here, "fixtures", "legacy-migrations");
const names = [
  "20261022_async_mirror_inbox.sql",
  "20261023_async_mirror_worker_leases.sql",
  "20261024_ai_intake_rate_limits.sql",
  "20261025_ai_evidence_intake_jobs.sql",
];
const temp = await mkdtemp(path.join(os.tmpdir(), "rupaykg-migration-runner-"));
const migrationDir = path.join(temp, "migrations");
await mkdir(migrationDir);
for (const name of names) await copyFile(path.join(fixtureSource, name), path.join(migrationDir, name));
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
const suffix = Date.now() + "_" + Math.floor(Math.random() * 1e6);
const productionSchema = "runner_prod_" + suffix;
const stagingSchema = "runner_stage_" + suffix;
const q = (s) => '"' + s.replaceAll('"', '""') + '"';
const setSchema = (schema) => client.query("set search_path to " + q(schema) + ", public");
const prereqs = async () => {
  await client.query("create table identities(id uuid primary key)");
  await client.query("create table organizations(id uuid primary key)");
  await client.query("create table evidence(id uuid primary key)");
};
const runRunner = (schema, dir = migrationDir) => {
  const env = {
    ...process.env,
    RUPAYKG_RUN_DUAL_LEDGER_TESTS: "1",
    RUPAYKG_TEST_MIGRATIONS_DIR: dir,
    PGOPTIONS: "-c search_path=" + schema + ",public",
  };
  return spawnSync("node_modules/.bin/tsx", ["apps/src/migrate.ts"], {
    cwd: path.resolve(here, ".."),
    env,
    encoding: "utf8",
    timeout: 120000,
  });
};
let connected = false;
const schemas = [];
try {
  await client.connect();
  connected = true;
  for (const schema of [productionSchema, stagingSchema]) {
    await client.query("create schema " + q(schema));
    schemas.push(schema);
    await setSchema(schema);
    await prereqs();
  }

  // Production-shaped schema: run the actual repository migration runner.
  const prod = runRunner(productionSchema);
  assert.equal(prod.status, 0, "actual runner should apply recovered migrations to production-shaped schema: " + prod.stderr + prod.stdout);
  await setSchema(productionSchema);
  const prodLedger = (await client.query("select version, filename from schema_migrations order by version")).rows;
  assert.deepEqual(prodLedger.map(x => x.filename), names);
  for (const table of ["async_mirror_inbox", "async_mirror_inbox_events", "ai_intake_rate_limits", "ai_evidence_intake_jobs"]) {
    const exists = (await client.query("select to_regclass($1) is not null as yes", [productionSchema + "." + table])).rows[0].yes;
    assert.equal(exists, true, "runner must create " + table);
  }
  const prodRepeat = runRunner(productionSchema);
  assert.equal(prodRepeat.status, 0, "second actual runner execution should be a no-op: " + prodRepeat.stderr + prodRepeat.stdout);
  assert.match(prodRepeat.stdout, /Database migrations are current/);

  // Staging-shaped schema: install once, add representative records, then invoke actual runner.
  await setSchema(stagingSchema);
  await client.query("create table schema_migrations(version text primary key, filename text not null, applied_at timestamptz not null default now())");
  for (const name of names) {
    await client.query(await readFile(path.join(migrationDir, name), "utf8"));
    await client.query("insert into schema_migrations(version,filename) values ($1,$2)", [name.split("_", 1)[0], name]);
  }
  for (let i = 0; i < 12; i++) {
    await client.query(
      "insert into async_mirror_inbox(authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,status,attempts) values ('TEST-AUTH','TEST-MUNI',$1,now(),'{}',$2,'RECEIVED',0)",
      ["10000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"), "c".repeat(64)],
    );
  }
  const inboxBefore = (await client.query("select id, authority_code, municipal_code, batch_id, status, attempts, payload_sha256 from async_mirror_inbox order by id")).rows;
  const eventsBefore = (await client.query("select id, inbox_id, from_status, to_status, attempt, payload_sha256 from async_mirror_inbox_events order by id")).rows;
  assert.equal(inboxBefore.length, 12);
  assert.equal(eventsBefore.length, 12);
  const stage = runRunner(stagingSchema);
  assert.equal(stage.status, 0, "actual runner should skip exact recorded staging migrations: " + stage.stderr + stage.stdout);
  await setSchema(stagingSchema);
  assert.deepEqual((await client.query("select id, authority_code, municipal_code, batch_id, status, attempts, payload_sha256 from async_mirror_inbox order by id")).rows, inboxBefore);
  assert.deepEqual((await client.query("select id, inbox_id, from_status, to_status, attempt, payload_sha256 from async_mirror_inbox_events order by id")).rows, eventsBefore);
  assert.equal((await client.query("select count(*)::int n from schema_migrations")).rows[0].n, 4);
  const stageRepeat = runRunner(stagingSchema);
  assert.equal(stageRepeat.status, 0, "repeated staging runner should be a no-op: " + stageRepeat.stderr + stageRepeat.stdout);

  // Fail-closed negative case: recorded file is absent from the release directory.
  const missingDir = path.join(temp, "missing-file-release");
  await mkdir(missingDir);
  for (const name of names.slice(1)) await copyFile(path.join(migrationDir, name), path.join(missingDir, name));
  const orphan = runRunner(stagingSchema, missingDir);
  assert.notEqual(orphan.status, 0, "actual runner must fail when ledger references a missing migration file");
  assert.match(orphan.stderr + orphan.stdout, /recorded migration|orphan|absent/i);
  console.log("PASS: actual migrate.ts runner applied production-shaped fixture, skipped staging ledger matches, preserved 12 inbox + 12 event rows, no-op repeat runs, and failed closed on missing recorded source.");
} finally {
  if (connected) {
    for (const schema of schemas.reverse()) {
      try { await client.query("drop schema if exists " + q(schema) + " cascade"); } catch {}
    }
    await client.end().catch(() => {});
  }
  await rm(temp, { recursive: true, force: true });
}
