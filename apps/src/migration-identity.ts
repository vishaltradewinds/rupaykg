/**
 * Known migration path identities that changed between main and the PR #97
 * candidate. This is a fail-closed guard, not an automatic alias/reconciliation.
 * Do not add entries without reviewed evidence and regression fixtures.
 */
export const LEGACY_MIGRATION_IDENTITIES: Readonly<Record<string, string>> = Object.freeze({
  "088_cpcb_swm_stakeholder_workspaces.sql": "20261018_cpcb_swm_stakeholder_workspaces.sql",
  "089_cpcb_bwg_workflow_tracking.sql": "20261019_cpcb_bwg_workflow_tracking.sql",
  "090_ccts_methodology_registry.sql": "20261020_ccts_methodology_registry.sql",
  "091_evidence_artifact_vault.sql": "20261021_evidence_artifact_vault.sql",
});

export function findLegacyIdentityConflicts(
  candidateFiles: readonly string[],
  recordedFilenames: readonly string[],
): Array<{ candidate: string; recordedLegacy: string }> {
  const candidates = new Set(candidateFiles);
  const recorded = new Set(recordedFilenames);
  return Object.entries(LEGACY_MIGRATION_IDENTITIES)
    .filter(([candidate, legacy]) => candidates.has(candidate) && recorded.has(legacy))
    .map(([candidate, recordedLegacy]) => ({ candidate, recordedLegacy }));
}
