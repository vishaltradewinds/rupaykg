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


## Atomic claim and PostgreSQL concurrency hardening — 2026-10-31

A separate draft engineering branch, `shakti/atomic-inbox-claim-2026-10-31`, changes the worker's exhausted-attempt sweep and batch claim into one PostgreSQL data-modifying CTE statement. This gives the sweep+claim one statement-level transaction boundary; the claim still uses `FOR UPDATE SKIP LOCKED`, and application validation starts only after the statement completes. This avoids holding queue row locks during slow validation and removes the prior inter-statement gap between sweep and claim.

Added disposable PostgreSQL integration tests:
- Two concurrent worker invocations each claim a bounded batch; the four fixture rows must be claimed exactly once across both invocations.
- A simulated replacement fencing token during validation prevents the original worker from marking the row REJECTED; the row remains PROCESSING under the replacement token.

The fixtures are synthetic and run only in disposable CI PostgreSQL. They intentionally leave append-only event history in that ephemeral database; no staging or production queue rows are touched.

**Limits still open:** this does not renew a lease during long validation. If validation exceeds the lease, the final fenced update is correctly rejected, but the row may remain PROCESSING until a later worker reclaims it. Crosswalk reads are still not bound to an immutable/versioned snapshot transaction. These were separate follow-up gates at the time of this entry; the later section “Bounded validation and lease renewal” records the engineering implementation and tests. Actual deployed worker identity, RLS/global authority scope approval, migration-principal semantics, exact-head CI and production-derived full-chain rehearsal remain release blockers. No worker service, schedule, secret, role, live database or deployment was activated or changed.


### Concurrency-test harness correction — 2026-10-31

The first CI execution exposed a test-barrier design error: the worker processes each claimed row sequentially, so waiting for all four validators to enter before releasing any validator deadlocked both worker loops after their first row. The test barrier now releases when both worker invocations have entered their first validation call; each then proceeds through its second row. This is a test-only correction, not a production-worker behavior change. Re-run the full CI suite on the corrected head before accepting the batch.


## Source snapshot / crosswalk transaction integrity — 2026-10-31

The atomic-claim worker follow-up now resolves a candidate jurisdiction crosswalk and persists the inbox terminal decision within one SERIALIZABLE PostgreSQL transaction.

- Before reading candidates, the worker takes a transaction-scoped advisory lock keyed by authority code, municipal code and source version (unit-separator-delimited, hashtextextended). This prevents a concurrent matching crosswalk INSERT/UPDATE from creating a phantom candidate during resolution.
- New forward-only migration 20261113_government_crosswalk_resolution_key_lock.sql installs a BEFORE INSERT/UPDATE trigger on government_jurisdiction_crosswalks. The trigger takes the same lock; on key changes it locks old/new keys in deterministic lexical order to avoid lock-order deadlocks.
- Candidate selection uses FOR SHARE OF c,s for the verified crosswalk and approved source snapshot. Snapshot retirement and crosswalk status changes therefore cannot commit between the resolution read and the fenced inbox terminal update.
- The same transaction writes VALIDATED or UNRESOLVED, retains the lease-token and unexpired-lease fence, and commits before releasing the connection. A failed/expired fence commits no successful terminal transition.
- Validation evidence now persists the exact source snapshot ID, content SHA-256, dataset code, scope kind/code, scope geography ID and scope directory source ID alongside the crosswalk ID/version.
- Serialization/lock failures roll back the resolution transaction and enter the existing fenced retry path. No live Neon migration, role, grant, queue, worker or scheduler change is authorized.

Unit tests now assert transaction ordering, the advisory lock, row locks and persisted snapshot identity/hash. Disposable PostgreSQL acceptance adds a competing crosswalk-revocation test: mutation must time out while the same jurisdiction-key lock is held, then succeed after release.

This closes the previously identified read-to-terminal-update gap for matching crosswalk inserts/updates and source/crosswalk retirement/revocation, subject to exact-head CI and independent review. It does not solve the separate global-vs-row-scoped queue governance decision, RLS, exact-head CI or production migration-principal authority. The later “Bounded validation and lease renewal” section records the follow-on engineering implementation. PR #161 remains draft/unmerged; production remains HOLD; worker OFF; TRL 9 unclaimed.


Validation note: the stacked worker branch is temporarily targeted at main solely to run the full production-baseline CI workflow; it remains draft and unmerged, and its original stacked base will be restored after the exact-head run.


### Heartbeat failure cancellation acceptance — 2026-10-31

Added a unit regression test that forces the periodic PostgreSQL lease-renewal query to fail while a validator is active. The test confirms the worker aborts the validator through its AbortSignal and persists a token-fenced RETRY with `LEASE_RENEWAL_FAILED`, rather than allowing a potentially orphaned validation to continue as trusted work. This complements the disposable PostgreSQL success-path test for renewal beyond the original lease interval and the timeout/retry acceptance.

The new test is committed but must pass on the current exact head before this gate is accepted. It does not prove that arbitrary validators ignoring AbortSignal can be forcibly stopped; production validators must be cooperative and side-effect-free.

## Bounded validation and lease renewal — 2026-10-31

The worker now has a bounded validation deadline and lease heartbeat:

- Validator input receives an optional AbortSignal. Each validator invocation races a strict configurable deadline (default 60 seconds, capped to leave at least two seconds before lease expiry); timeout aborts cooperative validators and routes the row through the existing fenced retry/quarantine transition.
- Claimed leases are renewed periodically (default one-third of the lease duration) using a single set-based UPDATE joined to exact inbox-ID and lease-token pairs. Renewal requires PROCESSING status and an unexpired lease; an expired or superseded lease is never resurrected.
- Rows awaiting their turn in the claimed batch are renewed too, preventing sequential batch processing from silently expiring later rows.
- Before a terminal transition, the worker pauses renewal for that row, waits for any in-flight heartbeat, refreshes the lease under the same token, and then performs the fenced terminal write. This avoids a heartbeat racing the SERIALIZABLE source-resolution transaction or terminal update.
- If a heartbeat loses a lease or fails, the worker aborts the active validator and stops trusting the affected lease set. All retries and terminal updates remain fenced.
- Counters still increment only after the source-resolution transaction commits.

Unit tests cover strict timeout/abort, retry error code and heartbeat issuance. Disposable PostgreSQL acceptance now checks that a cooperative validator timeout produces RETRY and that a validator running longer than the original lease window retains a renewed lease and can complete under its original token.

This is an engineering implementation and test addition only. Exact-head CI and independent code review remain mandatory. Validator implementations must honor AbortSignal to stop underlying work promptly; Promise racing prevents the worker from waiting indefinitely but cannot forcibly terminate arbitrary JavaScript or remote operations that ignore cancellation. Keep validators side-effect free. No production/staging queue, schema, role, grant, service, schedule or deployment was changed. Worker OFF; production HOLD; TRL 9 unclaimed.


## Production migration-principal authority reconciliation — 2026-10-31

Read-only Neon inspection reconfirmed the authoritative project and branch identities:

- Project `rupaykg-production-fresh`, project ID `steep-mud-79906940`, PostgreSQL 18.6.
- Production `main`: `br-restless-base-b44cip2h`; database `rupaykg`.
- Staging: `br-spring-hill-b4544vz5`; production-derived rehearsal: `br-spring-lab-b4hqez2o` (ready, idle, zero compute time).
- On production main, current/session user is `rupaykg`. It has CREATEROLE, CREATEDB, REPLICATION and BYPASSRLS, and is a member of `neon_superuser` with SET/INHERIT but not ADMIN OPTION. It has CREATE on schema public. Public schema owner is `pg_database_owner`; the 67 public tables are owned by `rupaykg`; public functions are split between `rupaykg` and `cloud_admin`.
- Production main currently has no async inbox, inbox event, crosswalk or authoritative source snapshot tables, no `record_async_mirror_inbox_event()` function, and no `rupaykg_inbox_event_writer` role.
- Staging has `async_mirror_inbox` and `async_mirror_inbox_events`, both owned by `rupaykg`, but both have RLS and FORCE RLS disabled. Its current event trigger function is owned by `rupaykg`, is not SECURITY DEFINER, and the proposed NOLOGIN writer role does not exist there. The proposed migration #12 is not yet applied on staging.
- This proves the observed production principal has the role-creation attribute and schema CREATE needed by the proposed capability-role migration, and staging's existing event function is owned by that same principal. It does not by itself prove the full GRANT-to-current-user / ALTER FUNCTION OWNER / REVOKE sequence under the non-superuser principal.

Added disposable PostgreSQL acceptance that simulates the observed production role attributes (CREATEROLE, CREATEDB, REPLICATION, BYPASSRLS, non-superuser), creates the NOLOGIN least-privilege event-writer role, grants membership to CURRENT_USER, transfers a SECURITY DEFINER trigger function, revokes temporary CREATE/membership, and proves the function can append to its target table after ownership transfer. The test is not a live Neon rehearsal. Exact-head CI is pending.

No Neon SQL mutations, role/grant changes, compute activation, migration preparation, production/staging schema changes or worker activation occurred. Production HOLD; worker OFF; RLS/global queue governance remains unresolved; TRL 9 unclaimed.


## Production-shaped migration-principal acceptance — passed 2026-10-31

The disposable PostgreSQL acceptance now reproduces the production migration principal's relevant authority model: non-superuser, CREATEROLE, CREATEDB, REPLICATION, BYPASSRLS, and ownership of the database (implicit membership in pg_database_owner) plus the inbox event table and sequence. Under that role it successfully:

- Creates the NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOBYPASSRLS event-writer role.
- Grants the capability role to CURRENT_USER.
- Grants only schema usage, event-table INSERT and event-sequence usage to the capability role.
- Creates the fixed-search-path SECURITY DEFINER trigger and transfers its ownership to the capability role.
- Revokes temporary schema CREATE and role membership from the migration principal.
- Executes the trigger successfully after transfer; verifies the function owner, SECURITY DEFINER flag, fixed search_path, append result and restricted role attributes.

The first simulation attempt was incomplete because it did not model database ownership or event-table/sequence ownership. The fixture was corrected to match the observed production model; the corrected acceptance passed. This is disposable CI evidence, not a live Neon migration.

Exact-head CI run [#41203528525](https://github.com/vishaltradewinds/rupaykg/actions/runs/41203528525) (run 3845) passed at commit 19b431008e96598d7306455374474934cd9a7cfc. All 17 workflow steps passed, including dependency audit, migration validation, production-baseline reconstruction, migration application/idempotency, typecheck, build, browser smoke, serial unit + disposable PostgreSQL acceptance, migration report artifact upload and production container build.

The PR remains draft/open/unmerged. The CI run does not authorize applying the migration to staging/production. The exact deployment secret principal still needs to be confirmed separately; the audit establishes the Neon database-owner role model only.
