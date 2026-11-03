import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dir = path.resolve("migrations");
const files = (await readdir(dir)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
const numbers = new Set();
const objects = new Map();

for (const file of files) {
  const number = Number(file.match(/^\d+/)[0]);
  if (numbers.has(number)) throw new Error(`duplicate migration number: ${number} (${file})`);
  numbers.add(number);
  const sql = await readFile(path.join(dir, file), "utf8");
  // Resolve schema-qualified names instead of treating the schema itself as
  // the object name. Unqualified CREATE TABLE/TYPE statements target public.
  const patterns = [
    /create\s+type\s+(?:if\s+not\s+exists\s+)?(?:(?<schema>[a-z0-9_]+)\s*\.\s*)?(?<name>[a-z0-9_]+)/gi,
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?<schema>[a-z0-9_]+)\s*\.\s*)?(?<name>[a-z0-9_]+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of sql.matchAll(pattern)) {
      const schema = (match.groups?.schema ?? "public").toLowerCase();
      const name = match.groups?.name?.toLowerCase();
      if (!name) continue;
      const object = `${schema}.${name}`;
      const prior = objects.get(object);
      if (prior) throw new Error(`duplicate database object '${object}' in ${prior} and ${file}`);
      objects.set(object, file);
    }
  }
}


const identitySuspensionMigration = await readFile(path.join(dir, "20261026_auth_scoped_onboarding_mutations.sql"), "utf8");
if (!/alter\s+table\s+public\.identities\s+add\s+column\s+if\s+not\s+exists\s+suspended_at\s+timestamptz/i.test(identitySuspensionMigration)) {
  throw new Error("identity suspension column must be created before the first authorization functions reference it");
}
for (const [name, sql] of [
  ["20261102", await readFile(path.join(dir, "20261102_platform_authority_bootstrap.sql"), "utf8")],
  ["20261104", await readFile(path.join(dir, "20261104_identity_bound_hierarchical_onboarding.sql"), "utf8")],
  ["20261106", await readFile(path.join(dir, "20261106_verifier_same_org_geography_scope.sql"), "utf8")],
]) {
  if (!/alter\s+table\s+public\.identities\s+add\s+column\s+if\s+not\s+exists\s+suspended_at\s+timestamptz/i.test(sql)) {
    throw new Error(`${name} must retain an idempotent suspension-column compatibility guard`);
  }
}
const verificationTriggerMigration = await readFile(path.join(dir, "008_verification_integrity.sql"), "utf8");
const verificationGuard = await readFile(path.join(dir, "20261106_verifier_same_org_geography_scope.sql"), "utf8");
const verificationPermission = await readFile(path.join(dir, "20261107_verifier_subject_org_verified.sql"), "utf8");
const geographyGuard = await readFile(path.join(dir, "20261108_geography_scope_fail_closed.sql"), "utf8");
const authorizationSnapshotMigration = await readFile(path.join(dir, "20261112_verification_authorization_snapshots.sql"), "utf8");
for (const [name, sql] of [["20261106", verificationGuard], ["20261107", verificationPermission]]) {
  if (/lower\s*\(\s*r\.name\s*\)/i.test(sql) || /r\.name\s+in\s*\(/i.test(sql)) {
    throw new Error(`${name} must not grant verifier authority by role name`);
  }
  if (!/m\.status\s*=\s*'VERIFIED'/i.test(sql) || !/m\.organization_id\s*=\s*a\.organization_id/i.test(sql)) {
    throw new Error(`${name} must bind verified membership to the subject activity organization`);
  }
  if (!/i\.status\s*=\s*'VERIFIED'/i.test(sql) || !/i\.suspended_at\s+is\s+null/i.test(sql)) {
    throw new Error(`${name} must reject unverified or suspended identities`);
  }
}
if (!/create trigger verifications_integrity_guard\s+before insert or update on verifications\s+for each row execute function prevent_invalid_verification\(\)/i.test(verificationTriggerMigration)) {
  throw new Error("subject-bound verification guard must remain attached to INSERT and UPDATE after function replacement");
}
if (!/create or replace function public\.prevent_invalid_verification\s*\(/i.test(verificationGuard)) {
  throw new Error("20261106 must replace the exact trigger function installed by the base verification migration");
}
if (!/drop trigger if exists verification_independence_guard on public\.verifications/i.test(verificationGuard)) {
  throw new Error("legacy global verification-independence trigger must be removed by the unified subject-bound guard");
}
if (!/old\.decision\s*=\s*'APPROVED'/i.test(verificationGuard) || !/new\s+is distinct from old/i.test(verificationGuard)) {
  throw new Error("approved verification rows must be immutable");
}
if (!/create trigger verification_delete_guard\s+before delete on public\.verifications\s+for each row execute function public\.prevent_verification_delete\(\)/i.test(authorizationSnapshotMigration)) {
  throw new Error("all verification decisions must be protected against DELETE");
}
if (/then\s+true\s+else\s+exists/i.test(geographyGuard) || !/a.depth\s*<\s*63/i.test(geographyGuard) || !/any\s*\(\s*a.path\s*\)/i.test(geographyGuard) || !/is_cycle/i.test(geographyGuard)) {
  throw new Error("geography authorization must fail closed and detect cyclic hierarchy traversal");
}
if (!/add column if not exists authorization_membership_id uuid/i.test(authorizationSnapshotMigration) || !/add column if not exists authorization_role_id uuid/i.test(authorizationSnapshotMigration) || !/add column if not exists authorization_permissions_snapshot jsonb/i.test(authorizationSnapshotMigration) || !/add column if not exists authorization_checked_at timestamptz/i.test(authorizationSnapshotMigration)) {
  throw new Error("verifier decisions must preserve the four production authorization snapshot fields");
}
if (!/verification_authorization_snapshot_guard/i.test(authorizationSnapshotMigration) || !/new\.authorization_membership_id is not null/i.test(authorizationSnapshotMigration) || !/verification decisions and authorization snapshots are immutable/i.test(authorizationSnapshotMigration)) {
  throw new Error("verifier authorization snapshots must be database-generated and immutable");
}

const workerRoleContract = await readFile(path.resolve("apps/src/mrv-worker-role-contract.ts"), "utf8");
const workerServer = await readFile(path.resolve("apps/src/mrv-worker-server.ts"), "utf8");
if (!/any_role_membership/i.test(workerRoleContract) || !/source_table_write/i.test(workerRoleContract) || !/job_insert/i.test(workerRoleContract) || !/provenance_delete/i.test(workerRoleContract)) {
  throw new Error("MRV worker role contract must reject inherited roles and writes outside the narrow worker sinks");
}
if (!/assertMrvWorkerRoleContract\(identity\.rows\[0\]\)/i.test(workerServer) || !/rejectUnauthorized:\s*true/i.test(workerServer) || !/MRV_WORKER_TLS_REQUIRED_IN_PRODUCTION/i.test(workerServer)) {
  throw new Error("MRV worker must enforce its dedicated role contract and verified TLS");
}

const restrictedWorkerServer = await readFile(path.resolve("apps/src/mrv-worker-server-restricted.ts"), "utf8");
const workerBoundaryAcceptance = await readFile(path.resolve("tests/postgres/mrv-worker-api-boundary.acceptance.sql"), "utf8");
const workerJobs = await readFile(path.resolve("apps/src/mrv-submission-jobs.ts"), "utf8");
const claimIndexMigration = await readFile(path.join(dir, "20261113_mrv_worker_claim_index_reconcile.sql"), "utf8");
const protectedWorkerTables = [
  "organizations", "identities", "organization_memberships", "roles", "activities",
  "evidence", "verifications", "geography", "organization_geography_scopes",
  "mrv_observations", "measurements", "mrv_submission_jobs",
  "mrv_submission_job_events", "mrv_provenance_events",
];
const requiredTableList = restrictedWorkerServer.match(/const requiredTables = \[([\s\S]*?)\];/);
if (!requiredTableList) throw new Error("restricted MRV worker must declare its complete RLS preflight table list");
for (const table of protectedWorkerTables) {
  if (!new RegExp(`["']${table}["']`).test(requiredTableList[1])) {
    throw new Error(`restricted MRV worker RLS preflight omits public.${table}`);
  }
  if (!new RegExp(`["']${table}["']`).test(workerBoundaryAcceptance)) {
    throw new Error(`MRV PostgreSQL acceptance gate omits public.${table}`);
  }
}
const claimableBlock = workerJobs.match(/const claimableStatuses\s*:\s*MrvJobStatus\[\]\s*=\s*\[([\s\S]*?)\];/);
const claimIndexBlock = claimIndexMigration.match(/where\s+status\s+in\s*\(([\s\S]*?)\);/i);
if (!claimableBlock || !claimIndexBlock) throw new Error("MRV worker claim allow-list and claim index must both be explicit");
const workerStatuses = [...claimableBlock[1].matchAll(/"([A-Z_]+)"/g)].map((match) => match[1]).sort();
const indexedStatuses = [...claimIndexBlock[1].matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]).sort();
if (JSON.stringify(workerStatuses) !== JSON.stringify(indexedStatuses)) {
  throw new Error("MRV claim index predicate must exactly match worker claimableStatuses");
}
if (!/on\s+mrv_submission_jobs\s*\(next_attempt_at,\s*created_at,\s*id\)/i.test(claimIndexMigration)) {
  throw new Error("MRV claim index must preserve deterministic next_attempt_at, created_at, id ordering");
}
if (indexedStatuses.includes("NEEDS_RECONCILIATION")) {
  throw new Error("MRV quarantine status must not be automatically claimable");
}
if (!/organization_geography_scopes/.test(workerBoundaryAcceptance)) {
  throw new Error("MRV PostgreSQL acceptance must enforce RLS on organization_geography_scopes");
}

const migrationRunner = await readFile(path.resolve("apps/src/migrate.ts"), "utf8");
const migrationIntegrity = await readFile(path.resolve("apps/src/migration-integrity.ts"), "utf8");
const migrationIntegrityTests = await readFile(path.resolve("apps/src/migration-integrity.test.ts"), "utf8");
if (!/add column if not exists checksum_sha256 text/i.test(migrationRunner) ||
    !/sha256Hex\(bytes\)/.test(migrationRunner) ||
    !/assertNoOrphanedMigrations\(/.test(migrationRunner) ||
    !/checksum_sha256\) values/i.test(migrationRunner) ||
    !/LEGACY_UNVERIFIED: non-empty migration ledger/.test(migrationRunner) ||
    !/TextDecoder\("utf-8", \{ fatal: true \}\)/.test(migrationRunner) ||
    !/JSON\.stringify\(migrationReport/.test(migrationRunner)) {
  throw new Error("migration runner must atomically record exact-byte SHA-256 and reconcile all existing ledger rows before applying new migrations");
}
for (const failure of ["LEGACY_UNVERIFIED", "MIGRATION_CHECKSUM_DRIFT", "MIGRATION_FILENAME_DRIFT", "MIGRATION_LEDGER_ORPHAN", "MIGRATION_CHECKSUM_INVALID"]) {
  if (!migrationIntegrity.includes(failure)) throw new Error(`migration integrity helper must fail closed for ${failure}`);
  if (!migrationIntegrityTests.includes(failure)) throw new Error(`migration integrity tests must cover ${failure}`);
}
if (!/assertCriticalPostconditions\(client, migration\.filename\)/.test(migrationRunner) ||
    !/assertCriticalPostconditions\(lock, migration\.filename\)/.test(migrationRunner) ||
    !/mrv_submission_job_events/.test(migrationRunner) ||
    !/mrv_submission_jobs_claim_idx/.test(migrationRunner)) {
  throw new Error("critical MRV migrations must assert actual PostgreSQL catalog postconditions before ledger commit");
}

console.log(`Validated ${files.length} migrations, ${objects.size} schema objects, checksum integrity and critical MRV catalog gates.`);
