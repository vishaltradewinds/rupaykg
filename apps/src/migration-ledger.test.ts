import test from "node:test";
import assert from "node:assert/strict";
import { assertNoOrphanedMigrationRecords, findOrphanedMigrationRecords } from "./migration-ledger.js";

test("accepts a ledger whose migration filenames exist in the release", () => {
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
