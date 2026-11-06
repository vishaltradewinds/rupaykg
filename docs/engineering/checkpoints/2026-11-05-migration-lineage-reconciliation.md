# Migration lineage reconciliation — 2026-11-05

## Scope

Read-only repository/history reconciliation for the migration lineage gate. No production database write, migration, deployment, role/grant change, RLS activation, or certification was performed.

## Migration 096

The historical migration source is recoverable from Git history as:

`migrations/096_verification_authorization_provenance.sql`

Evidence:
- Commit `ca8f4100782e` added the migration on 2026-10-27.
- Commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` removed that exact file on 2026-10-27 with the explicit message `Remove accidentally placed unreviewed verification migration from main`.
- The current main tree at `934062ef8af2ca47bbcbf5e37c12de12a4f9f743` does not contain `migrations/096_verification_authorization_provenance.sql`.
- The recovered SQL source was inspected from the pre-removal commit and is therefore available as historical evidence; it is NOT being reintroduced into main by this checkpoint.

## Staging-only migration sequence

The current main tree does not contain migration files beginning `20261022`, `20261023`, `20261024`, or `20261025`.

These migrations remain a separate historical/staging reconciliation item. Their presence in a non-production/rehearsal lineage must not be inferred as authorization to copy them into production. Before any production migrator is designed around them, each file must be recovered, fingerprinted, dependency-checked, and explicitly classified as production-applicable or non-production.

## Validator correction

PR #290's lineage validator was corrected to preserve the exact filename version prefix used by the production migration runner (for example `001`, not numeric `1`). The earlier object-name duplicate scan was removed because it could falsely classify intentional repeated SQL object references as migration-version conflicts.

## Current gate

PR #290 remains Draft/open/unmerged. CI must pass again on the corrected exact head before the PR can be considered technically ready for review.

Production remains READ-ONLY/HOLD.
