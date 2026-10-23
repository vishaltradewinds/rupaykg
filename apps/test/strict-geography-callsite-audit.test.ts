import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const legacyFallbackForbiddenSourceFiles = [
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
               and t.tgname = 'epr_transfer_evidence_guard') )
      order by c.relname
    `);
    assert.equal(result.rows.length, 2, "both EPR evidence guards must be attached to their live tables");
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
        ["organization_epr_applicability", "enforce_epr_external_registration_evidence"],
      ],
    );
  } finally {
    await pool.end();
  }
});
