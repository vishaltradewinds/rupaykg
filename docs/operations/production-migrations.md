# Production database migrations — operator-controlled process

## Security boundary

The long-running RupayKg API container must never apply schema migrations or seed acceptance fixtures during startup.

- API runtime reads only `DATABASE_URL`.
- Migration execution reads only `RUPAYKG_MIGRATOR_DATABASE_URL`.
- There is deliberately no fallback from the migrator variable to `DATABASE_URL`.
- Production migration execution requires `RUPAYKG_MIGRATOR_DATABASE_SSL=require` and a valid `RUPAYKG_MIGRATOR_DATABASE_CA_CERT` PEM certificate.
- The migrator credential must be separate from the API runtime credential and must not be configured on the web service.
- A session-level PostgreSQL advisory lock serializes concurrent invocations of the migration runner.
- The acceptance fixture seeder is not part of production startup and must never be run against production.

## CI

CI supplies a disposable PostgreSQL URL through `RUPAYKG_MIGRATOR_DATABASE_URL` and explicitly disables TLS only for its local PostgreSQL service. The migration test does not use the application `DATABASE_URL`.

## Production procedure — NOT YET AUTHORIZED

This document describes the required future operator process; it is not authorization to run it.

Before a production migration can be considered:

1. Reconcile the full source/ledger history, including archived version 096 and the staging-only migration families.
2. Build and review an explicit migration plan against the exact target branch and database identity.
3. Establish a dedicated, least-privilege-for-purpose migrator identity, separate from the API runtime identity. Do not reuse the current `rupaykg` BYPASSRLS/owner-equivalent role without a separately approved exception and risk review.
4. Store the migrator credential only in a separately controlled migration execution environment, never in the web service.
5. Validate the exact migration set and hashes on a disposable Neon branch; capture before/after schema fingerprints and rollback/forward-recovery procedures.
6. Obtain independent DBA/security review and explicit founder authorization for the specific production migration batch.
7. Execute through a one-shot migration job with audited identity and target confirmation. Verify the ledger and application compatibility before any web release.

## Local/CI invocation

After building the workspace, an operator can explicitly invoke:

```sh
RUPAYKG_MIGRATOR_DATABASE_URL="$DISPOSABLE_POSTGRES_URL" \\
RUPAYKG_MIGRATOR_DATABASE_SSL=false \\
npm run migrate -w @rupaykg/api
```

For a production-grade migrator connection, use the separately managed migrator URL, set TLS to `require`, and provide the CA certificate. Do not put those values in shell history, source control, build arguments, or the API service environment.

## Current status

Production remains on HOLD. No production migration, grant, role change, RLS activation, secret update, deployment, or acceptance seeding is authorized by this engineering change.
