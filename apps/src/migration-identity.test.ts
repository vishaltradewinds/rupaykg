import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findLegacyIdentityConflicts } from "./migration-identity.js";

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
