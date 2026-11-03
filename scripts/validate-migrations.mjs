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
if (!/create trigger approved_verification_delete_guard\s+before delete on public\.verifications\s+for each row execute function public\.prevent_approved_verification_delete\(\)/i.test(verificationGuard)) {
  throw new Error("approved verification rows must be protected against DELETE");
}
if (/then\s+true\s+else\s+exists/i.test(geographyGuard) || !/a.depth\s*<\s*63/i.test(geographyGuard) || !/any\s*\(\s*a.path\s*\)/i.test(geographyGuard)) {
  throw new Error("geography authorization must fail closed and bound cyclic hierarchy traversal");
}

if (!/add column if not exists authorization_snapshot jsonb/i.test(authorizationSnapshotMigration) || !/add column if not exists authorization_snapshot_hash text/i.test(authorizationSnapshotMigration)) {
  throw new Error("verifier decisions must persist authorization snapshots and hashes");
}
if (!/verification_authorization_snapshot_guard/i.test(authorizationSnapshotMigration) || !/new\.authorization_snapshot is not null/i.test(authorizationSnapshotMigration) || !/authorization snapshot is immutable/i.test(authorizationSnapshotMigration)) {
  throw new Error("verifier authorization snapshots must be database-generated and immutable");
}

console.log(`Validated ${files.length} migrations, ${objects.size} schema objects and verification/geography guardrails.`);
