# Government Inbox Worker — Least-Privilege Role and Activation Gate

**Date:** 2026-10-31  
**Status:** Design and source audit only — worker remains OFF  
**Scope:** `apps/src/async-mirror-worker.ts`, its tests, migration/runtime integration boundary

## Executive decision

Do not create or grant a database role, add a production connection secret, or activate a worker until the actual deployed web runtime identity and the intended worker deployment identity are independently measured. The current Render database login/effective role is unknown. The known production roles include privileged/BYPASSRLS identities and are not acceptable evidence of a least-privilege worker identity.

The worker function accepts a `Pool` as an argument and issues SQL through it. This is a useful dependency-injection seam for a future dedicated worker pool, but it does not itself guarantee that the supplied pool uses a separate login. There is no worker entrypoint or worker service registration in the inspected application source; `server.ts` does not import or start the worker. Therefore this review found no evidence that the worker is currently running as part of the web process. Deployment inventory must still confirm there is no separately configured external process.

## Worker SQL access inventory

| Operation | Object(s) | Minimum capability candidate | Boundary |
|---|---|---|---|
| Exhausted-row quarantine sweep | `async_mirror_inbox` | UPDATE on status/lease/error/quarantine fields; SELECT for predicate | Must be bounded and lease-aware |
| Claim batch with `FOR UPDATE SKIP LOCKED` | `async_mirror_inbox` | SELECT plus UPDATE on claim/attempt/lease fields | Transactional claim; never expose general queue access |
| Verify payload and timestamp | Claimed row values | No additional DB grant | Pure application validation |
| Resolve jurisdiction crosswalk | `government_jurisdiction_crosswalks`, `authoritative_source_snapshots`, `activities` | SELECT only | Only approved source snapshot and verified/effective mapping |
| Validate organization geography binding | `organization_has_explicit_geography_scope`, `government_source_scope_covers_geography` | EXECUTE on exact functions; functions must be reviewed for SECURITY DEFINER/search_path | No broad schema function grant |
| Complete validated/unresolved/rejected | `async_mirror_inbox` | UPDATE only on processing/result/lease/summary fields | Fenced by id, PROCESSING status, lease token and unexpired lease |
| Retry/quarantine after exception | `async_mirror_inbox` | UPDATE only on retry/lease/error/quarantine fields | Fenced by id, PROCESSING status, lease token and unexpired lease |
| Read-only reconciliation | `async_mirror_inbox` | SELECT only | No mutation |

The table is a candidate permission map, not executable grants. Confirm exact columns, triggers, row-level policies, constraints, referenced function ownership and actual SQL plans against the current schema before generating role DDL.

## Required role separation

Create two distinct non-owner, non-superuser, non-BYPASSRLS logins only after approved design:

- **Web runtime login:** no queue claim or queue state-transition privileges. It may submit inbox rows through a narrow intake path only, if intake is retained in the web service.
- **Government inbox worker login:** only the exact queue read/update columns and reference-data SELECT/function EXECUTE listed above. No access to unrelated tenant tables, no DDL, no role administration, no DELETE/TRUNCATE/TRIGGER, no schema CREATE, no migration privileges, no access to credentials or settlement tables.

Prefer column-level UPDATE grants and narrow database functions for state transitions over broad table UPDATE. If column-level grants cannot safely support the current SQL statements, split statements or expose narrowly scoped SECURITY INVOKER functions. Avoid SECURITY DEFINER unless independently reviewed, pinned `search_path`, fixed owner and privilege escalation tests are documented.

Neither login may own tenant tables or bypass RLS. Worker access to cross-organization crosswalk data is not a license to read tenant payloads or mutate MRV data. Keep the worker's reference-data read scope explicit and independently justified.

## Current implementation risks / required remediation

1. **Pool identity is caller-controlled.** `runGovernmentInboxWorker(pool,...)` receives an arbitrary pool. A future runner must create a distinct pool from a worker-only secret (for example `GOVERNMENT_INBOX_DATABASE_URL`) and fail closed if it is absent. Do not fall back to `DATABASE_URL`.
2. **No production runner was found.** Do not wire it into `server.ts`. Build a separate process/service with a dedicated deployment identity and explicit start command only after role verification and operations approval.
3. **Claim/sweep/complete are separate pool queries.** The current worker claims with a single `UPDATE ... RETURNING` and fencing token, but the exhausted-attempt sweep and per-row result transitions are independent statements. A future hardening batch should put sweep and claim in a single checked-out-client transaction and keep each terminal transition fenced. Add lease renewal or strict bounded validation time so work exceeding the lease cannot be silently abandoned; stale workers must never overwrite a newer lease.
4. **Crosswalk lookup is a read outside the lease update transaction.** The final state write is fenced, which prevents stale completion, but source/crosswalk changes can race the lookup. Decide whether crosswalk snapshots are immutable/versioned; if not, lock or bind the exact approved source/crosswalk version in a transaction and store its identifiers in the validation summary.
5. **No real PostgreSQL worker concurrency tests were found.** Current tests use a fake pool and validate SQL text/results. Add disposable PostgreSQL tests for two concurrent claimers, expired lease reclaim, stale fencing token, long validation, crosswalk changes, retry/quarantine boundaries and role-denied writes.
6. **Historical staging queue state is protected.** The eight expired PROCESSING leases previously observed in staging must not be reset, reclaimed, replayed or quarantined as part of this work. The worker's exhausted-row sweep can change expired PROCESSING rows when invoked; therefore do not run the worker against staging until those eight records have an approved, row-specific disposition.
7. **No authoritative acceptance.** Structural validation and crosswalk resolution remain internal intake checks. They do not constitute government acceptance, CPCB registration, statutory verification, MRV approval, carbon-credit issuance or Guardian/Hedera submission.

## Mandatory verification before activation

- Obtain the exact Render web service database identity from the deployed read-only role diagnostic; compare `session_user` and `current_user`. Do not infer it from Neon role names.
- Create the worker role in a disposable production-derived branch; prove no superuser, BYPASSRLS, table ownership, schema CREATE, DDL, DELETE, TRUNCATE, TRIGGER or unrelated tenant access.
- Verify the web login cannot claim, update or read worker-only queue state beyond the approved intake API.
- Verify the worker login can perform only the required queue transitions and reference reads, and cannot modify activities, measurements, evidence, verifications, obligations, credentials, settlements or tenant memberships.
- Execute positive and negative tests using the actual worker login, not an owner/test role.
- Verify migration ledger, schema drift, backup/restore, rollback and credential rotation.
- Independent security review and explicit change-window approval.
- Only then create a separate worker deployment, with scheduler disabled until controlled activation approval.

## Non-actions

No role, grant, ownership, password, secret, Render environment, migration, database row, queue lease, deployment or scheduler was changed. No staging or production worker was run. The eight expired staging PROCESSING leases remain preserved. RLS remains disabled. Production remains HOLD.


## New finding: append-only event trigger requires a separate capability owner — 2026-10-31

Fresh live staging catalog inspection found `record_async_mirror_inbox_event()` is currently SECURITY INVOKER, has no pinned `search_path`, and is owned by the over-privileged `rupaykg` role. The trigger inserts into `async_mirror_inbox_events`. With invoker semantics, a least-privilege worker would need direct INSERT on the event table, allowing it to forge audit events independently of inbox state transitions. Granting worker INSERT is therefore rejected.

Added proposed migration `20261112_inbox_event_trigger_security_definer.sql` on this draft PR. It creates a dedicated NOLOGIN, non-superuser, non-BYPASSRLS capability role `rupaykg_inbox_event_writer`; grants only schema USAGE, event-table INSERT and event-sequence USAGE; transfers the trigger function to that owner; pins `search_path`; fully qualifies the target table; and revokes public function execution. It does not grant worker identities direct event-table INSERT.

Added `apps/src/async-mirror-worker-privileges-db.test.ts`, which connects using a genuinely separate temporary PostgreSQL login in disposable CI. It checks the definer owner attributes and privileges, verifies that the worker can update permitted inbox columns and the trigger appends an event, and verifies that direct event INSERT, inbox DELETE, payload-hash rewrite, unrelated evidence SELECT and schema DDL are denied.

CI run `41199041215` is pending. Do not treat this migration or test as passing until the entire run completes. The migration is proposed code only; it has not been applied to any Neon branch. Independent review must examine role ownership transfer, function search_path, trigger execution semantics and role grant/revoke behaviour before merge.

## CI result and production sequencing review — 2026-10-31

CI run `41199424164` completed successfully across migration validation, production-baseline reconstruction, migration application/idempotency, typecheck, build, browser smoke, disposable PostgreSQL acceptance (including the separate worker login), migration evidence upload, and production container build. This is an engineering CI pass, not a live deployment or certification.

Read-only staging catalog check: `async_mirror_inbox_events` currently has RLS disabled and is owned by `rupaykg`. The dedicated NOLOGIN event-writer role has no RLS bypass and only the narrow insert/sequence capability required by the trigger. The separate worker-login test proves trigger-driven append succeeds while direct event INSERT, inbox DELETE, immutable hash rewrite, unrelated evidence SELECT and schema DDL are denied.

**Production sequencing remains blocked.** Authoritative production `main` did not contain `async_mirror_inbox_events` or its parent inbox schema at the audit point. The event-trigger migration must not be applied standalone, and staging/rehearsal must not be treated as the production baseline. First reconcile and rehearse the complete ordered migration chain against a fresh production-derived disposable branch. Independently review PostgreSQL role-membership and function ownership-transfer semantics in that environment.

No live role/grant/ownership changes, schema migration, secrets, queue changes, deployment, or worker activation occurred.

## Explicit RLS limitation — 2026-10-31

The read-only staging catalog confirms `async_mirror_inbox_events.relrowsecurity=false` and `relforcerowsecurity=false`; the event table is owned by `rupaykg`. The disposable CI acceptance verifies role/column/table privileges, but it does **not** prove row-level tenant isolation on the inbox or event table because RLS is not enabled there. The current worker candidate is a national cross-authority queue processor and would see every inbox row permitted by its table SELECT grant. Before activation, product/data governance must explicitly approve that global processing scope or require a separate row-scoped design. Do not claim RLS tenant isolation for this queue. Enabling RLS is a separate schema/security change requiring policy design, owner/trigger behavior review, and its own positive/negative PostgreSQL tests; do not bundle it silently into the current trigger migration.
