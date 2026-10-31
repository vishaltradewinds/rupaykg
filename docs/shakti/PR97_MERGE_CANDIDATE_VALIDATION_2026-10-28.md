# PR #97 Merge-Candidate Validation Record

Date: 2026-10-28
Repository: vishaltradewinds/rupaykg
Synthetic merge commit under test: eac32ec13d9bbe247c9bc131769a8113178d710a
Parents: main 54a7fe1ceb41b37a68720a71c10a1dd03af30dea; PR #97 head 730327adc30cfaea0441f77adb12a757305d3514
Branch: audit/pr97-merge-candidate-validation-2026-10-28
Purpose: run repository CI against the exact GitHub-generated merge tree without merging PR #97.

## Why this is needed
PR-head CI is not the same as merge-candidate CI. The GitHub-generated merge commit has both current main and PR #97 head as parents. Inspection of its tree shows the PR candidate has ordinal migration paths such as 088/089/090/091 where main has date-prefixed paths such as 20261018/20261019/20261020/20261021. The candidate tree therefore does not contain both filename variants at once; instead, the PR candidate replaces the source paths and changes migration identities.

The migration runner in apps/src/migrate.ts uses the numeric filename prefix as schema_migrations.version and records filename. Consequently, if an environment has recorded a date-prefixed migration from main, a later candidate with the ordinal-prefixed counterpart will not recognize it as the same migration and may execute the schema change again. The inverse is also possible for environments that applied the ordinal version.

## Required validation
1. Run CI on this exact synthetic merge tree and capture its exact SHA/checks.
2. Review migration diffs and the complete ordered migration tree against main and the PR head.
3. In an authorized read-only session, capture schema_migrations (version, filename, applied_at) from every relevant environment; do not collect credentials or modify records.
4. Classify environments by which migration identities are recorded.
5. In a disposable PostgreSQL database, test:
   - empty database -> candidate migration tree;
   - representative upgrade state with main date-prefixed migrations already applied -> candidate;
   - representative upgrade state with PR ordinal migrations already applied -> candidate;
   - failure and rollback behavior for duplicate schema objects.
6. Select a reviewed forward-only reconciliation strategy based on those results. Do not rename applied migration files or rewrite the ledger speculatively.
7. Require independent review and a documented rollback/recovery plan before any production migration.
8. Keep PR #97 unmerged and production certification OFF until all required evidence is accepted.

## Safety boundary
This branch is for validation only. It does not change main, merge PR #97, access production databases, run a production migration, deploy services, issue credits, or enable production certification. CI passing on this branch is engineering evidence only, not proof of environment migration state or release readiness.


## Validation result — 2026-10-28 11:20 UTC

CI run 40678749385 (job 122783736139) completed successfully. The run passed the production dependency audit, migration validator, clean PostgreSQL migration, typecheck, application build, production web browser smoke test, automated tests including disposable PostgreSQL acceptance, and production container build. This run is against a clean-install/candidate workflow; it does not exercise a database that already recorded the legacy date-prefixed migration identities.

## Confirmed migration identity collision

The candidate tree contains:
- `migrations/088_cpcb_swm_stakeholder_workspaces.sql` (Git blob SHA `be8f77f091fe0ef27a7753f15b7638e1e43908b3`) while main has `migrations/20261018_cpcb_swm_stakeholder_workspaces.sql` with the same blob SHA.
- `migrations/089_cpcb_bwg_workflow_tracking.sql` while main has `migrations/20261019_cpcb_bwg_workflow_tracking.sql`; these files have the same content/blob identity.
- `migrations/090_ccts_methodology_registry.sql` while main has `migrations/20261020_ccts_methodology_registry.sql`; these files have the same content/blob identity.
- `migrations/091_evidence_artifact_vault.sql` (blob SHA `736960cbb8f6b3851347df107fb1a580b3e6e748`) while main has `migrations/20261021_evidence_artifact_vault.sql` (blob SHA `b422e13c0eb0cba011854cd41934f931528a437f`). The SQL statements match apart from a comment-line difference, but the file identities differ.

The runner compares the candidate numeric prefix to `schema_migrations.version` and requires the recorded filename to match. Thus a ledger row for version `20261018` does not satisfy candidate version `088`; absent an explicit reconciliation, the runner attempts to execute the same CREATE statements again and can fail on existing objects. This is a concrete upgrade-compatibility blocker, not a clean-install CI failure.

## Required read-only ledger evidence

For each relevant environment, an authorized operator should run this read-only query and share only the output (redact host, account, organization, or other unrelated identifiers):

```sql
SELECT version, filename, applied_at
FROM schema_migrations
WHERE filename IN (
  '20261018_cpcb_swm_stakeholder_workspaces.sql',
  '20261019_cpcb_bwg_workflow_tracking.sql',
  '20261020_ccts_methodology_registry.sql',
  '20261021_evidence_artifact_vault.sql',
  '088_cpcb_swm_stakeholder_workspaces.sql',
  '089_cpcb_bwg_workflow_tracking.sql',
  '090_ccts_methodology_registry.sql',
  '091_evidence_artifact_vault.sql'
)
ORDER BY applied_at, version;
```

If the table is absent, report only that fact; do not create it or make any changes for this audit. No credentials, connection strings, or database hostnames are required.

## Reconciliation decision gate

Do not add an automatic alias/ledger backfill or rewrite migration files until the environment evidence and a disposable upgrade test establish the actual states. The proposed safe direction is an explicit, narrowly allowlisted compatibility mapping that validates the known migration content identity and existing recorded filename before marking an equivalent candidate migration as already applied. Unknown filenames, unexpected content, conflicting rows, and partially applied/ambiguous states must fail closed for manual review. Test each supported historical state on disposable PostgreSQL, including a negative case where content differs. The migration ledger change itself must be transactional, auditable, and reviewed independently.

Release remains HOLD. PR #97 is open and unmerged. PR #104 remains draft/validation-only. Production certification remains OFF.
