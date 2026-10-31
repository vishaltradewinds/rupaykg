# Dedicated worker pool and schema-readiness guard — 2026-10-31

## Change

Added on branch `shakti/integrate-government-inbox-worker-2026-10-31`:

- `apps/src/async-mirror-worker-runner.ts`
- `apps/src/async-mirror-worker-runner.test.ts`

The new pool factory:
- Requires `GOVERNMENT_INBOX_DATABASE_URL`.
- Has no fallback to `DATABASE_URL`.
- Rejects a worker URL whose parsed endpoint/database/login/password are identical to the application URL.
- Uses a bounded pool size of 2 and a distinct application_name.
- Does not start a worker, schedule work, or mutate a database.

The read-only schema preflight checks:
- inbox and append-only event relations;
- jurisdiction crosswalk and authoritative source snapshot relations;
- explicit geography-scope and source-scope geography functions;
- status check support for `UNRESOLVED`;
- the inbox event trigger.

It fails closed before queue operations if any dependency is absent. The query is catalog-only and performs no writes.

## Tests added

Unit tests cover:
- no dedicated URL despite DATABASE_URL being present;
- rejection of identical app and worker principals;
- use of only the dedicated URL with bounded pool configuration;
- complete schema passes;
- missing crosswalk/source-snapshot/scope function/UNRESOLVED fails closed;
- empty catalog response fails closed;
- preflight SQL contains no write statement.

## Important limitations

This is a safe foundation, not a production worker runner:
- It is not imported or invoked by the web server.
- It does not start, schedule or activate the worker.
- It does not prove that a real PostgreSQL worker role has least privilege.
- It does not create roles or grants.
- It does not establish the live Render role; the protected diagnostic remains only on unmerged PR #157 while Render auto-deploys main.
- It does not make the live staging schema ready; the previously recorded migration mismatch remains.
- The role integration test must still create and connect as a separate worker login on disposable PostgreSQL and prove allowed and denied privileges. It must not simulate the role solely with SET ROLE.

## CI

The new files trigger CI run `41198239381`. Results must be checked before treating the implementation as passing.

## Safety

No production/staging database, Render service, secret, role, grant, queue record, deployment or scheduler was changed. Worker remains OFF.
