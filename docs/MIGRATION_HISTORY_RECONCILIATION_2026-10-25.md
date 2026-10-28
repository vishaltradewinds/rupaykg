# Migration History Reconciliation — 2026-10-25

## Status

**Historical SQL source recovered; validation gate remains open until CI and disposable-database checks complete.**

The four migration files previously thought missing were located on the `intelligence/ai-evidence-intake-middleware` branch. Their Git blob identifiers match the files in the current Shakti engineering branch exactly:

- `20261022_async_mirror_inbox.sql`
- `20261023_async_mirror_worker_leases.sql`
- `20261024_ai_intake_rate_limits.sql`
- `20261025_ai_evidence_intake_jobs.sql`

These exact blob matches establish source identity; they do not establish which database is production or prove the live schema is healthy.

The current branch preserves those four historical version identities. New CPCB/BM/MRV work uses fresh identifiers `20261029` through `20261035`. Do not renumber applied migrations or change ledger rows to make the sequence contiguous.

## Implemented engineering guard

The migration runner now:

1. Resolves and validates the complete local migration inventory before DDL.
2. Rejects duplicate migration versions in the repository.
3. Reads the existing migration ledger before applying migrations.
4. Rejects ledger filename/version conflicts and unexplained ledger versions before applying any migration SQL.
5. Records each migration in the ledger in the same transaction as its SQL.
6. Keeps the identity check strict; no bypass or ledger rewrite was introduced.

Regression tests exercise filename conflicts, preserved identities/fresh versions, and the requirement that preflight precede SQL execution.

## Remaining validation

1. Confirm the current exact-head CI run completes successfully, including migration validation, migration-state verification, type checking, build, browser smoke test, disposable PostgreSQL acceptance, audit-chain verification, backup/restore, and container build.
2. If any check fails, fix it on the engineering branch and rerun CI.
3. Review fresh-install and upgrade behavior against a representative historical schema/ledger. A fresh install alone is not enough to establish upgrade safety.
4. Verify the actual runtime and migration database identity from provider project/branch metadata. Do not infer production identity from a database name alone.
5. Verify table/function/trigger/constraint inventory, audit-chain anchor and triggers, append-only behavior, transaction rollback, and runtime-role least privilege.
6. Only after these checks pass, request review and explicit approval for a separately planned staging run. Production remains a separate gate.

## Safety boundaries

- Do not run disputed migrations against staging or production before validation.
- Do not delete or rewrite historical ledger rows.
- Do not expose credentials or full connection strings in reports.
- Do not merge or deploy based only on a green build or HTTP health endpoint.

## Gate

Engineering validation in progress. No production database writes, migration execution, environment changes, or deployment authorized by this document.
