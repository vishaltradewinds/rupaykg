import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
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
const checksumMismatchSchema = "runner_checksum_mismatch_" + suffix;
const checksumMatchSchema = "runner_checksum_match_" + suffix;
const checksumMissingSchema = "runner_checksum_missing_" + suffix;
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
  for (const schema of [productionSchema, stagingSchema, productionHistorySchema, stagingHistorySchema, verificationSchema, versionMismatchSchema, checksumMismatchSchema, checksumMatchSchema, checksumMissingSchema]) {
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
  const prodLedger = (await client.query("select version, filename, source_sha256 from schema_migrations order by version")).rows;
  assert.deepEqual(prodLedger.map(x => x.filename), names);
  for (const row of prodLedger) {
    const bytes = await readFile(path.join(migrationDir, row.filename));
    assert.equal(row.source_sha256, createHash("sha256").update(bytes).digest("hex"), "newly applied migrations must record exact SQL-byte SHA-256");
  }
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
  assert.equal((await client.query("select count(*)::int n from schema_migrations where source_sha256 is null")).rows[0].n, 4,
    "legacy rows without a trusted digest must remain explicitly unattested rather than being backfilled");
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
  // A same-name/same-version SQL edit must fail before any migration SQL executes.
  const checksumMismatchCatalog = path.join(temp, "checksum-mismatch-release");
  await mkdir(checksumMismatchCatalog);
  const originalChecksumSql = "create table checksum_sentinel(marker text);\n";
  const alteredChecksumSql = "insert into checksum_sentinel(marker) values ('ALTERED_SQL_EXECUTED');\n";
  const checksumFilename = "001_checksum_guard.sql";
  await writeFile(path.join(checksumMismatchCatalog, checksumFilename), alteredChecksumSql, "utf8");
  await setSchema(checksumMismatchSchema);
  await client.query("create table checksum_sentinel(marker text)");
  await client.query("create table schema_migrations(version text primary key, filename text not null, applied_at timestamptz not null default now(), source_sha256 text)");
  await client.query("insert into schema_migrations(version,filename,source_sha256) values ('001',$1,$2)", [checksumFilename, createHash("sha256").update(originalChecksumSql).digest("hex")]);
  const checksumMismatch = runRunner(checksumMismatchSchema, checksumMismatchCatalog);
  assert.notEqual(checksumMismatch.status, 0, "runner must reject altered SQL bytes under the same filename/version");
  assert.match(checksumMismatch.stderr + checksumMismatch.stdout, /SOURCE_CHECKSUM_MISMATCH/);
  await setSchema(checksumMismatchSchema);
  assert.equal((await client.query("select count(*)::int n from checksum_sentinel")).rows[0].n, 0, "checksum mismatch must fail before altered SQL executes");

  // A row marked checksum-required must fail closed if its digest is absent.
  const checksumMissingCatalog = path.join(temp, "checksum-missing-release");
  await mkdir(checksumMissingCatalog);
  const missingFilename = "001_required_digest.sql";
  const missingSql = "insert into required_digest_sentinel(marker) values ('SHOULD_NOT_RUN');\\n";
  await writeFile(path.join(checksumMissingCatalog, missingFilename), missingSql, "utf8");
  await setSchema(checksumMissingSchema);
  await client.query("create table required_digest_sentinel(marker text)");
  await client.query("create table schema_migrations(version text primary key, filename text not null, applied_at timestamptz not null default now(), source_sha256 text, source_sha256_required boolean not null default false)");
  await client.query("insert into schema_migrations(version,filename,source_sha256,source_sha256_required) values ('001',$1,$2,true)", [missingFilename, createHash("sha256").update(missingSql).digest("hex")]);
  await client.query("alter table schema_migrations drop constraint if exists schema_migrations_source_sha256_required_check");
  await client.query("update schema_migrations set source_sha256=null where version='001'");
  const checksumMissing = runRunner(checksumMissingSchema, checksumMissingCatalog);
  assert.notEqual(checksumMissing.status, 0, "runner must reject missing digest on checksum-required row");
  assert.match(checksumMissing.stderr + checksumMissing.stdout, /REQUIRED_SOURCE_CHECKSUM_MISSING/);
  await setSchema(checksumMissingSchema);
  assert.equal((await client.query("select count(*)::int n from required_digest_sentinel")).rows[0].n, 0, "missing required digest must fail before pending SQL executes");

  // A matching historical digest is accepted; a newly applied migration is hashed.
  const checksumMatchCatalog = path.join(temp, "checksum-match-release");
  await mkdir(checksumMatchCatalog);
  const baselineSql = "create table checksum_baseline(marker text);\n";
  const pendingSql = "create table checksum_pending(marker text);\n";
  await writeFile(path.join(checksumMatchCatalog, "001_baseline.sql"), baselineSql, "utf8");
  await writeFile(path.join(checksumMatchCatalog, "002_pending.sql"), pendingSql, "utf8");
  await setSchema(checksumMatchSchema);
  await client.query("create table checksum_baseline(marker text)");
  await client.query("create table schema_migrations(version text primary key, filename text not null, applied_at timestamptz not null default now(), source_sha256 text)");
  await client.query("insert into schema_migrations(version,filename,source_sha256) values ('001','001_baseline.sql',$1)", [createHash("sha256").update(baselineSql).digest("hex")]);
  const checksumMatch = runRunner(checksumMatchSchema, checksumMatchCatalog);
  assert.equal(checksumMatch.status, 0, "matching recorded digest must pass and pending migration should apply: " + checksumMatch.stderr + checksumMatch.stdout);
  await setSchema(checksumMatchSchema);
  const pendingLedger = (await client.query("select source_sha256 from schema_migrations where version='002'")).rows[0];
  assert.equal(pendingLedger.source_sha256, createHash("sha256").update(pendingSql).digest("hex"), "new migration ledger row must store the exact source digest");
  assert.equal((await client.query("select to_regclass($1) is not null as yes", [checksumMatchSchema + ".checksum_pending"])).rows[0].yes, true);
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

  // Security regression reproduction: an UPDATE that does not change the
  // decision currently refreshes the supposedly historical authorization
  // snapshot. This is diagnostic evidence against the recovered legacy trigger,
  // not an assertion that this behavior is acceptable.
  await client.query("update roles set permissions=$2::jsonb where id=$1", [ids.role, JSON.stringify(["VERIFY_EVIDENCE", "UNRELATED_PERMISSION"])]);
  await client.query("update verifications set evidence_id=evidence_id where id=$1", [ids.verification]);
  const afterUnrelatedUpdate = (await client.query(
    "select authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at from verifications where id=$1",
    [ids.verification],
  )).rows[0];
  assert.equal(afterUnrelatedUpdate.authorization_membership_id, ids.membership);
  assert.equal(afterUnrelatedUpdate.authorization_role_id, ids.role);
  assert.deepEqual(afterUnrelatedUpdate.authorization_permissions_snapshot, ["VERIFY_EVIDENCE", "UNRELATED_PERMISSION"],
    "REPRODUCED DEFECT: unrelated update rewrites the decision-time permissions snapshot from the current role");
  assert.notEqual(afterUnrelatedUpdate.authorization_checked_at.getTime(), snapshot.authorization_checked_at.getTime(),
    "REPRODUCED DEFECT: unrelated update refreshes the purported decision-time authorization timestamp");
  // Restore the fixture's original role permission set and refresh the test row
  // so subsequent assertions remain isolated to the intended decision path.
  await client.query("update roles set permissions=$2::jsonb where id=$1", [ids.role, JSON.stringify(["VERIFY_EVIDENCE"])]);
  await client.query("update verifications set evidence_id=evidence_id where id=$1", [ids.verification]);

  // Install a disposable-only candidate guard after reproducing the legacy defect.
  // This is not a numbered migration and is not applied to any live database.
  // Approved decision linkage is immutable; unrelated updates preserve the original
  // authorization snapshot; a fresh transition into APPROVED rechecks live authority.
  await client.query(`
    create or replace function prevent_invalid_verification()
    returns trigger
    language plpgsql
    as $candidate$
    declare
      resolved_activity_id uuid;
      activity_actor uuid;
      activity_organization_id uuid;
      membership_row record;
      evidence_activity_id uuid;
    begin
      if tg_op = 'UPDATE' then
        if old.decision = 'APPROVED' and (
          new.verifier_identity_id is distinct from old.verifier_identity_id
          or new.activity_id is distinct from old.activity_id
          or new.evidence_id is distinct from old.evidence_id
        ) then
          raise exception 'approved verification linkage is immutable; use an audited correction path';
        end if;

        if new.decision <> 'APPROVED' or old.decision = 'APPROVED' then
          new.authorization_membership_id := old.authorization_membership_id;
          new.authorization_role_id := old.authorization_role_id;
          new.authorization_permissions_snapshot := old.authorization_permissions_snapshot;
          new.authorization_checked_at := old.authorization_checked_at;

          if old.decision = 'APPROVED' and new.decision = 'APPROVED' then
            return new;
          end if;

          if new.decision <> 'APPROVED' then
            return new;
          end if;
        end if;
      end if;

      resolved_activity_id := new.activity_id;
      if new.evidence_id is not null then
        select e.activity_id into evidence_activity_id from evidence e where e.id = new.evidence_id;
        if evidence_activity_id is null then
          raise exception 'verification evidence must be bound to an activity';
        end if;
        if resolved_activity_id is not null and resolved_activity_id is distinct from evidence_activity_id then
          raise exception 'verification activity must match the evidence activity';
        end if;
        resolved_activity_id := evidence_activity_id;
        new.activity_id := evidence_activity_id;
      end if;

      if resolved_activity_id is not null then
        select a.actor_identity_id, a.organization_id into activity_actor, activity_organization_id
        from activities a where a.id = resolved_activity_id;
      end if;

      if new.decision = 'APPROVED' then
        if activity_organization_id is null then
          raise exception 'approved verification requires an activity with an organization';
        end if;
        if activity_actor is not null and activity_actor = new.verifier_identity_id then
          raise exception 'activity actor cannot verify its own evidence';
        end if;

        select m.id as membership_id, m.role_id, r.permissions into membership_row
        from organization_memberships m
        join roles r on r.id = m.role_id
        join identities i on i.id = m.identity_id
        where m.identity_id = new.verifier_identity_id
          and m.organization_id = activity_organization_id
          and m.status = 'VERIFIED'
          and i.status = 'VERIFIED'
          and i.suspended_at is null
          and (
            r.permissions @> '["VERIFY_EVIDENCE"]'::jsonb
            or r.permissions @> '["verification:approve"]'::jsonb
            or r.permissions @> '["verification.approve"]'::jsonb
          )
        order by m.created_at desc
        limit 1;

        if membership_row.membership_id is null then
          raise exception 'approved verification requires active verifier permission in the activity organization';
        end if;

        new.authorization_membership_id := membership_row.membership_id;
        new.authorization_role_id := membership_row.role_id;
        new.authorization_permissions_snapshot := membership_row.permissions;
        new.authorization_checked_at := now();
      end if;

      return new;
    end;
    $candidate$;
  `);

  const candidateBaseline = (await client.query(
    "select authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at from verifications where id=$1",
    [ids.verification],
  )).rows[0];
  await client.query("update roles set permissions=$2::jsonb where id=$1", [ids.role, JSON.stringify(["VERIFY_EVIDENCE", "UNRELATED_PERMISSION"])]);
  await client.query("update verifications set evidence_id=evidence_id where id=$1", [ids.verification]);
  const afterCandidateUnrelatedUpdate = (await client.query(
    "select authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at from verifications where id=$1",
    [ids.verification],
  )).rows[0];
  assert.equal(afterCandidateUnrelatedUpdate.authorization_membership_id, candidateBaseline.authorization_membership_id);
  assert.equal(afterCandidateUnrelatedUpdate.authorization_role_id, candidateBaseline.authorization_role_id);
  assert.deepEqual(afterCandidateUnrelatedUpdate.authorization_permissions_snapshot, candidateBaseline.authorization_permissions_snapshot,
    "candidate guard must preserve the decision-time permissions snapshot on unrelated updates");
  assert.equal(afterCandidateUnrelatedUpdate.authorization_checked_at.getTime(), candidateBaseline.authorization_checked_at.getTime(),
    "candidate guard must preserve the decision-time timestamp on unrelated updates");

  await assert.rejects(
    client.query("update verifications set evidence_id=null where id=$1", [ids.verification]),
    /approved verification linkage is immutable/,
    "approved evidence linkage must not be silently swapped",
  );
  await client.query("update verifications set authorization_permissions_snapshot='[]'::jsonb where id=$1", [ids.verification]);
  const afterForgedSnapshotAttempt = (await client.query(
    "select authorization_permissions_snapshot,authorization_checked_at from verifications where id=$1",
    [ids.verification],
  )).rows[0];
  assert.deepEqual(afterForgedSnapshotAttempt.authorization_permissions_snapshot, candidateBaseline.authorization_permissions_snapshot,
    "direct snapshot edits must not overwrite decision-time provenance");
  assert.equal(afterForgedSnapshotAttempt.authorization_checked_at.getTime(), candidateBaseline.authorization_checked_at.getTime());

  // Revoking the role after approval must not rewrite historical provenance.
  await client.query("update roles set permissions='[]'::jsonb where id=$1", [ids.role]);
  await client.query("update verifications set evidence_id=evidence_id where id=$1", [ids.verification]);
  const afterRevocationUnrelatedUpdate = (await client.query(
    "select authorization_permissions_snapshot,authorization_checked_at from verifications where id=$1",
    [ids.verification],
  )).rows[0];
  assert.deepEqual(afterRevocationUnrelatedUpdate.authorization_permissions_snapshot, candidateBaseline.authorization_permissions_snapshot);
  assert.equal(afterRevocationUnrelatedUpdate.authorization_checked_at.getTime(), candidateBaseline.authorization_checked_at.getTime());

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
  await assert.rejects(
    client.query("update verifications set decision='APPROVED' where id=$1", [ids.verification]),
    /requires active verifier permission/,
    "re-approval after revocation must fail closed",
  );
  await client.query("update roles set permissions=$2::jsonb where id=$1", [ids.role, JSON.stringify(["VERIFY_EVIDENCE"])]);
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
  console.log("PASS: actual migrate.ts runner records and verifies SHA-256 SQL source digests, rejects altered SQL and missing required digests before execution, preserves legacy NULL digests without false attestation, preserves 12 inbox + 12 event rows, no-op repeat runs, fails closed for missing history/version conflicts, and verifies recovered 096 authorization semantics in isolated PostgreSQL schemas.");
} finally {
  if (connected) {
    for (const schema of schemas.reverse()) {
      try { await client.query("drop schema if exists " + q(schema) + " cascade"); } catch {}
    }
    await client.end().catch(() => {});
  }
  await rm(temp, { recursive: true, force: true });
}
