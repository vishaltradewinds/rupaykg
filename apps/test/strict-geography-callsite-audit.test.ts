import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const legacyFallbackForbiddenSourceFiles = [
  "acceptance-seed.ts",
  "async-mirror-routes.ts",
  "async-mirror-worker.ts",
  "auth-routes.ts",
  "auth.ts",
  "bwg-routes.ts",
  "cpcb-swm-routes.ts",
  "epr-return-routes.ts",
  "evidence-vault-routes.ts",
  "evidence-vault-store.ts",
  "gov-bridge-routes.ts",
  "government-inbox-operational-alerts.ts",
  "government-inbox-worker-runner.ts",
  "government-inbox-worker-scheduler.ts",
  "government-jurisdiction-crosswalk-routes.ts",
  "guardian-mrv.ts",
  "hedera-anchor.ts",
  "intelligence-evidence-intake.ts",
  "intelligence-routes.ts",
  "mrv-routes.ts",
  "onboarding-hierarchy-routes.ts",
  "platform-admin-routes.ts",
  "production-config.ts",
  "production-server.ts",
  "registry-routes.ts",
  "server.ts",
  "statutory-routes.ts",
  "sync-routes.ts",
  "value-routes.ts",
  "workspace-routes.ts",
];

const highImpactRouteFiles = [
  "server.ts",
  "mrv-routes.ts",
  "epr-return-routes.ts",
  "statutory-routes.ts",
  "value-routes.ts",
  "cpcb-swm-routes.ts",
  "evidence-vault-routes.ts",
  "sync-routes.ts",
  "workspace-routes.ts",
];

function sourceFor(fileName: string): string {
  const path = [
    `../src/${fileName}`,
    `../../src/${fileName}`,
  ].map((relative) => fileURLToPath(new URL(relative, import.meta.url))).find(existsSync);
  if (!path) throw new Error(`Source file not found: ${fileName}`);
  return readFileSync(path, "utf8");
}

test("reviewed authorization-sensitive source files never use the permissive legacy geography helper", () => {
  for (const fileName of legacyFallbackForbiddenSourceFiles) {
    const source = sourceFor(fileName);
    assert.doesNotMatch(
      source,
      /\borganization_has_geography_scope\s*\(/,
      `${fileName} must not authorize high-impact work using the legacy unscoped fallback`,
    );
  }
});

test("high-impact route call sites use the strict geography helper", () => {
  for (const fileName of highImpactRouteFiles) {
    assert.match(
      sourceFor(fileName),
      /\borganization_has_explicit_geography_scope\s*\(/,
      `${fileName} must retain explicit verified geography-scope authorization`,
    );
  }
});

test("database EPR evidence guards require explicit verified geography scope", () => {
  const migrationPath = [
    "../../migrations/20261115_strict_epr_evidence_geography.sql",
    "../../../migrations/20261115_strict_epr_evidence_geography.sql",
  ].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
  if (!migrationPath) throw new Error("Strict EPR evidence geography migration not found");
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(migration, /create or replace function enforce_epr_external_registration_evidence\s*\(/i);
  assert.match(migration, /create or replace function enforce_epr_transfer_evidence\s*\(/i);
  assert.equal(
    (migration.match(/\borganization_has_explicit_geography_scope\s*\(/g) ?? []).length,
    2,
    "both EPR evidence guards must enforce explicit geography scope",
  );
  assert.doesNotMatch(
    migration,
    /\borganization_has_geography_scope\s*\(/,
    "strict EPR evidence guards must not use the permissive legacy geography helper",
  );
});

test("submitted EPR returns require bound, approved, provenance-backed and explicitly scoped evidence", () => {
  const migrationPath = [
    "../../migrations/20261126_strict_epr_return_evidence_geography.sql",
    "../../../migrations/20261126_strict_epr_return_evidence_geography.sql",
  ].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
  if (!migrationPath) throw new Error("Strict EPR return evidence geography migration not found");
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(migration, /create or replace function enforce_epr_return_submission_evidence\s*\(/i);
  assert.match(migration, /new\.status in \('SUBMITTED','ACCEPTED','COMPLETED'\)/i);
  assert.match(migration, /new\.evidence_id is null or new\.verification_id is null or new\.obligation_id is null/i);
  assert.match(migration, /v\.evidence_id = e\.id[\s\S]*?v\.activity_id = a\.id[\s\S]*?v\.decision = 'APPROVED'/i);
  assert.match(migration, /organization_has_explicit_geography_scope\(a\.organization_id, a\.geography_id\)/i);
  assert.match(migration, /before insert or update of status, organization_id, scheme_id, obligation_id, period_start, period_end, evidence_id, verification_id[\s\S]*?on epr_returns/i);
});

test("EPR value-claim trigger covers eligibility transitions and enforces scoped immutable provenance", () => {
  const migrationPath = [
    "../../migrations/20261127_strict_epr_credit_value_claims.sql",
    "../../../migrations/20261127_strict_epr_credit_value_claims.sql",
  ].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
  if (!migrationPath) throw new Error("Strict EPR credit value-claim migration not found");
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(migration, /create or replace function record_epr_credit_value_claim\s*\(/i);
  assert.match(migration, /after insert or update of status, activity_id, evidence_id, verification_id, scheme_id, issuer_organization_id, recycler_organization_id, quantity, unit\s*on epr_credits/i);
  assert.match(migration, /organization_has_explicit_geography_scope\s*\(\s*a\.organization_id,\s*a\.geography_id\s*\)/i);
  assert.match(migration, /EPR_CREDIT_VALUE_CLAIM_IMMUTABLE/);
  assert.match(migration, /v\.evidence_id\s*=\s*e\.id[\s\S]*?v\.activity_id\s*=\s*a\.id[\s\S]*?v\.decision\s*=\s*'APPROVED'/i);
});

test("EPR value-claim trigger is enabled in migrated PostgreSQL", {
  skip: !(process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && process.env.DATABASE_URL)
    ? "requires CI disposable PostgreSQL and applied migrations"
    : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });
  try {
    const result = await pool.query<{
      trigger_enabled: string;
      trigger_definition: string;
      function_definition: string;
    }>("select t.tgenabled as trigger_enabled, pg_get_triggerdef(t.oid) as trigger_definition, pg_get_functiondef(p.oid) as function_definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and n.nspname='public' and c.relname='epr_credits' and t.tgname='epr_credit_environmental_claim'");
    assert.equal(result.rows.length, 1, "one EPR value-claim trigger must be attached");
    assert.equal(result.rows[0]?.trigger_enabled, "O", "EPR value-claim trigger must be enabled");
    assert.match(result.rows[0]!.trigger_definition, /after insert or update of status, activity_id, evidence_id, verification_id, scheme_id, issuer_organization_id, recycler_organization_id, quantity, unit/i);
    assert.match(result.rows[0]!.function_definition, /organization_has_explicit_geography_scope/i);
    assert.match(result.rows[0]!.function_definition, /EPR_CREDIT_VALUE_CLAIM_IMMUTABLE/);
  } finally {
    await pool.end();
  }
});

test("EPR geography guards are attached to the live PostgreSQL tables after migrations", {
  skip: !(process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && process.env.DATABASE_URL)
    ? "requires CI disposable PostgreSQL and applied migrations"
    : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });
  try {
    const result = await pool.query<{
      table_name: string;
      trigger_name: string;
      function_name: string;
      trigger_enabled: string;
      trigger_definition: string;
      function_definition: string;
    }>(`
      select c.relname as table_name,
             t.tgname as trigger_name,
             p.proname as function_name,
             t.tgenabled as trigger_enabled,
             pg_get_triggerdef(t.oid) as trigger_definition,
             pg_get_functiondef(p.oid) as function_definition
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_proc p on p.oid = t.tgfoid
      where not t.tgisinternal
        and n.nspname = 'public'
        and ( (c.relname = 'organization_epr_applicability'
               and t.tgname = 'epr_external_registration_evidence_guard')
           or (c.relname = 'epr_credit_transfers'
               and t.tgname = 'epr_transfer_evidence_guard')
           or (c.relname = 'epr_returns'
               and t.tgname = 'epr_return_submission_evidence_guard') )
      order by c.relname
    `);
    assert.equal(result.rows.length, 3, "all EPR evidence guards must be attached to their live tables");
    for (const row of result.rows) {
      assert.equal(row.trigger_enabled, "O", `${row.trigger_name} must be enabled`);
      assert.match(row.trigger_definition, /before insert or update/i);
      assert.match(row.function_definition, /organization_has_explicit_geography_scope/i);
      assert.doesNotMatch(row.function_definition, /\borganization_has_geography_scope\s*\(/);
    }
    assert.deepEqual(
      result.rows.map((row) => [row.table_name, row.function_name]),
      [
        ["epr_credit_transfers", "enforce_epr_transfer_evidence"],
        ["epr_returns", "enforce_epr_return_submission_evidence"],
        ["organization_epr_applicability", "enforce_epr_external_registration_evidence"],
      ],
    );
  } finally {
    await pool.end();
  }
});


test("evidence vault upload, read, download and review retain explicit geography and permission gates", () => {
  const source = sourceFor("evidence-vault-routes.ts");
  assert.match(source, /async function activityContext[\s\S]*?organization_has_explicit_geography_scope/);
  assert.match(source, /\/api\/v1\/evidence-vault\/upload[\s\S]*?activityContext\(pool,auth,activityId\)/);
  assert.match(source, /\/api\/v1\/evidence-vault[\s\S]*?activityContext\(pool,auth,activityId\)/);
  assert.match(source, /\/api\/v1\/evidence-vault\/:evidenceId[\s\S]*?organization_has_explicit_geography_scope/);
  assert.match(source, /\/api\/v1\/evidence-vault\/:evidenceId\/review[\s\S]*?organization_has_explicit_geography_scope/);
  assert.match(source, /hasOrganizationPermission\(client,auth,row\.organization_id,\["evidence:review"\]\)/);
  assert.match(source, /canVerifyEvidence\(client,auth\.identityId,id\)/);
  assert.match(source, /for update of e/i);
  assert.match(source, /await client\.query\("commit"\)/);
});


test("CPCB stakeholder workspace reads and updates enforce the row's explicit geography scope", () => {
  const source = sourceFor("cpcb-swm-routes.ts");
  assert.match(
    source,
    /from cpcb_swm_stakeholder_workspaces w where w\.organization_id=\$1 and w\.geography_id is not null and organization_has_explicit_geography_scope\(w\.organization_id,w\.geography_id\)/,
    "workspace list must not expose rows outside the active organization's verified geography scopes",
  );
  assert.match(
    source,
    /select id,cpcb_reported_status,cpcb_status_source_reference,cpcb_status_note from cpcb_swm_stakeholder_workspaces where id=\$1 and organization_id=\$2 and geography_id is not null and organization_has_explicit_geography_scope\(organization_id,geography_id\) for update/i,
    "workspace update must first lock only a row whose existing geography is in scope",
  );
});


test("live acceptance seed binds the activity to an explicit verified geography before creation", () => {
  const source = sourceFor("acceptance-seed.ts");
  assert.match(
    source,
    /insert into organization_geography_scopes[\s\S]*?values \(\$1,\$2,'VERIFIED'\)[\s\S]*?insert into activities\([\s\S]*?organization_id, actor_identity_id, geography_id/,
    "acceptance seed must establish the verified organization geography scope before inserting a geography-bound activity",
  );
});

test("registry credential geography guard accepts only explicit verified-root descendants", () => {
  const migrationPath = [
    "../../migrations/20261030_z_credential_descendant_scope.sql",
    "../../../migrations/20261030_z_credential_descendant_scope.sql",
  ].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
  if (!migrationPath) throw new Error("Credential descendant geography migration not found");
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(migration, /create or replace function prevent_credential_out_of_scope_issue\\s*\\(/i);
  assert.match(migration, /organization_has_explicit_geography_scope\\(new\\.issuer_organization_id, activity_geography_id\\)/i);
  assert.doesNotMatch(
    migration,
    /s\\.geography_id\\s*=\\s*activity_geography_id/i,
    "credential geography must follow the same verified-root descendant policy as other high-impact operations",
  );
});
