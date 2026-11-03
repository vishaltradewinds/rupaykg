import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findDuplicateCandidateVersions, findLegacyIdentityConflicts, findVersionFilenameConflicts } from "./migration-identity.js";

describe("historical migration identity guard", () => {
  it("flags a date-prefixed legacy ledger row when the ordinal candidate is present", () => {
    assert.deepEqual(
      findLegacyIdentityConflicts(
        ["088_cpcb_swm_stakeholder_workspaces.sql"],
        ["20261018_cpcb_swm_stakeholder_workspaces.sql"],
      ),
      [{
        candidate: "088_cpcb_swm_stakeholder_workspaces.sql",
        recordedLegacy: "20261018_cpcb_swm_stakeholder_workspaces.sql",
      }],
    );
  });

  it("flags the reverse deployment direction when the date-prefixed candidate meets an ordinal ledger", () => {
    assert.deepEqual(
      findLegacyIdentityConflicts(
        ["20261018_cpcb_swm_stakeholder_workspaces.sql"],
        ["088_cpcb_swm_stakeholder_workspaces.sql"],
      ),
      [{
        candidate: "20261018_cpcb_swm_stakeholder_workspaces.sql",
        recordedLegacy: "088_cpcb_swm_stakeholder_workspaces.sql",
      }],
    );
  });

  it("does not flag a clean database with no legacy ledger rows", () => {
    assert.deepEqual(
      findLegacyIdentityConflicts(["088_cpcb_swm_stakeholder_workspaces.sql"], []),
      [],
    );
  });

  it("does not flag unrelated filenames or a legacy row without its candidate migration", () => {
    assert.deepEqual(
      findLegacyIdentityConflicts(
        ["091_evidence_artifact_vault.sql", "092_other.sql"],
        ["20261020_ccts_methodology_registry.sql"],
      ),
      [],
    );
  });

  it("flags each legacy identity independently in a mixed ledger", () => {
    assert.deepEqual(
      findLegacyIdentityConflicts(
        [
          "088_cpcb_swm_stakeholder_workspaces.sql",
          "089_cpcb_bwg_workflow_tracking.sql",
          "090_ccts_methodology_registry.sql",
          "091_evidence_artifact_vault.sql",
        ],
        [
          "20261018_cpcb_swm_stakeholder_workspaces.sql",
          "20261020_ccts_methodology_registry.sql",
        ],
      ),
      [
        {
          candidate: "088_cpcb_swm_stakeholder_workspaces.sql",
          recordedLegacy: "20261018_cpcb_swm_stakeholder_workspaces.sql",
        },
        {
          candidate: "090_ccts_methodology_registry.sql",
          recordedLegacy: "20261020_ccts_methodology_registry.sql",
        },
      ],
    );
  });
});


describe("migration version/filename preflight", () => {
  it("flags a recorded version whose filename differs from the candidate before any migration is applied", () => {
    assert.deepEqual(
      findVersionFilenameConflicts(
        ["088_cpcb_swm_stakeholder_workspaces.sql", "089_cpcb_bwg_workflow_tracking.sql"],
        [{ version: "088", filename: "088_unrelated_historical.sql" }],
      ),
      [{
        candidate: "088_cpcb_swm_stakeholder_workspaces.sql",
        recorded: "088_unrelated_historical.sql",
        version: "088",
      }],
    );
  });

  it("accepts exact ordinal identities and ignores versions not present in the candidate tree", () => {
    assert.deepEqual(
      findVersionFilenameConflicts(
        ["088_cpcb_swm_stakeholder_workspaces.sql"],
        [
          { version: "088", filename: "088_cpcb_swm_stakeholder_workspaces.sql" },
          { version: "777", filename: "777_external_migration.sql" },
        ],
      ),
      [],
    );
  });
});


describe("candidate migration tree version uniqueness", () => {
  it("flags duplicate numeric version prefixes before any migration runs", () => {
    assert.deepEqual(
      findDuplicateCandidateVersions([
        "001_first.sql",
        "002_second.sql",
        "001_other.sql",
        "003_third.sql",
      ]),
      [{ version: "001", filenames: ["001_first.sql", "001_other.sql"] }],
    );
  });

  it("accepts a migration tree with unique version prefixes", () => {
    assert.deepEqual(
      findDuplicateCandidateVersions(["001_first.sql", "002_second.sql"]),
      [],
    );
  });

  it("ignores filenames without a version separator", () => {
    assert.deepEqual(findDuplicateCandidateVersions(["README.md", "001_first.sql"]), []);
  });
});
