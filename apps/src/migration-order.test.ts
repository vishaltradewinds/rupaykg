import test from "node:test";
import assert from "node:assert/strict";
import { compareMigrationFilenames } from "./migration-order.js";

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
