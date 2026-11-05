# Protected migrator hardening — 2026-11-05

## Implemented

The protected migrator now has four explicit fail-closed controls:

1. Dedicated MIGRATOR_DATABASE_URL; the job refuses DATABASE_URL.
2. Target identity verification through current_database(), current_user, and session_user, with expected values supplied externally.
3. Strict TLS mode with a supplied CA certificate; the protected wrapper forces DATABASE_SSL_STRICT=true.
4. External immutable migration manifest validation using SHA-256 for every active SQL migration before the migration runner starts.

The migration runner also takes a PostgreSQL advisory lock so concurrent protected migration executions cannot overlap.

## Safety boundary

This change does not authorize production execution. The manifest is intentionally external to the repository until its exact source inventory, historical lineage, review commit, target environment, and approval record are frozen as release evidence.

No production database was accessed or mutated by this implementation. No deployment, merge, role/grant change, RLS activation, ledger edit, or certification occurred.

## Required runtime contract

- MIGRATOR_DATABASE_URL
- MIGRATOR_MODE=true
- NODE_ENV=production
- MIGRATOR_MANIFEST_PATH
- MIGRATOR_EXPECTED_DATABASE
- MIGRATOR_EXPECTED_USER
- DATABASE_SSL_CA_CERT

The protected job must not receive DATABASE_URL.

## Remaining release gates

- exact production source/ledger lineage reconciliation;
- decision and evidence for historical migration 096 applicability;
- formal exclusion/recovery decision for staging-only 20261022–20261025;
- immutable manifest generation and independent review;
- backup/restore evidence;
- disposable clean and production-representative upgrade rehearsals;
- web startup migration removal (#289);
- tenant/security convergence and independent DBA/security review;
- controlled production execution only after all gates pass.
