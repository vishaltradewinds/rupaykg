# Worker least-privilege and Render runtime identity gate — 2026-10-31

## Result

**HOLD — no worker activation and no production deployment.** This batch used read-only GitHub and Render inspection plus repository documentation. No Render environment variables were read or changed; no database roles, grants, schema, records, or queue leases were changed.

## Render deployment facts

Read-only Render service inspection confirms:
- Service: `rupaykg` (`srv-daki4d7qj5pc73b8qksg`)
- Workspace: `tea-dakh7k142hec73aj2kr0`
- Repository: `vishaltradewinds/rupaykg`
- Auto-deploy: enabled on new commits
- Deployment branch: `main`
- Current live deploy: `dep-dbis4nm417fc73a8m7ng`
- Live commit: `862512c8c904cef0f604df0350f02672318953af`
- Service is a single-instance Free Docker web service in Singapore.

The protected `/api/v1/admin/database-runtime-identity` diagnostic route is on the unmerged engineering branch (PR #157); it is not in the currently deployed commit. Therefore it cannot be used to establish the current live Render database role. Merging/deploying it would trigger production auto-deploy. This was not done.

Render logs inspected for 2026-10-31 10:20–11:45 UTC show routine successful `GET /health` checks. No request to `/api/v1/admin/database-runtime-identity` appears in the inspected window. This is not evidence of the database role and does not prove whether another external process exists.

No Render environment variable values or secret contents were requested or exposed.

## Worker role test design — mandatory before activation

The worker must receive a dedicated connection identity, sourced only from `GOVERNMENT_INBOX_DATABASE_URL`. Missing/blank dedicated URL must stop startup. There must be no fallback to `DATABASE_URL`, no shared web pool, and no implicit use of the default app role.

The disposable PostgreSQL integration harness must create a temporary worker login and grant only:
- SELECT on the exact inbox columns required for eligibility, payload validation, lease inspection and event reconciliation.
- UPDATE on only the exact inbox columns required for lease claim and terminal/retry transitions.
- SELECT on approved crosswalk, source snapshot, geography directory/scope and activity reference columns.
- EXECUTE on only the two reviewed geography/scope functions.
- Any required sequence/UUID function privileges only if demonstrated by actual SQL dependency; prefer database-generated values and built-in functions with safe execution rights.

The worker login must be denied:
- INSERT/DELETE/TRUNCATE/TRIGGER/REFERENCES/DDL/schema CREATE/role administration.
- Changes to source snapshots, source scopes, crosswalk approvals, evidence vault, activities, measurements, credentials, settlements, identity/session, and tenant membership data.
- Guardian/Hedera submission, credit issuance, payout/settlement, statutory filing and external side effects.
- Table ownership, superuser, CREATEDB, CREATEROLE, BYPASSRLS, membership in privileged roles.

Tests must assert both successful allowed operations and explicit SQLSTATE/permission-denied failures for forbidden operations. The test must connect as the created worker login, not SET ROLE from a privileged connection, because session identity and role membership can otherwise be misrepresented. Verify `session_user`, `current_user`, `rolsuper`, `rolbypassrls`, `rolcreaterole`, `rolcreatedb`, object ownership and effective grants.

## Runtime identity verification

The current live role cannot be established until a safe, separately approved deployment path exists for the protected diagnostic. Before exposing it:
1. Review the diagnostic route and authorization in PR #157.
2. Confirm it returns only role booleans and safe identity labels; no DSN, host, password, role membership names, grants, or secret values.
3. Have an authorized Super Admin call it against the deployed pool.
4. Capture the exact timestamp, live deploy SHA, session_user/current_user, privilege booleans and route response status in a restricted evidence record.
5. Independently verify external Render services/cron jobs/schedulers and connected databases for any separately launched worker. The web service source tree alone cannot establish deployment inventory.
6. Compare the result with the proposed role policy; do not alter the existing app login or grant worker privileges to it.

Because Render auto-deploys `main`, a diagnostic-only change must be treated as a production deployment with release approval, rollback plan, and smoke test. Do not merge PR #157 or #159 solely to obtain the diagnostic result.

## Additional worker code risks

The current worker's pre-claim exhaustion sweep can change eligible expired `PROCESSING` rows to `QUARANTINED` when attempts are exhausted. The existing disposable PostgreSQL suite explicitly tests this behaviour. That makes worker activation especially unsafe while eight staging `PROCESSING` rows with expired leases remain preserved: before any staging worker test, record each row's attempts and approved disposition, and ensure no sweep can silently quarantine them. Do not reset, replay, or quarantine those rows as part of this gate.

The worker also uses a broad injected `Pool` API. A future runner must construct a dedicated pool only from the dedicated worker secret and run a schema-readiness check before queue operations. It must fail closed when required relations, status constraint values, functions or approved-source dependencies are absent. The schema mismatch recorded in `GOVERNMENT_INBOX_DATABASE_GATE_2026-10-31.md` currently guarantees the live staging schema is not ready.

## CI evidence

- Worker integration baseline CI run `41197792228`: completed successfully, including disposable PostgreSQL tests and container build.
- Coverage documentation CI run `41197918035`: completed successfully, including migration validation, migration execution in CI, typecheck, build, browser smoke, disposable PostgreSQL tests and production container build.
- These are clean CI PostgreSQL results, not live Neon or Render runtime-role verification.

## Gate decision

No production deployment, merge, secret update, role creation, grant, migration, worker process, scheduler or inbox mutation is authorized by this work. Worker remains **OFF**.
