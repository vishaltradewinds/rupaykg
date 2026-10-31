# Render runtime and deployment security audit — 2026-10-31

**Scope:** read-only inspection of Render service metadata and canonical repository runtime startup files, followed by a proposed review-branch hardening change. No Render settings, secrets, live deployment or production database were modified.

## Observed deployment

- Render service: `rupaykg` (`srv-daki4d7qj5pc73b8qksg`).
- Repository: `vishaltradewinds/rupaykg`.
- Deploy branch: `main`; automatic deploy on commit enabled.
- Runtime: Docker; Dockerfile `./Dockerfile`; one free-plan instance; public URL `https://rupaykg.onrender.com`.
- Latest observed live deployment: `dep-dbis4nm417fc73a8m7ng`, source commit `862512c8c904cef0f604df0350f02672318953af`.
- The service is publicly reachable and configured with IP allowlist `0.0.0.0/0`. Application-layer authentication, abuse protection and rate limiting therefore remain required.

Render metadata does not expose the effective Neon database target. No secret value was read, printed or changed. The exact database identity used by the deployed process remains **UNVERIFIED**.

## Critical startup findings

The inspected Dockerfile previously executed:

1. `node apps/dist/src/migrate.js`
2. `node apps/dist/src/acceptance-seed.js`
3. `node apps/dist/src/production-server.js`

The migration runner creates the `schema_migrations` table if absent and applies every repository migration whose version is not already recorded. It has no explicit production database identity allowlist or separate approval token. Consequently, every web-service restart/deploy could attempt schema writes to whatever database `DATABASE_URL` resolves to. The database target was not verified in this audit. This is an unsafe coupling between web deployment and schema change execution.

The acceptance seed is guarded by `RUPAYKG_ACCEPTANCE_SEED_ON_START=true`, but the production configuration's synthetic-data check validates a different variable, `RUPAYKG_SYNTHETIC_DATA`. The seed inserts acceptance identities, organisation, roles, memberships, geography scope, activity, measurement, evidence, verification, MRV observation and session. Therefore, if the seed opt-in variable were accidentally set on the production service, the prior Docker startup command could create acceptance fixture records in the target database. This is a concrete fail-closed gap.

## Review-branch hardening applied

- Docker web-service command now starts only `production-server.js`; migrations are no longer run implicitly at web-service startup.
- API package `start` script now starts only the production server.
- Acceptance seed now rejects `NODE_ENV=production` before checking its opt-in flag.
- The explicit migration command remains available for a separately controlled release operation. CI continues to run migration validation and disposable-database migration tests.

These changes are on the cleanup review branch only. They are not merged or deployed. They intentionally do not apply or roll back any database migration.

## Required migration release procedure

Before any production schema change:
1. Verify the target database using a non-secret identity query and compare project/branch/database identifiers with the approved change record.
2. Verify the exact migration file set, ordering, dependency graph and SQL-byte hashes.
3. Rehearse the entire ordered migration set on a fresh production-derived disposable branch.
4. Capture pre/post schema diff, ledger diff, migration output and rollback/forward-recovery plan.
5. Use a separately provisioned least-privilege migration identity; do not reuse the web runtime credential or database owner.
6. Require independent review and explicit change-window approval.
7. Apply the migration as a distinct release operation; verify schema and ledger; only then deploy compatible application code.
8. Keep the web service startup migration-free.

## Remaining blockers

- Exact Render runtime database target remains unverified.
- No independent evidence yet establishes that the Render runtime database role is least privilege.
- No separate, fully governed production migration job/credential is evidenced.
- Public ingress requires application-level rate limiting, abuse controls, security headers, monitoring and penetration testing.
- No production RLS policies were found in the authoritative database inspection; tenant isolation is not database-enforced.

## Status

**Review change only · production unchanged · no migration executed · no deployment triggered.**
