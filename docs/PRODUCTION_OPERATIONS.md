# RupayKG Production Operations

## Health and readiness

- Render HTTP health check path: `/health`.
- The application endpoint performs a PostgreSQL `select 1` check.
- Healthy response: HTTP 200 with `status: READY`, `database: AVAILABLE`, and `syntheticData: false`.
- Degraded database state returns HTTP 503.
- Keep the health endpoint unauthenticated so the platform can probe it.

## Backup procedure — Free Render PostgreSQL

Free Render PostgreSQL does not provide Render-managed recovery/PITR. Use an external logical backup.

From a trusted operator workstation, with the production external `DATABASE_URL` supplied through a secure secret mechanism:

```powershell
$env:DATABASE_URL = "<PRODUCTION_DATABASE_URL>"
pg_dump --dbname="$env:DATABASE_URL" --format=custom --file="rupaykg-prod-$(Get-Date -Format yyyyMMdd-HHmmss).dump"
pg_restore --list "rupaykg-prod-*.dump" | Select-Object -First 20
```

Do not commit the database URL or dump file to Git. Store backups in an access-controlled external location.

## Restore verification

Restore only into an empty isolated PostgreSQL database:

```powershell
pg_restore --dbname="$env:RESTORE_DATABASE_URL" --clean --if-exists --no-owner "rupaykg-prod-YYYYMMDD-HHMMSS.dump"
```

Then run the RupayKG migration/status checks and application acceptance tests against the isolated database before considering the backup verified.

## Rollback procedure

Render can roll a service back to a previous successful deploy artifact. Application rollback does not roll back PostgreSQL state.

Before a production rollback:
1. Identify the last known-good Render deploy.
2. Record the current deploy ID and database migration version.
3. If the incident includes schema/data changes, stop and assess database compatibility first.
4. Roll back the application artifact.
5. Verify `/health`, authentication, and critical API flows.
6. Reconcile database state separately; never assume application rollback reverses migrations.

## Current acceptance evidence

- Local full test suite: **not currently re-verified on the 2026-09-20 checkpoint**; the prior 88/88 statement is historical evidence only.
- Production `/health`: HTTP 200, database available, synthetic data false.
- Production authentication without a session: HTTP 401, fail-closed.
- Guardian/Hedera live acceptance remains pending real external credentials and execution evidence.


## Migration execution — explicit release job only

The production web container must start the API only. It must not apply database migrations as a side effect of deployment or restart. The Docker runtime command is therefore deliberately limited to `production-server.js`; acceptance fixture seeding is also a separate, explicitly invoked operation.

Production migrations are a separately approved change and must run as a one-off job using the exact reviewed image/commit, never as an implicit web-service startup step. The migration runner fails closed in `NODE_ENV=production` unless all of these are supplied:

- `RUPAYKG_ALLOW_PRODUCTION_MIGRATIONS=true`
- `RUPAYKG_PRODUCTION_MIGRATION_APPROVED=true`
- `RUPAYKG_PRODUCTION_CHANGE_ID` — approved change/ticket reference
- `RUPAYKG_PRODUCTION_BACKUP_REFERENCE` — verified backup artifact reference
- `RUPAYKG_MIGRATION_PHASE=production-upgrade`

Before applying any proposed migration, the runner requires the live `schema_migrations` ledger to match the captured 92-row production manifest exactly by ordered version/filename identity. A missing ledger, extra row, missing row, renamed migration or other drift blocks execution and requires a separately reviewed reconciliation. The production runner verifies PostgreSQL TLS certificates; it does not disable certificate verification.

Example command shape for an approved one-off container job (placeholders must be supplied securely; do not commit values):

```sh
RUPAYKG_ALLOW_PRODUCTION_MIGRATIONS=true \
RUPAYKG_PRODUCTION_MIGRATION_APPROVED=true \
RUPAYKG_PRODUCTION_CHANGE_ID=<approved-change-id> \
RUPAYKG_PRODUCTION_BACKUP_REFERENCE=<verified-backup-reference> \
RUPAYKG_MIGRATION_PHASE=production-upgrade \
NODE_ENV=production node apps/dist/src/migrate.js
```

This command is documentation only. It is **not authorization** to run the migration. The current RupayKg release remains HOLD until independent migration/security review, staging/rehearsal reconciliation, backup restore verification, an approved change window and rollback plan are complete. Never set the approval flags merely to make a deployment succeed.
