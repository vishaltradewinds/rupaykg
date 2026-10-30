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
const assertDisposableDatabaseTarget = (connectionString) => {
  let parsed;
  try { parsed = new URL(connectionString); } catch {
    throw new Error("Refusing database integration tests: DATABASE_URL is not a valid URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("Refusing database integration tests: DATABASE_URL must use postgres:// or postgresql://.");
  }
  // WHATWG URL.hostname keeps brackets around IPv6 literals in Node.
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const safeHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!safeHosts.has(hostname)) {
    throw new Error(
      `Refusing destructive schema-based acceptance tests against host "${hostname}". ` +
      "Use a dedicated disposable PostgreSQL instance bound to loopback; these tests create and drop schemas.",
    );
  }
};
assertDisposableDatabaseTarget(process.env.DATABASE_URL);
const { Client } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureSource = path.join(here, "fixtures", "legacy-migrations");
const names = [
  "20261022_async_mirror_inbox.sql",
  "20261023_async_mirror_worker_leases.sql",
  "20261024_ai_intake_rate_limits.sql",
  "20261025_ai_evidence_intake_jobs.sql",
];
const repoRoot = path.resolve(here, "..");
const currentCatalog = path.join(repoRoot, "migrations");
const temp = await mkdtemp(path.join(os.tmpdir(), "rupaykg-migration-runner-"));
const migrationDir = path.join(temp, "migrations");
await mkdir(migrationDir);
for (const name of names) await copyFile(path.join(fixtureSource, name), path.join(migrationDir, name));
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false } });
const suffix = Date.now() + "_" + Math.floor(Math.random() * 1e6);
const productionSchema = "runner_prod_" + suffix;
const stagingSchema = "runner_stage_" + suffix;
const productionHistorySchema = "runner_prod_history_" + suffix;
const stagingHistorySchema = "runner_stage_history_" + suffix;
const verificationSchema = "runner_verification_" + suffix;
const versionMismatchSchema = "runner_version_mismatch_" + suffix;
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
    cwd: repoRoot,
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
  for (const schema of [productionSchema, stagingSchema, productionHistorySchema, stagingHistorySchema, verificationSchema, versionMismatchSchema]) {
    await client.query("create schema " + q(schema));
    schemas.push(schema);
    await setSchema(schema);
    // The authorization fixture defines its own complete minimal schema below;
    // do not pre-create the same tables in that dedicated schema.
    if (schema !== verificationSchema) await prereqs();
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

  // Full-history shape: shared legacy records exist, while production's 096
  // record and staging's 20261022-25 records are absent from this release catalog.
  // The shared historical sources are present in this branch; ledger entries
  // make the runner skip them, so no historical SQL is replayed in these schemas.
  const historicalCatalog = path.join(temp, "historical-release-catalog");
  await mkdir(historicalCatalog);
  const sharedLegacy = [
    "20261018_cpcb_swm_stakeholder_workspaces.sql",
    "20261019_cpcb_bwg_workflow_tracking.sql",
    "20261020_ccts_methodology_registry.sql",
    "20261021_evidence_artifact_vault.sql",
  ];
  for (const name of sharedLegacy) await copyFile(path.join(currentCatalog, name), path.join(historicalCatalog, name));

  for (const schema of [productionHistorySchema, stagingHistorySchema]) {
    await setSchema(schema);
    await client.query("create table schema_migrations(version text primary key, filename text not null, applied_at timestamptz not null default now())");
    for (const name of sharedLegacy) {
      await client.query("insert into schema_migrations(version,filename) values ($1,$2)", [name.split("_", 1)[0], name]);
    }
  }
  await setSchema(productionHistorySchema);
  await client.query("insert into schema_migrations(version,filename) values ('096','096_verification_authorization_provenance.sql')");
  const prodHistory = runRunner(productionHistorySchema, historicalCatalog);
  assert.notEqual(prodHistory.status, 0, "actual runner must fail closed for production's missing recorded 096 source");
  assert.match(prodHistory.stderr + prodHistory.stdout, /096_verification_authorization_provenance\.sql/);

  await setSchema(stagingHistorySchema);
  for (const name of names) {
    await client.query("insert into schema_migrations(version,filename) values ($1,$2)", [name.split("_", 1)[0], name]);
  }
  const stageHistory = runRunner(stagingHistorySchema, historicalCatalog);
  assert.notEqual(stageHistory.status, 0, "actual runner must fail closed for staging's absent 20261022-25 source files");
  assert.match(stageHistory.stderr + stageHistory.stdout, /20261022_async_mirror_inbox\.sql/);
  assert.match(stageHistory.stderr + stageHistory.stdout, /20261025_ai_evidence_intake_jobs\.sql/);

  // An available catalog file recorded under the wrong ledger version must fail
  // during full-history preflight, before pending SQL executes.
  const mismatchCatalog = path.join(temp, "version-mismatch-release");
  await mkdir(mismatchCatalog);
  await writeFile(
    path.join(mismatchCatalog, "001_should_not_run.sql"),
    "insert into migration_preflight_sentinel(marker) values ('VERSION_MISMATCH_SQL_EXECUTED');\n",
    "utf8",
  );
  await setSchema(versionMismatchSchema);
  await client.query("create table migration_preflight_sentinel(marker text not null)");
  await client.query("create table schema_migrations(version text primary key, filename text not null, applied_at timestamptz not null default now())");
  await client.query("insert into schema_migrations(version,filename) values ('999','001_should_not_run.sql')");
  const mismatch = runRunner(versionMismatchSchema, mismatchCatalog);
  assert.notEqual(mismatch.status, 0, "actual runner must reject a catalog filename recorded under the wrong version");
  assert.match(mismatch.stderr + mismatch.stdout, /MIGRATION_HISTORY_UNRESOLVED/);
  assert.match(mismatch.stderr + mismatch.stdout, /999:001_should_not_run\.sql:VERSION_FILENAME_MISMATCH/);
  await setSchema(versionMismatchSchema);
  assert.equal((await client.query("select count(*)::int n from migration_preflight_sentinel")).rows[0].n, 0, "version mismatch must fail before pending migration SQL");
  assert.deepEqual((await client.query("select version,filename from schema_migrations")).rows, [{ version: "999", filename: "001_should_not_run.sql" }], "version mismatch must preserve the original ledger row");
  // Execute the recovered 096 SQL as an isolated disposable-schema acceptance
  // fixture, not as a release migration. Validate authorization binding and snapshot.
  await setSchema(verificationSchema);
  await client.query(`
    create table organizations(id uuid primary key);
    create table identities(id uuid primary key, status text not null, suspended_at timestamptz);
    create table roles(id uuid primary key, permissions jsonb not null);
    create table organization_memberships(
      id uuid primary key, identity_id uuid not null references identities(id),
      organization_id uuid not null references organizations(id),
      role_id uuid not null references roles(id), status text not null, created_at timestamptz not null default now()
    );
    create table activities(id uuid primary key, actor_identity_id uuid, organization_id uuid references organizations(id));
    create table evidence(id uuid primary key, activity_id uuid references activities(id));
    create table verifications(
      id uuid primary key, activity_id uuid references activities(id), evidence_id uuid references evidence(id),
      verifier_identity_id uuid not null references identities(id), decision text not null
    );
  `);
  await client.query(await readFile(path.join(fixtureSource, "096_verification_authorization_provenance.sql"), "utf8"));
  const ids = {
    org: "10000000-0000-4000-8000-000000000001",
    verifier: "10000000-0000-4000-8000-000000000002",
    actor: "10000000-0000-4000-8000-000000000003",
    role: "10000000-0000-4000-8000-000000000004",
    membership: "10000000-0000-4000-8000-000000000005",
    activity: "10000000-0000-4000-8000-000000000006",
    evidence: "10000000-0000-4000-8000-000000000007",
    verification: "10000000-0000-4000-8000-000000000008",
  };
  await client.query("insert into organizations(id) values ($1)", [ids.org]);
  await client.query("insert into identities(id,status) values ($1,'VERIFIED'),($2,'VERIFIED')", [ids.verifier, ids.actor]);
  await client.query("insert into roles(id,permissions) values ($1,'[\"VERIFY_EVIDENCE\"]'::jsonb)", [ids.role]);
  await client.query("insert into organization_memberships(id,identity_id,organization_id,role_id,status) values ($1,$2,$3,$4,'VERIFIED')", [ids.membership, ids.verifier, ids.org, ids.role]);
  await client.query("insert into activities(id,actor_identity_id,organization_id) values ($1,$2,$3)", [ids.activity, ids.actor, ids.org]);
  await client.query("insert into evidence(id,activity_id) values ($1,$2)", [ids.evidence, ids.activity]);
  await client.query("insert into verifications(id,activity_id,evidence_id,verifier_identity_id,decision) values ($1,$2,$3,$4,'APPROVED')", [ids.verification, ids.activity, ids.evidence, ids.verifier]);
  const snapshot = (await client.query("select authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at from verifications where id=$1", [ids.verification])).rows[0];
  assert.equal(snapshot.authorization_membership_id, ids.membership);
  assert.equal(snapshot.authorization_role_id, ids.role);
  assert.deepEqual(snapshot.authorization_permissions_snapshot, ["VERIFY_EVIDENCE"]);
  assert.ok(snapshot.authorization_checked_at, "approval must capture decision-time authorization timestamp");

  // The legacy trigger stores decision-time authorization provenance but does
  // not clear it when current decision changes. Assert the distinction so
  // consumers must gate current approval on decision='APPROVED', not snapshot presence.
  await client.query("update verifications set decision='REJECTED' where id=$1", [ids.verification]);
  const rejected = (await client.query(
    "select decision,authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at from verifications where id=$1",
    [ids.verification],
  )).rows[0];
  assert.equal(rejected.decision, "REJECTED", "current decision must remain authoritative");
  assert.equal(rejected.authorization_membership_id, ids.membership, "prior authorization snapshot is retained as historical provenance");
  assert.equal(rejected.authorization_role_id, ids.role);
  assert.deepEqual(rejected.authorization_permissions_snapshot, ["VERIFY_EVIDENCE"]);
  assert.ok(rejected.authorization_checked_at);

  // Re-approval must pass the trigger's live authorization checks again.
  await client.query("update verifications set decision='APPROVED' where id=$1", [ids.verification]);
  const reapproved = (await client.query(
    "select decision,authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at from verifications where id=$1",
    [ids.verification],
  )).rows[0];
  assert.equal(reapproved.decision, "APPROVED");
  assert.equal(reapproved.authorization_membership_id, ids.membership);
  assert.equal(reapproved.authorization_role_id, ids.role);
  assert.deepEqual(reapproved.authorization_permissions_snapshot, ["VERIFY_EVIDENCE"]);
  assert.ok(reapproved.authorization_checked_at, "re-approval must capture authorization again");

  await assert.rejects(
    client.query("insert into verifications(id,activity_id,evidence_id,verifier_identity_id,decision) values ($1,$2,$3,$4,'APPROVED')", ["10000000-0000-4000-8000-000000000009", ids.activity, ids.evidence, ids.actor]),
    /cannot verify its own evidence/,
  );
  await assert.rejects(
    client.query("insert into verifications(id,activity_id,evidence_id,verifier_identity_id,decision) values ($1,$2,$3,$4,'APPROVED')", ["10000000-0000-4000-8000-000000000010", "10000000-0000-4000-8000-000000000011", ids.evidence, ids.verifier]),
    /must match the evidence activity/,
  );

  // Fail-closed negative case: recorded file is absent from the release directory.
  const missingDir = path.join(temp, "missing-file-release");
  await mkdir(missingDir);
  for (const name of names.slice(1)) await copyFile(path.join(migrationDir, name), path.join(missingDir, name));
  const orphan = runRunner(stagingSchema, missingDir);
  assert.notEqual(orphan.status, 0, "actual runner must fail when ledger references a missing migration file");
  assert.match(orphan.stderr + orphan.stdout, /MIGRATION_HISTORY_UNRESOLVED|recorded migration|orphan|absent/i);
  console.log("PASS: actual migrate.ts runner applied production-shaped fixture, skipped staging ledger matches, preserved 12 inbox + 12 event rows, no-op repeat runs, failed closed for missing historical ledger files, failed closed for an available filename recorded under the wrong version, and verified recovered 096 authorization binding plus APPROVED→REJECTED→APPROVED snapshot semantics in isolated PostgreSQL schemas.");
} finally {
  if (connected) {
    for (const schema of schemas.reverse()) {
      try { await client.query("drop schema if exists " + q(schema) + " cascade"); } catch {}
    }
    await client.end().catch(() => {});
  }
  await rm(temp, { recursive: true, force: true });
}
