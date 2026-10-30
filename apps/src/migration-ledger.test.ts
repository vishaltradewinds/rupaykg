import test from "node:test";
import assert from "node:assert/strict";
import { assertMigrationHistoryConsistent, assertNoOrphanedMigrationRecords, findMigrationCatalogVersionConflicts, findMismatchedMigrationVersions, findOrphanedMigrationRecords } from "./migration-ledger.js";

test("accepts a ledger whose migration filenames exist and version prefixes match", () => {
  assert.doesNotThrow(() => assertNoOrphanedMigrationRecords(
    [{ version: "088", filename: "088_cpcb_swm_stakeholder_workspaces.sql" }],
    ["088_cpcb_swm_stakeholder_workspaces.sql", "089_cpcb_bwg_workflow_tracking.sql"],
  ));
});

test("fails closed when a recorded migration file was removed or renamed", () => {
  const records = [
    { version: "20261018", filename: "20261018_cpcb_swm_stakeholder_workspaces.sql" },
    { version: "088", filename: "088_cpcb_swm_stakeholder_workspaces.sql" },
  ];
  const available = ["088_cpcb_swm_stakeholder_workspaces.sql"];
  assert.deepEqual(findOrphanedMigrationRecords(records, available), [records[0]]);
  assert.throws(
    () => assertNoOrphanedMigrationRecords(records, available),
    /Migration ledger references files absent from this release: 20261018/,
  );
});

test("fails closed when a catalog filename exists but ledger version disagrees with its prefix", () => {
  const files = ["088_cpcb_swm_stakeholder_workspaces.sql", "089_cpcb_bwg_workflow_tracking.sql"];
  const records = [
    { version: "089", filename: "088_cpcb_swm_stakeholder_workspaces.sql" },
  ];
  assert.deepEqual(findMismatchedMigrationVersions(records), records);
  assert.throws(
    () => assertNoOrphanedMigrationRecords(records, files),
    /version\/filename prefix mismatch.*089 records 088_cpcb_swm_stakeholder_workspaces\.sql.*expected version 088/,
  );
});

test("does not silently ignore multiple orphaned migration records", () => {
  assert.throws(
    () => assertNoOrphanedMigrationRecords(
      [
        { version: "20261018", filename: "20261018_cpcb_swm_stakeholder_workspaces.sql" },
        { version: "20261019", filename: "20261019_cpcb_bwg_workflow_tracking.sql" },
      ],
      [],
    ),
    /20261018.*20261019/,
  );
});

test("rejects filenames without a numeric migration prefix", () => {
  assert.throws(
    () => assertNoOrphanedMigrationRecords([{ version: "088", filename: "cpcb_swm_stakeholder_workspaces.sql" }], ["cpcb_swm_stakeholder_workspaces.sql"]),
    /version\/filename prefix mismatch/,
  );
});


test("canonical contract rejects duplicate numeric prefixes before migrations can run", () => {
  const files = ["088_first.sql", "088_second.sql"];
  assert.deepEqual(findMigrationCatalogVersionConflicts(files), ["088:088_first.sql|088_second.sql"]);
  assert.throws(
    () => assertMigrationHistoryConsistent([], files),
    /MIGRATION_HISTORY_UNRESOLVED: migration catalog contains conflicting version prefixes.*088_first\.sql.*088_second\.sql/,
  );
});

test("canonical contract reports missing sources and version mismatch with stable reasons", () => {
  assert.throws(
    () => assertMigrationHistoryConsistent(
      [
        { version: "096", filename: "096_missing.sql" },
        { version: "999", filename: "088_present.sql" },
      ],
      ["088_present.sql"],
    ),
    /096:096_missing\.sql:SOURCE_MISSING.*999:088_present\.sql:VERSION_FILENAME_MISMATCH/,
  );
});
