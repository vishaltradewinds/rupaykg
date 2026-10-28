# Shakti Standards — Batch A Repository Integrity Checkpoint

Assessment date: 2026-10-28  
Repository: vishaltradewinds/rupaykg  
Observed baseline: 54a7fe1ceb41b37a68720a71c10a1dd03af30dea  
Status: OPEN; this is an audit checkpoint, not release approval.

## Observed facts
- The latest main commit returned by repository search is 54a7fe1ceb41b37a68720a71c10a1dd03af30dea, dated 2026-10-27 13:45:20Z.
- Commit message: "Remove accidentally placed unreviewed verification migration from main".
- Its diff removes migrations/096_verification_authorization_provenance.sql. Git history alone does not prove whether this migration was applied to any database.
- PR #102, Guardian and Mirror Node response hardening, was found open.
- PR #97, ICVCM integrity controls with governed agentic foundation, was found open.
- The available review query returned no submitted reviews for these two PRs.
- The workflow lookup returned no associated PR-triggered runs for the observed main SHA. This does not prove that no CI run exists elsewhere.

## Required checks — fail closed
1. Reconfirm the current main SHA and record exact head/base SHAs for every candidate PR.
2. Capture required checks for exact current heads. Do not infer CI status from an older commit or PR description.
3. Inventory migration files across main and candidate branches; verify unique identifiers, ordering, and references to migration 096.
4. Use authorized read-only inspection to establish whether migration 096 was applied in each relevant environment. Do not infer database state from Git.
5. If database state and source history differ, stop and prepare a reviewed, tested forward-reconciliation plan. Do not guess a rollback or rewrite production migration history.
6. Validate schema compatibility and migration ordering in disposable/test databases; establish backup/restore evidence before any production schema operation.
7. Test verification authorization: activity/evidence binding, active verified membership in the same organization, self-verification restrictions, decision-time authorization snapshot, and rejection of missing/mismatched evidence and duplicate/retry cases.
8. Independently review PR #102 response bounds, deadlines, allowlisted output, sanitized errors, and regression tests.
9. Independently review PR #97's separation of technical provenance from activity eligibility, and confirm no ICVCM approval or statutory approval is implied.
10. Require authorized non-production Guardian → Hedera HCS → Mirror Node acceptance evidence before claiming live external acceptance.

## Evidence ledger
| Control | Observed status | Closure evidence |
|---|---|---|
| Main baseline | PARTIAL | Reconfirm SHA at execution time |
| Migration 096 state | OPEN | Branch/source search plus authorized environment migration-state inspection |
| Exact-head main CI | UNVERIFIED | Actions/checks tied to exact SHA |
| PR #102 review | OPEN | Independent approval and resolved findings |
| PR #97 review | OPEN | Independent approval and resolved findings |
| Database recovery | UNVERIFIED | Backup and successful restore-drill evidence |
| Live external acceptance | UNVERIFIED | Authorized non-production evidence bundle |
| Regulatory/methodology approval | UNVERIFIED | Activity/jurisdiction-specific authoritative evidence and independent review |
| TRL | OPEN | Component evidence mapped to the applicable rubric |
| Production certification | HOLD/OFF | All mandatory Shakti gates independently accepted |

## Batch A exit criteria
Batch A remains OPEN until current heads are recorded, migration files and references are reconciled, applied migration state is established for each relevant environment, exact-head CI is recorded, discrepancies have a reviewed/tested remediation plan, and an independent reviewer accepts the evidence.

No production environment was accessed or changed by this document-only checkpoint. No merge, deployment, registry issuance, or production certification is authorized by this document.

## Follow-up findings — exact candidate heads inspected
- PR #102 head: `eaa3ff53e467b66d246c6fd0feac7611c0a6c20c`; two GitHub Actions `validate` check runs completed successfully on that exact SHA. No submitted review was returned.
- PR #97 head: `730327adc30cfaea0441f77adb12a757305d3514`; one GitHub Actions `validate` check run completed successfully on that exact SHA. No submitted review was returned.
- Main has date-named migrations `20261018_cpcb_swm_stakeholder_workspaces.sql`, `20261019_cpcb_bwg_workflow_tracking.sql`, `20261020_ccts_methodology_registry.sql`, and `20261021_evidence_artifact_vault.sql`.
- PR #97 contains `088_cpcb_swm_stakeholder_workspaces.sql`, `089_cpcb_bwg_workflow_tracking.sql`, `090_ccts_methodology_registry.sql`, and `091_evidence_artifact_vault.sql`. For the first three pairs, the fetched Git blob SHAs match exactly across differently numbered paths.
- The evidence-vault pair is not byte-identical: the main version uses `CREATE OR REPLACE FUNCTION prevent_evidence_vault_pointer_mutation()`, while the PR version uses `CREATE FUNCTION prevent_evidence_vault_pointer_mutation()`. Both define the same evidence artifact tables, indexes, trigger names and provenance guard. If both migrations execute in one database, the duplicate table/index/trigger creation is a concrete failure risk; the function declaration difference also changes whether a repeated definition is replaceable. This pair must be reconciled, not merely treated as harmless duplicate text.
- This is a migration-history conflict: the same schema change is represented under two different migration identities. A combined branch can attempt to create the same objects twice, and an environment's migration ledger may not treat the alternate filename as the already-applied migration. Do not merge PR #97 until the candidate is reconciled to one canonical migration identity per change, migration ordering is reviewed, and clean-database plus upgrade-path tests pass.
- The current `scripts/validate-migrations.mjs` checks duplicate numeric prefixes and duplicate `CREATE TABLE/TYPE` objects within the checked-out tree. It does not establish environment-applied state or prove migration identity across branches. The duplicate-object detector may catch the issue in a combined tree, but only if that combined tree is actually validated; passing PR-head CI alone is insufficient.
- Main's deleted `096_verification_authorization_provenance.sql` and PR #97's `096_epr_acceptance_evidence_immutability.sql` are distinct filenames/purposes. If any environment previously applied the deleted migration under a numeric-only ledger, the migration ledger must be inspected before any forward migration runs; Git alone cannot resolve this.
- PR #103's Shakti audit checkpoint is a draft documentation PR. Its `validate` check on exact head `468b59cb6d4b57327b1f235cca78bbf187e84472` completed successfully at the latest check. This confirms only the repository validation workflow for that documentation commit, not independent review or release readiness.

## Current exact-head gate snapshot
| Candidate | Exact head | CI check runs | Independent review | Release posture |
|---|---|---|---|---|
| PR #102 | `eaa3ff53e467b66d246c6fd0feac7611c0a6c20c` | 2 passed | Not recorded | HOLD pending review and external acceptance |
| PR #97 | `730327adc30cfaea0441f77adb12a757305d3514` | 1 passed | Not recorded | BLOCK merge pending migration identity reconciliation and independent review |
| PR #103 | `468b59cb6d4b57327b1f235cca78bbf187e84472` | 1 passed | Not recorded | Draft; audit evidence only |

These check runs are engineering validation only. They do not prove a live Guardian/Hedera/Mirror Node transaction, production database state, legal/methodology approval, TRL closure, or production certification.


## Follow-up — migration runner identity confirmed
- Inspected `apps/src/migrate.ts` on main. The runner derives `schema_migrations.version` from the filename prefix (`filename.split("_", 1)[0]`) and stores both the version and filename.
- Therefore the date-prefixed migrations on main and ordinal-prefixed migrations in PR #97 are different migration versions to the actual runner even when their SQL is byte-identical. On an environment where the main date-prefixed migration is already recorded, the PR's ordinal migration is not skipped as already applied; it will be attempted under a distinct version and may fail on duplicate schema objects.
- This confirms a migration execution risk, not just a naming/style concern. Do not rename already-applied migrations or invent a ledger rewrite. First establish each environment's `schema_migrations` contents through authorized read-only access, then review a forward-only reconciliation strategy.
- PR #97 received a second follow-up comment with this runner-level evidence (comment ID 6467533514).
- The updated audit document's CI run was still in progress at the latest poll. Its migration validation, migration execution, typecheck, build, browser smoke, and disposable PostgreSQL acceptance steps had completed successfully; the production-container build step remained in progress. These are checks on the audit branch's current tree, not on the combined main + PR #97 candidate, so they do not close the merge blocker.


## Synthetic merge-candidate inspection — PR #97
- GitHub reports synthetic merge commit `eac32ec13d9bbe247c9bc131769a8113178d710a` with parents main `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` and PR head `730327adc30cfaea0441f77adb12a757305d3514`.
- The synthetic merge tree contains the ordinal migration paths `088`, `089`, `090`, and `091` in place of main's date-prefixed paths. It does not contain both sets simultaneously. Thus the merge-candidate issue is a migration-identity replacement, not simply two same-content files executing together in that tree.
- Because `apps/src/migrate.ts` keys applied migrations by filename prefix, any environment with the date-prefixed versions already recorded can treat the ordinal versions as unapplied and attempt them again. The missing source filenames also mean Git source history alone cannot tell whether the schema is already present in a deployed database.
- A validation-only branch `audit/pr97-merge-candidate-validation-2026-10-28` was created from the synthetic merge commit. It adds `docs/shakti/PR97_MERGE_CANDIDATE_VALIDATION_2026-10-28.md` with the exact candidate SHA, parent SHAs, safety boundaries, and test matrix. No production or main-branch changes were made.
- No workflow run was associated with the synthetic merge commit by the available PR-triggered workflow-run lookup. Therefore merge-candidate CI remains UNVERIFIED; PR-head CI is not a substitute.
- PR #97 received a third comment recording this tree-level finding (comment ID 6467564803).

## Required migration reconciliation test matrix
| Initial state | Expected evidence |
|---|---|
| Empty disposable PostgreSQL database | Candidate migration tree applies in order; all expected schema objects and migration ledger rows are present |
| Main date-prefixed migrations already applied | Candidate upgrade completes without duplicate schema failures and with a deliberate, reviewed ledger identity strategy |
| PR ordinal migrations already applied | Candidate upgrade completes without replaying schema changes |
| Migration fails midway | Transactional behavior and recovery path verified; no partial/untracked schema state |
| Production environment | Read-only `schema_migrations(version, filename, applied_at)` evidence from authorized operator; no changes during inspection |

Do not choose a ledger rewrite, rename historical migration files, or run production migrations until the state-specific tests and independent review are complete.
