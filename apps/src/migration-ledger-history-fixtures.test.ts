import test from "node:test";
import assert from "node:assert/strict";
import { assertNoOrphanedMigrationRecords, findOrphanedMigrationRecords } from "./migration-ledger.js";

// These records are derived from the read-only live audit dated 2026-10-28.
// Keep the fixtures intentionally small: they exercise reconciliation behavior,
// not the full database schema. No fixture authorizes a production ledger write.
const relevantCanonicalFiles = [
  "088_cpcb_swm_stakeholder_workspaces.sql",
  "089_cpcb_bwg_workflow_tracking.sql",
  "090_ccts_methodology_registry.sql",
  "091_evidence_artifact_vault.sql",
];

const sharedLegacyRecords = [
  { version: "20261018", filename: "20261018_cpcb_swm_stakeholder_workspaces.sql" },
  { version: "20261019", filename: "20261019_cpcb_bwg_workflow_tracking.sql" },
  { version: "20261020", filename: "20261020_ccts_methodology_registry.sql" },
  { version: "20261021", filename: "20261021_evidence_artifact_vault.sql" },
];

test("production legacy ledger stays blocked until an explicit compatibility proof exists", () => {
  const productionRecords = [
    ...sharedLegacyRecords,
    { version: "096", filename: "096_verification_authorization_provenance.sql" },
  ];
  const orphans = findOrphanedMigrationRecords(productionRecords, [
    ...relevantCanonicalFiles,
    "096_verification_authorization_provenance.sql",
  ]);
  assert.deepEqual(orphans, sharedLegacyRecords);
  assert.throws(
    () => assertNoOrphanedMigrationRecords(productionRecords, [
      ...canonicalReleaseFiles,
      "096_verification_authorization_provenance.sql",
    ]),
    /20261018.*20261019.*20261020.*20261021/,
  );
});

test("staging-only async and AI legacy records are not mapped to numbered migrations 092-095 (whose actual contents differ and are not treated as aliases)", () => {
  const stagingOnlyRecords = [
    { version: "20261022", filename: "20261022_async_mirror_inbox.sql" },
    { version: "20261023", filename: "20261023_async_mirror_worker_leases.sql" },
    { version: "20261024", filename: "20261024_ai_intake_rate_limits.sql" },
    { version: "20261025", filename: "20261025_ai_evidence_intake_jobs.sql" },
  ];
  const orphans = findOrphanedMigrationRecords(stagingOnlyRecords, canonicalReleaseFiles);
  assert.deepEqual(orphans, stagingOnlyRecords);
  assert.throws(
    () => assertNoOrphanedMigrationRecords(stagingOnlyRecords, canonicalReleaseFiles),
    /20261022.*20261023.*20261024.*20261025/,
  );
});

test("matching a schema family's name is not enough to waive an orphaned filename", () => {
  assert.throws(
    () => assertNoOrphanedMigrationRecords(
      [{ version: "20261022", filename: "20261022_async_mirror_inbox.sql" }],
      ["092_example_candidate_migration.sql"],
    ),
    /20261022/,
  );
});
