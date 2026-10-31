import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoOrphanedMigrationRecords, findOrphanedMigrationRecords } from "./migration-ledger.js";

// Read the actual migration filenames shipped in this branch, rather than
// assuming numbered replacements exist. This is a read-only release-catalog test.
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationDirCandidates = [path.resolve(here, "../../migrations"), path.resolve(here, "../../../migrations"), path.resolve(here, "../../../../migrations")];
const migrationDir = migrationDirCandidates.find((candidate) => existsSync(candidate));
if (!migrationDir) throw new Error(`Migration catalog not found. Checked: ${migrationDirCandidates.join(", ")}`);
const availableReleaseFiles = await readdir(migrationDir);

const sharedLegacyRecords = [
  { version: "20261018", filename: "20261018_cpcb_swm_stakeholder_workspaces.sql" },
  { version: "20261019", filename: "20261019_cpcb_bwg_workflow_tracking.sql" },
  { version: "20261020", filename: "20261020_ccts_methodology_registry.sql" },
  { version: "20261021", filename: "20261021_evidence_artifact_vault.sql" },
];

test("actual release catalog blocks production ledger's missing verification migration", () => {
  const productionRecords = [
    ...sharedLegacyRecords,
    { version: "096", filename: "096_verification_authorization_provenance.sql" },
  ];
  // Shared date-prefixed records exist in this branch; production's recorded
  // 096 migration does not. Do not substitute similarly named migrations.
  const orphans = findOrphanedMigrationRecords(productionRecords, availableReleaseFiles);
  assert.deepEqual(orphans, [
    { version: "096", filename: "096_verification_authorization_provenance.sql" },
  ]);
  assert.throws(
    () => assertNoOrphanedMigrationRecords(productionRecords, availableReleaseFiles),
    /096_verification_authorization_provenance\.sql/,
  );
});

test("actual release catalog blocks staging-only async and AI migration records", () => {
  const stagingRecords = [
    ...sharedLegacyRecords,
    { version: "20261022", filename: "20261022_async_mirror_inbox.sql" },
    { version: "20261023", filename: "20261023_async_mirror_worker_leases.sql" },
    { version: "20261024", filename: "20261024_ai_intake_rate_limits.sql" },
    { version: "20261025", filename: "20261025_ai_evidence_intake_jobs.sql" },
  ];
  const orphans = findOrphanedMigrationRecords(stagingRecords, availableReleaseFiles);
  assert.deepEqual(orphans, [
    { version: "20261022", filename: "20261022_async_mirror_inbox.sql" },
    { version: "20261023", filename: "20261023_async_mirror_worker_leases.sql" },
    { version: "20261024", filename: "20261024_ai_intake_rate_limits.sql" },
    { version: "20261025", filename: "20261025_ai_evidence_intake_jobs.sql" },
  ]);
  assert.throws(
    () => assertNoOrphanedMigrationRecords(stagingRecords, availableReleaseFiles),
    /20261022.*20261023.*20261024.*20261025/,
  );
});

test("matching a schema family's purpose is not enough to waive an orphaned filename", () => {
  assert.throws(
    () => assertNoOrphanedMigrationRecords(
      [{ version: "20261022", filename: "20261022_async_mirror_inbox.sql" }],
      ["092_example_candidate_migration.sql"],
    ),
    /20261022/,
  );
});
