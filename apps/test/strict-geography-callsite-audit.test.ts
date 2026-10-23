import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
