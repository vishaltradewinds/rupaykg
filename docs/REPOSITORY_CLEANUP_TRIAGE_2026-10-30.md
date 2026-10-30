# RupayKg repository clutter and open-work triage

**Snapshot date:** 2026-10-30  
**Related cleanup PR:** [#151](https://github.com/vishaltradewinds/rupaykg/pull/151)  
**Rule:** inventory and preserve first; remove only when redundancy is demonstrated. No bulk closure/deletion based on age or branch name.

## Repository snapshot

- The branch listing returned 149 branches across the inspected pages.
- The open-PR listing returned 87 open pull requests before this cleanup batch.
- Nine branches pointed to the exact same commit `2ad6b41bd4d0f8b45dca535b97bf87fb193b05b0`: `e2e-field-acceptance-temp`, and `field-sync-route-acceptance-temp` through `field-sync-route-acceptance-temp8`.
- Two branches pointed to the exact same commit `8b3aff8e66c205cd3d5cc0d81c7644996119f284`: `feat/pan-india-facility-activity-links` and `feat/pan-india-facility-activity-links-ci`.
- These identical refs are strong cleanup candidates, but they should be deleted only after confirming no protected workflow, active deployment, external automation or user workflow depends on them. The available GitHub connector in this workstream supports read operations for branch inventories but does not expose a branch-delete action; no branch ref has been deleted.

## Confirmed obsolete PRs closed

| PR | Finding | Action |
|---|---|---|
| #5 | One generic statutory UI verification marker; no implementation or test-run evidence in the diff. | Closed with explanation; unmerged. |
| #6 | One-line verification marker; no implementation or test-run evidence in the diff. | Closed with explanation; unmerged. |
| #7 | One-line verification marker; no implementation or test-run evidence in the diff. | Closed with explanation; unmerged. |
| #8 | Generic current-main verification marker only. | Closed with explanation; unmerged. |
| #9 | Generic statutory typecheck verification marker only. | Closed with explanation; unmerged. |
| #144 | Older draft null-lease reconciliation PR superseded by rebased PR #149; #149 uses the current recovery base and corrected assertion. | Closed with explanation; unmerged. |

The four duplicate/unreferenced CI marker documents were removed only in cleanup PR #151 after their original Git blob SHAs were recorded in `docs/archive/CI_MARKER_CLEANUP_2026-10-30.md`. Git history remains intact. Main was not changed by these closures/deletions.

## Work that must remain open pending review

### Migration history / release safety
- #134 — canonical migration-history validation (draft parent branch).
- #146 — production/staging migration-history regression fixtures.
- #147 — migration-history CI routing.
- #148 — migration preflight ordering/advisory-lock hardening.
- #135 — evidence-led reconciliation plan.
- #131/#115 — disposable-database guard candidate and stacked variant.
- #107/#105/#56/#46/#38 — earlier migration/validator/TLS/lock candidates.

These overlap, but are not interchangeable without reviewing each diff and its base. Prefer one canonical implementation plus independently tested fixtures and CI wiring. Keep the migration provenance gate open until Render target and artifact/SQL digests are established.

### Worker lease recovery
- #142 — recovery implementation on the intelligence branch.
- #149 — rebased null-lease reconciliation correction.
- #150 — real PostgreSQL worker regression tests stacked on the recovery head.
- #143 — CI routing for worker PostgreSQL validation.
- #122 — older unresolved real-worker test proposal.

#144 is now closed as superseded by #149. Review the dependency chain before merging the remaining stack.

### Authorization provenance
- #139 and #140 are separate test/forward-fix proposals on different bases. Do not merge both blindly; compare their test coverage and dependency assumptions against the observed Neon main schema and the missing source migration 096.

### Hardware, compliance, TRL, and product features
- #127–#130, #136–#137, #47/#49/#59, #93/#90/#87/#86, #97/#102, and the older feature/security/compliance PRs contain potentially unique work. Their age or draft status alone is not grounds for deletion. Require exact-head CI, dependency mapping, scope review, and a successor reference before closing any.


## Critical candidate-branch migration identity collision

PR #104 (`audit/pr97-merge-candidate-validation-2026-10-28`) and PR #106 (`shakti/batch-a-combined-pr97-validation`) both contain:
- `migrations/096_epr_acceptance_evidence_immutability.sql`, Git blob `28ea4b350fe5074d2e59e59fc38c714019d00c10`.
- `migrations/102_verification_authorization_provenance.sql`, Git blob `258b1f4534efbf915688f78aa84d4ec24a47cbc0`, identical to the historical `096_verification_authorization_provenance.sql` blob.

These candidate branches assign version 096 to different SQL than the historical production-observed authorization migration and renumber that authorization SQL to 102. Their broader diffs are not identical. **Do not close/delete either PR as a duplicate.** Treat this as a migration-identity collision that blocks any merge until exact branch histories, dependencies, and observed database ledgers are reconciled. This is why the migration-history stack must remain isolated from product-feature merging.

## Next safe cleanup batch

1. Export a full PR/branch inventory with exact head SHA, base SHA, draft/state, last update, checks, changed paths and dependency links.
2. Mark each item as `KEEP`, `STACKED`, `SUPERSEDED`, `VALIDATION-ONLY`, or `NEEDS-REVIEW`; require a successor PR link before closing a superseded item.
3. Close only confirmed validation-only/superseded PRs; preserve their discussion and Git history.
4. Delete duplicate branch refs only after a read-only dependency check and with a supported GitHub write path.
5. Re-run focused CI for the chosen canonical stacks; no auto-merge or production deployment.

**Safety posture remains:** Production HOLD; scheduler OFF; certification HOLD/OFF. Repository cleanup is not release authorization.
