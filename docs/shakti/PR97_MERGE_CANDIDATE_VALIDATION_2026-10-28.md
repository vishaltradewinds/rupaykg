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
