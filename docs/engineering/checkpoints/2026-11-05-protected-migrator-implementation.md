# Protected migrator implementation — 2026-11-05

## Scope

This candidate adds an explicitly invoked protected migrator entrypoint and configuration gate. It does not deploy or execute against production.

## Security boundary

The protected migrator requires:

- `MIGRATOR_DATABASE_URL`
- `MIGRATOR_MODE=true`
- `NODE_ENV=production`

It refuses to proceed when `MIGRATOR_DATABASE_URL` is absent, when migrator mode is not explicitly enabled, or when `DATABASE_URL` is supplied to the migrator job.

The migrator wrapper passes the dedicated migrator URL to the existing transactional migration runner as the process-local `DATABASE_URL`. The dedicated credential remains external to source control and is never written to logs.

## Separation

The long-lived web service is not changed by this candidate. PR #289 remains the separate gate that removes migration/seed execution from web startup.

This candidate therefore does not by itself authorize production deployment.

## Verification

The configuration contract is deterministic and fail-closed. The actual target database identity, TLS/CA configuration, backup evidence, migration source manifest, lineage reconciliation, and disposable upgrade rehearsal remain required before production execution.

## Safety

No production DB mutation, deployment, role/grant change, RLS activation, ledger edit, or certification occurred.
