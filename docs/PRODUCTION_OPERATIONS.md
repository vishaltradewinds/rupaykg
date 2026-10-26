# RupayKG Production Operations

## Health and readiness

- Render HTTP health check path: `/health`.
- The application endpoint performs a PostgreSQL `select 1` check.
- Healthy response: HTTP 200 with `status: READY`, `database: AVAILABLE`, and `syntheticData: false`.
- Degraded database state returns HTTP 503.
- Keep the health endpoint unauthenticated so the platform can probe it.

## Backup procedure — chosen runtime PostgreSQL (not historical Render recovery)

The suspended historical Render database is not a required recovery target for the current new-app scope. For whichever database is selected for future live operation, Free Render PostgreSQL does not provide Render-managed recovery/PITR; use an external logical backup only after the authoritative target and read permissions are verified.

**Precondition:** this is a procedure template, not proof that the current live target can be backed up. First identify the authoritative live database and confirm the operator has permitted read access. The suspended Render database and the unconfirmed Neon candidate must not be conflated. Do not request, print, or commit credentials.

From a trusted operator workstation, with the confirmed target's `DATABASE_URL` supplied through a secure secret mechanism:

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

## Current evidence snapshot — 2026-10-26

- Production `/health`: HTTP 200.
- Production `/api/v1/status`: reports PostgreSQL as source of truth and `syntheticData=false`.
- Protected `/api/v1/overview` without authentication: HTTP 401.
- CORS probe: same-origin allowed; `https://evil.example` receives no `Access-Control-Allow-Origin`.
- Live security headers remain incomplete: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy were absent in the observed responses. PR #52 is not deployed.
- The exact live PostgreSQL host/project/branch/runtime role has not been authoritatively mapped. Do not run a backup command against an assumed target. The checked Neon main/staging branches expose only an owner-level `rupaykg` role with CREATEDB, CREATEROLE, REPLICATION and BYPASSRLS privileges; do not use that role as the application runtime identity.
- The original Render PostgreSQL is suspended for billing. No paid action is authorized. The user has confirmed this is a new app not yet proven in a real operating environment; no irreplaceable real-world business records have been identified, so historical data recovery is out of scope unless an inventory later proves otherwise. The manual Neon snapshot belongs to an unconfirmed candidate and is not a verified production backup.
- Repository-local migration validation and workspace tests passed on the connected desktop's existing local branch; the test run skipped database integration cases that require `DATABASE_URL`. This is not a full production acceptance result.
- PR #53's seed isolation guard passed exact-head CI run #2172 for current head `10ca7d8b623b85fd0cd3340f956ae4b8f620de41` but remains draft/unmerged/undeployed; no production code was changed or deployed by that work.
- Integrated draft PR #57 combines seed isolation with security headers and database trust-boundary changes. Exact-head CI run #2230 passed for commit `5056debedc937143cd230f073cbad61f78873881`, including verified TLS through Node's default trusted roots when a custom CA is unnecessary, full tests, disposable PostgreSQL concurrency acceptance and production-container build. The Neon main candidate's 91-row migration history and the live app's 91-current-migration log are consistent, but the host mapping remains unconfirmed. PR #57 remains unmerged/undeployed. PR #47's hardware register/site-evidence documentation passed CI #2193; PR #51's exact instrument-bound hardware evidence controls passed CI #2199; PR #55's runtime-role guard passed CI #2184; PR #56's migration TLS/locking/inventory controls passed CI #2182, and the latest credential-retention hardening passed exact-head CI #2188. None has been merged or deployed.
- Guardian/Hedera live acceptance remains pending real authorized credentials and execution evidence.
