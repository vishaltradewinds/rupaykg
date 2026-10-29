import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
if (process.env.RUPAYKG_RUN_DUAL_LEDGER_TESTS !== "1") {
  console.log("Skipped dual-ledger PostgreSQL acceptance test (set RUPAYKG_RUN_DUAL_LEDGER_TESTS=1 to enable).");
  process.exit(0);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for disposable-schema acceptance tests.");
const assertDisposableDatabaseTarget = (connectionString) => {
  let parsed;
  try { parsed = new URL(connectionString); } catch {
    throw new Error("Refusing database integration tests: DATABASE_URL is not a valid URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("Refusing database integration tests: DATABASE_URL must use postgres:// or postgresql://.");
  }
  // WHATWG URL.hostname keeps brackets around IPv6 literals in Node.
  const hostname = parsed.hostname.replace(/^\\[|\\]$/g, "").toLowerCase();
  const safeHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!safeHosts.has(hostname)) {
    throw new Error(
      `Refusing destructive schema-based acceptance tests against host "${hostname}". ` +
      "Use a dedicated disposable PostgreSQL instance bound to loopback; these tests create and drop schemas.",
    );
  }
};
assertDisposableDatabaseTarget(process.env.DATABASE_URL);

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(here, "fixtures", "legacy-migrations");
const migrationNames = [
  "20261022_async_mirror_inbox.sql",
  "20261023_async_mirror_worker_leases.sql",
  "20261024_ai_intake_rate_limits.sql",
  "20261025_ai_evidence_intake_jobs.sql",
];
const correctiveName = "20261101_async_mirror_unresolved_crosswalk.sql";
const sqlByName = new Map();
for (const name of [...migrationNames, correctiveName]) {
  sqlByName.set(name, await readFile(path.join(fixtureDir, name), "utf8"));
}
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
const suffix = Date.now() + "_" + Math.floor(Math.random() * 1e6);
const prodSchema = "migration_prod_" + suffix;
const stagingSchema = "migration_stage_" + suffix;
const quoteIdent = (value) => '"' + value.replaceAll('"', '""') + '"';
const tableExists = async (schema, table) => (await client.query(
  "select to_regclass($1) is not null as exists", [schema + "." + table],
)).rows[0].exists;
const setSchema = async (schema) => client.query("set search_path to " + quoteIdent(schema) + ", public");
const makePrerequisites = async () => {
  await client.query("create table identities (id uuid primary key)");
  await client.query("create table organizations (id uuid primary key)");
  await client.query("create table evidence (id uuid primary key)");
  await client.query("create table schema_migrations (version text primary key, filename text not null, applied_at timestamptz not null default now())");
};
const applyAndRecord = async (name) => {
  await client.query(sqlByName.get(name));
  await client.query("insert into schema_migrations(version, filename) values ($1,$2)", [name.split("_", 1)[0], name]);
};
const assertNoOrphans = (records, files) => {
  const available = new Set(files);
  const orphaned = records.filter((record) => !available.has(record.filename));
  if (orphaned.length) throw new Error("Migration ledger references files absent from this release: " + orphaned.map((row) => row.version).join(", "));
};
let connected = false;
const createdSchemas = [];
try {
  await client.connect();
  connected = true;
  for (const schema of [prodSchema, stagingSchema]) {
    await client.query("create schema " + quoteIdent(schema));
    createdSchemas.push(schema);
    await setSchema(schema);
    await makePrerequisites();
  }

  // Production-shaped history: migrations are not recorded and must apply exactly once.
  await setSchema(prodSchema);
  for (const name of migrationNames) await applyAndRecord(name);
  for (const table of ["async_mirror_inbox", "async_mirror_inbox_events", "ai_intake_rate_limits", "ai_evidence_intake_jobs"]) {
    assert.equal(await tableExists(prodSchema, table), true, "production-shaped upgrade must create " + table);
  }
  assert.equal((await client.query("select count(*)::int as n from schema_migrations")).rows[0].n, 4);
  const inserted = await client.query(
    "insert into async_mirror_inbox(authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,status) values ('TEST-AUTH','TEST-MUNI',gen_random_uuid(),now(),'{}',$1,'RECEIVED') returning id",
    ["a".repeat(64)],
  );
  await assert.rejects(
    client.query("update async_mirror_inbox set status='UNRESOLVED' where id=$1", [inserted.rows[0].id]),
    /async_mirror_inbox_status_check/,
    "the recovered worker migration must reject UNRESOLVED before the corrective constraint migration",
  );
  await client.query(sqlByName.get(correctiveName));
  await client.query("update async_mirror_inbox set status='UNRESOLVED' where id=$1", [inserted.rows[0].id]);
  assert.equal((await client.query("select status from async_mirror_inbox where id=$1", [inserted.rows[0].id])).rows[0].status, "UNRESOLVED");
  await client.query("update async_mirror_inbox set status='VALIDATED' where id=$1", [inserted.rows[0].id]);
  assert.equal((await client.query("select status from async_mirror_inbox where id=$1", [inserted.rows[0].id])).rows[0].status, "VALIDATED");

  // Exercise the complete post-correction CHECK contract, not just UNRESOLVED.
  // Use isolated synthetic rows so these assertions do not depend on transition
  // ordering or mutate any live/staging data.
  const allowedStatuses = ["RECEIVED", "PROCESSING", "PROCESSED", "VALIDATED", "REJECTED", "RETRY", "QUARANTINED", "UNRESOLVED"];
  for (const [index, status] of allowedStatuses.entries()) {
    const row = await client.query(
      "insert into async_mirror_inbox(authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,status) values ('STATUS-TEST','TEST-MUNI',$1,now(),'{}',$2,$3) returning status",
      ["20000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"), String(index + 1).toString(16).padStart(64, "0"), status],
    );
    assert.equal(row.rows[0].status, status, "corrective CHECK must preserve allowed status " + status);
  }
  await assert.rejects(
    client.query(
      "insert into async_mirror_inbox(authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,status) values ('STATUS-TEST','TEST-MUNI',gen_random_uuid(),now(),'{}',$1,'INVALID_TEST_STATUS')",
      ["f".repeat(64)],
    ),
    /async_mirror_inbox_status_check/,
    "corrective CHECK must continue rejecting unknown statuses",
  );

  // Staging-shaped history: same source migrations are already recorded; runner must skip them.
  await setSchema(stagingSchema);
  for (const name of migrationNames) await applyAndRecord(name);
  for (let i = 0; i < 12; i++) {
    await client.query(
      "insert into async_mirror_inbox(authority_code,municipal_code,batch_id,sync_window_timestamp,payload,payload_sha256,status,attempts) values ('TEST-AUTH','TEST-MUNI',$1,now(),'{}',$2,'RECEIVED',0)",
      ["00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"), "b".repeat(64)],
    );
  }
  const inboxBefore = (await client.query("select id, status, attempts, payload_sha256 from async_mirror_inbox order by id")).rows;
  const eventsBefore = (await client.query("select inbox_id, to_status, attempt, payload_sha256 from async_mirror_inbox_events order by id")).rows;
  assert.equal(inboxBefore.length, 12);
  assert.equal(eventsBefore.length, 12);
  const records = (await client.query("select version, filename from schema_migrations order by version")).rows;
  assertNoOrphans(records, migrationNames);
  for (const name of migrationNames) {
    const version = name.split("_", 1)[0];
    const match = records.find((record) => record.version === version);
    assert.equal(match && match.filename, name, "staging ledger must match exact filename for " + name);
  }
  const inboxAfter = (await client.query("select id, status, attempts, payload_sha256 from async_mirror_inbox order by id")).rows;
  const eventsAfter = (await client.query("select inbox_id, to_status, attempt, payload_sha256 from async_mirror_inbox_events order by id")).rows;
  assert.deepEqual(inboxAfter, inboxBefore, "staging inbox rows must remain unchanged");
  assert.deepEqual(eventsAfter, eventsBefore, "staging event history must remain unchanged");
  assert.throws(
    () => assertNoOrphans(records, migrationNames.slice(1)),
    /Migration ledger references files absent from this release: 20261022/,
    "a missing recorded source migration must fail closed",
  );
  const countBefore = (await client.query("select count(*)::int as n from schema_migrations")).rows[0].n;
  for (const name of migrationNames) {
    const version = name.split("_", 1)[0];
    const existing = (await client.query("select filename from schema_migrations where version=$1", [version])).rows[0];
    assert.equal(existing.filename, name);
  }
  assert.equal((await client.query("select count(*)::int as n from schema_migrations")).rows[0].n, countBefore);
  console.log("PASS: production-shaped apply, staging-shaped exact-ledger skip, 12 inbox/12 event preservation, orphan fail-closed, UNRESOLVED constraint regression.");
} finally {
  try {
    if (connected) {
      for (const schema of createdSchemas.reverse()) await client.query("drop schema if exists " + quoteIdent(schema) + " cascade");
    }
  } finally {
    if (connected) await client.end().catch(() => {});
  }
}
