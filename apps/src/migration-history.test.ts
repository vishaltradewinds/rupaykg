import test from "node:test";
import assert from "node:assert/strict";
import { assertMigrationCatalogConsistent, assertMigrationHistoryConsistent, findMigrationCatalogVersionConflicts, findMigrationHistoryConflicts } from "./migration-history.js";

test("catalog accepts unique numeric prefixes", () => {
  assert.doesNotThrow(() => assertMigrationCatalogConsistent(["088_first.sql", "089_second.sql"]));
});

test("catalog rejects an empty migration set", () => {
  assert.throws(() => assertMigrationCatalogConsistent([]), /MIGRATION_CATALOG_EMPTY/);
});

test("catalog rejects duplicate numeric prefixes", () => {
  assert.deepEqual(findMigrationCatalogVersionConflicts(["088_first.sql", "088_second.sql"]), ["088:088_first.sql|088_second.sql"]);
  assert.throws(() => assertMigrationCatalogConsistent(["088_first.sql", "088_second.sql"]), /MIGRATION_CATALOG_CONFLICT/);
});

test("history rejects missing source files and version/prefix mismatches", () => {
  const records = [
    { version: "096", filename: "096_missing.sql" },
    { version: "999", filename: "088_present.sql" },
  ];
  assert.deepEqual(findMigrationHistoryConflicts(records, ["088_present.sql"]), [
    { version: "096", filename: "096_missing.sql", reason: "SOURCE_MISSING" },
    { version: "999", filename: "088_present.sql", reason: "VERSION_FILENAME_MISMATCH" },
  ]);
  assert.throws(() => assertMigrationHistoryConsistent(records, ["088_present.sql"]), /MIGRATION_HISTORY_UNRESOLVED/);
});

test("history accepts existing sources with matching prefixes", () => {
  assert.doesNotThrow(() => assertMigrationHistoryConsistent([{ version: "088", filename: "088_present.sql" }], ["088_present.sql"]));
});

test("production ledger filename missing from catalogue fails closed", () => {
  const applied = [{ version: "096", filename: "096_verification_authorization_provenance.sql" }];
  const catalogue = ["088_mrv_instrument_approval_register.sql", "089_measurement_instrument_binding_guard.sql"];
  assert.deepEqual(findMigrationHistoryConflicts(applied, catalogue), [
    { version: "096", filename: "096_verification_authorization_provenance.sql", reason: "SOURCE_MISSING" },
  ]);
  assert.throws(() => assertMigrationHistoryConsistent(applied, catalogue), /MIGRATION_HISTORY_UNRESOLVED/);
});

test("staging ledger date-prefixed filenames missing from catalogue fail closed", () => {
  const applied = [
    { version: "20261022", filename: "20261022_async_mirror_inbox.sql" },
    { version: "20261023", filename: "20261023_async_mirror_worker_leases.sql" },
    { version: "20261024", filename: "20261024_ai_intake_rate_limits.sql" },
    { version: "20261025", filename: "20261025_ai_evidence_intake_jobs.sql" },
  ];
  const catalogue = ["20261021_evidence_artifact_vault.sql"];
  assert.deepEqual(findMigrationHistoryConflicts(applied, catalogue), [
    { version: "20261022", filename: "20261022_async_mirror_inbox.sql", reason: "SOURCE_MISSING" },
    { version: "20261023", filename: "20261023_async_mirror_worker_leases.sql", reason: "SOURCE_MISSING" },
    { version: "20261024", filename: "20261024_ai_intake_rate_limits.sql", reason: "SOURCE_MISSING" },
    { version: "20261025", filename: "20261025_ai_evidence_intake_jobs.sql", reason: "SOURCE_MISSING" },
  ]);
  assert.throws(() => assertMigrationHistoryConsistent(applied, catalogue), /MIGRATION_HISTORY_UNRESOLVED/);
});

test("mixed catalogue with duplicate prefix fails before history can be accepted", () => {
  const applied = [{ version: "088", filename: "088_first.sql" }];
  assert.throws(() => assertMigrationHistoryConsistent(applied, ["088_first.sql", "088_second.sql", "089_pending.sql"]), /MIGRATION_CATALOG_CONFLICT/);
});

test("recorded version mismatch fails closed even when source exists", () => {
  const applied = [{ version: "999", filename: "088_present.sql" }];
  assert.throws(() => assertMigrationHistoryConsistent(applied, ["088_present.sql", "089_pending.sql"]), /MIGRATION_HISTORY_UNRESOLVED/);
});
