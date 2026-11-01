# Production startup and migration separation

**Status:** Proposed change; release remains HOLD until reviewed and validated.
**Scope:** Container startup behavior only. This document does not authorize a production migration or deployment.

## Required execution order

1. Build one immutable application image from the reviewed commit.
2. Confirm the target environment, Neon project, branch, database, migration ledger, backup/restore point, and approved change window.
3. Run the image's explicit migration command as a separately authorized one-off release task: `npm run migrate:production`.
4. Capture the command exit status and complete logs. A non-zero exit blocks deployment.
5. Verify the migration ledger and required schema invariants using read-only checks.
6. Deploy the same immutable image with its normal application entrypoint.
7. Verify health, critical API paths, tenant authorization, and error rates. Roll back the application image if verification fails; do not assume schema rollback is safe.

## Safety boundaries

- The application container entrypoint starts only `production-server.js`.
- Acceptance/demo seed data must never be run automatically in a production container.
- The migration command is intentionally explicit and must run only in an approved, separately observable release task.
- Do not run migrations concurrently from multiple replicas.
- Do not run a migration until the exact target Neon branch/database identity and migration compatibility have been verified.
- Do not run against staging or production from a developer workstation using an ambiguous connection string.
- A migration failure is a hard stop; investigate and rehearse on a disposable Neon branch before retrying.
- This change does not establish tenant isolation, production readiness, certification, or TRL 9.

## Deployment adapter still required

The repository change provides a safe application default and an explicit migration command. The platform-specific one-off job/pre-deploy mechanism must be configured and tested separately for the actual deployment target. Until that adapter is proven, production remains HOLD.
