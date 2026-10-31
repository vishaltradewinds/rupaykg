import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

if (process.env.RUPAYKG_RUN_AUTHORIZATION_PROVENANCE_TESTS !== "1") {
  console.log("Skipped authorization provenance regression (explicit disposable-DB gate not enabled).");
  process.exit(0);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const { Client } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(here, "fixtures", "authorization-provenance");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
});
const schema = "authorization_provenance_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
const q = (value) => '"' + value.replaceAll('"', '""') + '"';
try {
  await client.connect();
  await client.query("create schema " + q(schema));
  await client.query("set search_path to " + q(schema) + ", public");
  await client.query(`
    create table organizations(id uuid primary key);
    create table identities(id uuid primary key, status text not null, suspended_at timestamptz);
    create table roles(id uuid primary key, permissions jsonb not null);
    create table organization_memberships(
      id uuid primary key, identity_id uuid not null references identities(id),
      organization_id uuid not null references organizations(id), role_id uuid not null references roles(id),
      status text not null, created_at timestamptz not null default now()
    );
    create table activities(id uuid primary key, actor_identity_id uuid, organization_id uuid references organizations(id));
    create table evidence(id uuid primary key, activity_id uuid references activities(id));
    create table verifications(
      id uuid primary key, activity_id uuid references activities(id), evidence_id uuid references evidence(id),
      verifier_identity_id uuid not null references identities(id), decision text not null
    );
  `);
  await client.query(await readFile(path.join(fixtureDir, "096_verification_authorization_provenance.sql"), "utf8"));
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
  await client.query("insert into roles(id,permissions) values ($1,$2::jsonb)", [ids.role, JSON.stringify(["VERIFY_EVIDENCE"])]);
  await client.query("insert into organization_memberships(id,identity_id,organization_id,role_id,status) values ($1,$2,$3,$4,'VERIFIED')", [ids.membership, ids.verifier, ids.org, ids.role]);
  await client.query("insert into activities(id,actor_identity_id,organization_id) values ($1,$2,$3)", [ids.activity, ids.actor, ids.org]);
  await client.query("insert into evidence(id,activity_id) values ($1,$2)", [ids.evidence, ids.activity]);
  await client.query("insert into verifications(id,activity_id,evidence_id,verifier_identity_id,decision) values ($1,$2,$3,$4,'APPROVED')", [ids.verification, ids.activity, ids.evidence, ids.verifier]);
  const selectSnapshot = () => client.query(
    "select authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at from verifications where id=$1",
    [ids.verification],
  ).then((result) => result.rows[0]);
  const original = await selectSnapshot();
  assert.deepEqual(original.authorization_permissions_snapshot, ["VERIFY_EVIDENCE"]);
  assert.ok(original.authorization_checked_at);

  // Reproduce the recovered legacy behavior in disposable PostgreSQL.
  await client.query("update roles set permissions=$2::jsonb where id=$1", [ids.role, JSON.stringify(["VERIFY_EVIDENCE", "UNRELATED_PERMISSION"])]);
  await client.query("update verifications set evidence_id=evidence_id where id=$1", [ids.verification]);
  const legacyAfterUpdate = await selectSnapshot();
  assert.deepEqual(legacyAfterUpdate.authorization_permissions_snapshot, ["VERIFY_EVIDENCE", "UNRELATED_PERMISSION"]);
  assert.notEqual(legacyAfterUpdate.authorization_checked_at.getTime(), original.authorization_checked_at.getTime());
  console.log("PASS: reproduced legacy authorization snapshot rewrite on unrelated UPDATE.");

  // Seed rows that predate migration 096: their new provenance columns must
  // remain NULL when the forward migration is applied. The trigger is disabled
  // only in this isolated disposable schema to model that historical state.
  const legacyApprovedId = "10000000-0000-4000-8000-000000000021";
  const legacyRejectedId = "10000000-0000-4000-8000-000000000022";
  await client.query("alter table verifications disable trigger verifications_integrity_guard");
  await client.query(
    "insert into verifications(id,activity_id,evidence_id,verifier_identity_id,decision) values ($1,$3,$4,$5,'APPROVED'),($2,$3,$4,$5,'REJECTED')",
    [legacyApprovedId, legacyRejectedId, ids.activity, ids.evidence, ids.verifier],
  );
  await client.query("alter table verifications enable trigger verifications_integrity_guard");

  // Apply proposed semantics only in this disposable schema.
  await client.query(await readFile(path.join(fixtureDir, "proposed-authorization-provenance-forward-fix.sql"), "utf8"));
  const legacyRows = await client.query(
    "select id,decision,authorization_history_state,authorization_checked_at from verifications where id=any($1::uuid[]) order by id",
    [[legacyApprovedId, legacyRejectedId]],
  );
  const legacyApproved = legacyRows.rows.find((row) => row.id === legacyApprovedId);
  const legacyRejected = legacyRows.rows.find((row) => row.id === legacyRejectedId);
  assert.equal(legacyApproved.authorization_history_state, "APPROVED_HISTORY");
  assert.equal(legacyApproved.authorization_checked_at, null, "do not fabricate legacy approval timestamp");
  assert.equal(legacyRejected.authorization_history_state, "REJECTED_TERMINAL");
  await client.query("update verifications set decision='REJECTED' where id=$1", [legacyApprovedId]);
  const legacyApprovedAfterRejection = (await client.query(
    "select authorization_history_state,authorization_checked_at from verifications where id=$1",
    [legacyApprovedId],
  )).rows[0];
  assert.equal(legacyApprovedAfterRejection.authorization_history_state, "APPROVED_HISTORY");
  assert.equal(legacyApprovedAfterRejection.authorization_checked_at, null);
  await assert.rejects(
    client.query("update verifications set decision='APPROVED' where id=$1", [legacyApprovedId]),
    /reapproval of a previously approved verification/,
  );
  await assert.rejects(
    client.query("update verifications set decision='APPROVED' where id=$1", [legacyRejectedId]),
    /rejected verification is terminal/,
  );
  await client.query("update verifications set decision='REJECTED' where id=$1", [legacyRejectedId]);
  console.log("PASS: legacy approved rows with NULL timestamps retain approval history; legacy rejected rows fail closed.");

  const baseline = await selectSnapshot();
  await client.query("update roles set permissions=$2::jsonb where id=$1", [ids.role, JSON.stringify(["VERIFY_EVIDENCE", "ROLE_CHANGED"])]);
  await client.query("update verifications set evidence_id=evidence_id where id=$1", [ids.verification]);
  const afterUnrelatedUpdate = await selectSnapshot();
  assert.equal(afterUnrelatedUpdate.authorization_membership_id, baseline.authorization_membership_id);
  assert.equal(afterUnrelatedUpdate.authorization_role_id, baseline.authorization_role_id);
  assert.deepEqual(afterUnrelatedUpdate.authorization_permissions_snapshot, baseline.authorization_permissions_snapshot);
  assert.equal(afterUnrelatedUpdate.authorization_checked_at.getTime(), baseline.authorization_checked_at.getTime());

  // Role revocation must not rewrite historical evidence on unrelated updates.
  await client.query("update roles set permissions='[]'::jsonb where id=$1", [ids.role]);
  await client.query("update verifications set evidence_id=evidence_id where id=$1", [ids.verification]);
  const afterRevocation = await selectSnapshot();
  assert.deepEqual(afterRevocation.authorization_permissions_snapshot, baseline.authorization_permissions_snapshot);
  assert.equal(afterRevocation.authorization_checked_at.getTime(), baseline.authorization_checked_at.getTime());

  // Linkage must remain immutable even when an approved row is transitioned
  // away from APPROVED; otherwise the preserved snapshot can be rebound.
  const replacementActivity = "10000000-0000-4000-8000-000000000012";
  const replacementEvidence = "10000000-0000-4000-8000-000000000013";
  await client.query("insert into activities(id,actor_identity_id,organization_id) values ($1,$2,$3)", [replacementActivity, ids.actor, ids.org]);
  await client.query("insert into evidence(id,activity_id) values ($1,$2)", [replacementEvidence, replacementActivity]);
  await assert.rejects(
    client.query("update verifications set activity_id=$2,evidence_id=$3 where id=$1", [ids.verification, replacementActivity, replacementEvidence]),
    /approved verification linkage is immutable/,
  );
  await assert.rejects(
    client.query("update verifications set decision='REJECTED',activity_id=$2,evidence_id=$3 where id=$1", [ids.verification, replacementActivity, replacementEvidence]),
    /approved verification linkage is immutable/,
  );
  await assert.rejects(
    client.query("update verifications set decision='REJECTED',verifier_identity_id=$2 where id=$1", [ids.verification, ids.actor]),
    /approved verification linkage is immutable/,
  );

  // Transitioning away from APPROVED without changing the linkage retains
  // the original authorization snapshot as historical provenance.
  await client.query("update verifications set decision='REJECTED' where id=$1", [ids.verification]);
  const afterRejection = await selectSnapshot();
  assert.equal(afterRejection.authorization_membership_id, baseline.authorization_membership_id);
  assert.equal(afterRejection.authorization_role_id, baseline.authorization_role_id);
  assert.deepEqual(afterRejection.authorization_permissions_snapshot, baseline.authorization_permissions_snapshot);
  assert.equal(afterRejection.authorization_checked_at.getTime(), baseline.authorization_checked_at.getTime());

  // Historical provenance remains immutable on subsequent updates after the
  // row has left APPROVED, and direct reapproval requires a separate audited path.
  await client.query("update verifications set decision='REJECTED' where id=$1", [ids.verification]);
  const afterSecondUpdate = await selectSnapshot();
  assert.equal(afterSecondUpdate.authorization_membership_id, baseline.authorization_membership_id);
  assert.equal(afterSecondUpdate.authorization_role_id, baseline.authorization_role_id);
  assert.deepEqual(afterSecondUpdate.authorization_permissions_snapshot, baseline.authorization_permissions_snapshot);
  assert.equal(afterSecondUpdate.authorization_checked_at.getTime(), baseline.authorization_checked_at.getTime());
  await assert.rejects(
    client.query("update verifications set decision='APPROVED' where id=$1", [ids.verification]),
    /explicit audited reapproval workflow/,
  );
  await assert.rejects(
    client.query("update verifications set activity_id=$2,evidence_id=$3 where id=$1", [ids.verification, replacementActivity, replacementEvidence]),
    /approved verification linkage is immutable/,
  );

  // Non-approved rows cannot bring caller-supplied snapshots, and approval
  // transitions re-check current role permissions.
  const pendingId = "10000000-0000-4000-8000-000000000014";
  await client.query(
    "insert into verifications(id,activity_id,evidence_id,verifier_identity_id,decision,authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at) values ($1,$2,$3,$4,'PENDING',$5,$6,$7,now())",
    [pendingId, ids.activity, ids.evidence, ids.verifier, ids.membership, ids.role, JSON.stringify(["FORGED"])],
  );
  const pending = (await client.query("select authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at from verifications where id=$1", [pendingId])).rows[0];
  assert.equal(pending.authorization_membership_id, null);
  assert.equal(pending.authorization_role_id, null);
  assert.equal(pending.authorization_permissions_snapshot, null);
  assert.equal(pending.authorization_checked_at, null);
  await assert.rejects(
    client.query("update verifications set decision='APPROVED' where id=$1", [pendingId]),
    /requires active verifier permission/,
  );
  await client.query("update roles set permissions=$2::jsonb where id=$1", [ids.role, JSON.stringify(["VERIFY_EVIDENCE"])]);
  await client.query("update verifications set decision='APPROVED' where id=$1", [pendingId]);
  const approvedAgain = (await client.query("select authorization_membership_id,authorization_role_id,authorization_permissions_snapshot,authorization_checked_at from verifications where id=$1", [pendingId])).rows[0];
  assert.equal(approvedAgain.authorization_membership_id, ids.membership);
  assert.equal(approvedAgain.authorization_role_id, ids.role);
  assert.deepEqual(approvedAgain.authorization_permissions_snapshot, ["VERIFY_EVIDENCE"]);
  assert.ok(approvedAgain.authorization_checked_at);
  assert.equal(approvedAgain.authorization_history_state, "APPROVED_HISTORY");
  console.log("PASS: proposed forward-only semantics preserve snapshots, reject linkage swaps, clear forged pending snapshots, and re-check authorization on approval transition.");
} finally {
  try { await client.query("drop schema if exists " + q(schema) + " cascade"); } catch {}
  await client.end().catch(() => {});
}
