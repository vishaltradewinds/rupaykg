import test from "node:test";
import assert from "node:assert/strict";
import { assertProductionMigrationGate, compareMigrationFilenames, selectMigrationFilenames } from "./migration-order.js";

test("orders historical production migrations before production-only 096 and proposed chain after it", () => {
  const files = [
    "20261022_async_mirror_inbox.sql",
    "096_verification_authorization_provenance.sql",
    "20261021_evidence_artifact_vault.sql",
    "023_lifecycle_state_guards.sql",
    "001_core.sql",
    "20261018_cpcb_swm_stakeholder_workspaces.sql",
    "20261031_government_jurisdiction_crosswalk.sql",
    "087_acceptance_fixture_registry_exclusion.sql",
  ].sort(compareMigrationFilenames);

  assert.deepEqual(files, [
    "001_core.sql",
    "023_lifecycle_state_guards.sql",
    "087_acceptance_fixture_registry_exclusion.sql",
    "20261018_cpcb_swm_stakeholder_workspaces.sql",
    "20261021_evidence_artifact_vault.sql",
    "096_verification_authorization_provenance.sql",
    "20261022_async_mirror_inbox.sql",
    "20261031_government_jurisdiction_crosswalk.sql",
  ]);
});

test("splits the exact production baseline from the proposed upgrade chain", () => {
  const files = [
    "001_core.sql",
    "023_lifecycle_state_guards.sql",
    "087_acceptance_fixture_registry_exclusion.sql",
    "20261018_cpcb_swm_stakeholder_workspaces.sql",
    "20261021_evidence_artifact_vault.sql",
    "096_verification_authorization_provenance.sql",
    "20261022_async_mirror_inbox.sql",
    "20261031_government_jurisdiction_crosswalk.sql",
  ];
  const baseline = selectMigrationFilenames(files, "production-baseline");
  const upgrade = selectMigrationFilenames(files, "production-upgrade");
  assert.deepEqual(baseline, files.slice(0, 6));
  assert.deepEqual(upgrade, files.slice(6));
  assert.deepEqual(selectMigrationFilenames(files, "all"), files);
});


test("production migration runner fails closed without explicit release evidence", () => {
  assert.throws(() => assertProductionMigrationGate({
    NODE_ENV: "production",
    RUPAYKG_MIGRATION_PHASE: "all",
  }), /PRODUCTION_MIGRATION_BLOCKED/);
  assert.throws(() => assertProductionMigrationGate({
    NODE_ENV: "production",
    RUPAYKG_MIGRATION_PHASE: "production-upgrade",
    RUPAYKG_ALLOW_PRODUCTION_MIGRATIONS: "true",
    RUPAYKG_PRODUCTION_MIGRATION_APPROVED: "true",
    RUPAYKG_PRODUCTION_CHANGE_ID: "CHG-123",
  }), /PRODUCTION_MIGRATION_BLOCKED/);
});

test("production migration runner accepts only explicit approved upgrade envelope", () => {
  assert.doesNotThrow(() => assertProductionMigrationGate({
    NODE_ENV: "production",
    RUPAYKG_MIGRATION_PHASE: "production-upgrade",
    RUPAYKG_ALLOW_PRODUCTION_MIGRATIONS: "true",
    RUPAYKG_PRODUCTION_MIGRATION_APPROVED: "true",
    RUPAYKG_PRODUCTION_CHANGE_ID: "CHG-123",
    RUPAYKG_PRODUCTION_BACKUP_REFERENCE: "backup://verified/2026-10-31",
  }));
  assert.doesNotThrow(() => assertProductionMigrationGate({ NODE_ENV: "test" }));
});
