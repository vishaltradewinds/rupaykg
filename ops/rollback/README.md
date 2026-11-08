# RupayKg Production Rollback Acceptance Contract

## Purpose

Define the evidence required to demonstrate that an application rollback can be performed without falsely treating PostgreSQL state as rolled back.

## Required evidence

1. Identify the current live deployment and the last known-good application deployment.
2. Record application commit/deployment identifiers and current database migration state.
3. Confirm database compatibility before rollback.
4. Roll back only the application artifact in the controlled deployment environment.
5. Verify `/health` reports a live PostgreSQL-backed service.
6. Verify authentication and critical API flows after rollback.
7. Verify database state was not implicitly reverted by the application rollback.
8. Reconcile schema/data compatibility separately using a controlled database procedure.
9. Record UTC timestamps, deployment identifiers, migration state, verification results and rollback outcome.
10. Preserve evidence without credentials, bearer tokens or sensitive payloads.

## Fail-closed boundary

Application rollback is not database rollback.

A successful deployment rollback is not sufficient evidence.

HTTP 200 is not sufficient evidence.

The gate closes only after application health, authentication, critical flows and database compatibility are verified after rollback.

## Production safety

- Do not roll back production solely from this repository contract.
- Use the deployment provider's controlled rollback mechanism.
- Do not execute destructive database changes as part of an application rollback.
- Stop if the previous application artifact is incompatible with the current database schema.

## Current status

**OPEN** — rollback procedure is documented; controlled rollback evidence is not currently captured in the repository.

## Next execution

Execute this acceptance in the controlled deployment environment using the provider's rollback mechanism and preserve immutable operational evidence.