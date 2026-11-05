# Immutable CTO Checkpoint — Run 10 — 2026-11-03 17:57 UTC

## PR #243 CI and fix
- Exact-head CI #5244 (`41688858075`) passed dependency audit, migration validation, disposable PostgreSQL migration, typecheck, build and browser smoke.
- Automated tests failed 107/108. Failing subtest: `blocks acceptance fixture evidence from becoming a registry credential`.
- Root cause: migration 088 replaced `require_guardian_hcs_mrv_for_credential()` and dropped the acceptance-fixture exclusion introduced by migration 087.
- Restored acceptance-fixture rejection for new credential issuance and transitions while preserving already-issued credential lifecycle, in commit `d00c530ab0091a803a765367b8a288f26510c58b`.
- Fresh exact-head CI #5247 (`41689197835`) is in progress.

## MRV snapshot integrity tracking
Created issue #245 for:
1. database-verifiable digest/payload binding;
2. source-mutation invalidation and fresh Guardian/HCS/Mirror Node proof;
3. TRUNCATE and runtime writer privilege boundaries;
4. deterministic artifact-version ordering.

## Production read-only confirmation
- 67 public tables, 0 RLS, 0 FORCE RLS, 92 ledger rows, latest `20261021`.
- `mrv_source_snapshots` does not exist in production.
- Migration 088 is not recorded in production ledger.
- Role `rupaykg` has BYPASSRLS enabled.
No production changes were made.

## PR #244
- Earlier head CI #5239 passed all stages.
- Latest head `32028c4...` CI #5246: dependency audit, migration validation, disposable PostgreSQL migration, typecheck, build, browser smoke and tests passed; production-container build is in progress.
- PR remains draft/unmerged; no main merge or deployment.
