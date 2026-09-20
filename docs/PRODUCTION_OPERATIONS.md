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
