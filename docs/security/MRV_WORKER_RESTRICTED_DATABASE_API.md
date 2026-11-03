# MRV Worker Restricted Database API

Status: DESIGN ONLY. No production grants, role provisioning, migrations or worker activation are authorized.

## Required operations

1. Claim one due job atomically with row locking, SKIP LOCKED, attempt increment and a fresh lease token.
2. Re-authorize against live organization, identity, membership, role permission, activity, evidence, independent verification, geography and source measurements.
3. Persist Guardian idempotency binding under the current lease only.
4. Persist Hedera network, topic and transaction binding under the current lease only.
5. Renew a live lease using the matching token only.
6. Advance only through the explicit state machine; append an immutable event in the same transaction.
7. Release only the matching live lease with bounded retry metadata.
8. Finalize provenance and complete the job atomically after reauthorization and digest reconciliation.

## Minimum privilege boundary

The dedicated worker login must not own tables or functions, inherit other roles, bypass row security, create objects, or be a member of owner/elevated roles. It must have no direct table SELECT, INSERT, UPDATE, DELETE or TRUNCATE grants. It receives EXECUTE only on the narrowly scoped worker functions. PUBLIC execution is revoked. Functions are owned by a non-login migration owner, use a fixed safe search path, fully qualify referenced objects, avoid dynamic SQL, validate inputs and enforce tenant/geography scope and lease fencing inside PostgreSQL.

Do not add broad cross-tenant RLS policies to make the worker operational. System-level queue processing is permitted only through the narrowly scoped database functions, which re-check authorization for each job at decision time.

## Source data requiring consistent authorization snapshot

The existing worker authorization reads organizations, identities, organization_memberships, roles, activities, evidence, verifications, geography scope, mrv_observations, measurements and mrv_submission_jobs. It compares deterministic ordered observation and evidence snapshots and the latest measurement to the immutable enqueue payload. All reads must occur in one consistent database snapshot and fail closed on missing, changed or ambiguous data.

## Required PostgreSQL acceptance tests

- Direct table reads and writes are denied to the runtime login across source, job, event and provenance tables.
- Only approved worker functions can be executed by the runtime login; PUBLIC and unrelated roles cannot execute them.
- Cross-tenant identifiers, revoked membership, revoked permission, invalid geography, changed evidence and changed measurements are denied.
- Concurrent claimers cannot obtain two active leases for the same job.
- Expired or stale lease tokens cannot renew, release, advance, persist provider bindings or finalize.
- Repeated provider responses are idempotent; conflicting bindings are quarantined.
- Guardian, Hedera and Mirror Node calls remain outside database transactions.
- Provenance insertion and job completion are atomic; event and provenance records are append-only.
- Function ownership, execution grants and fixed search path are verified from PostgreSQL catalogs, including hostile caller-controlled schema objects.
- Full migration chain is tested from an empty disposable database and the supported prior schema.

## Existing implementation gaps

The worker's current direct SQL design must be replaced by a typed API client. Its preflight list must include mrv_observations and measurements while direct reads remain in place. Once the function-only API exists, remove the direct-read preflight rather than granting broad reads. The worker privilege query's escaped newline defect has been corrected in source; exact-head CI validation remains outstanding.

## Release gate

No runtime role provisioning, grants, production migration, worker enablement or TRL certification until the function API, TypeScript refactor, disposable PostgreSQL acceptance tests and independent DBA/security review are complete.

## Concrete function contract (implementation target; not installed)

The TypeScript worker call sites map to exactly these eight PostgreSQL entry points. Signatures below are the contract to implement and test, not a claim that these functions exist.

### Claim eligibility and recovery boundary

The claim function must preserve the existing `claimableStatuses` allow-list exactly: `REQUESTED`, `CLAIMED`, `GUARDIAN_SUBMITTED`, `GUARDIAN_VERIFIED`, `HCS_SUBMITTED`, `HCS_CONSENSUS_CONFIRMED`, `MIRROR_VERIFIED`, and `RETRYABLE_FAILURE`. It must not claim `NEEDS_RECONCILIATION`, `PERMANENT_FAILURE`, `REJECTED`, `PROVENANCE_PERSISTED`, `COMPLETED`, or `CANCELLED`. Only `REQUESTED` and `RETRYABLE_FAILURE` become `CLAIMED`; expired in-flight stage statuses retain their exact stage and are reclaimed with a fresh lease. This matches the restricted worker's stage dispatch and prevents an ambiguous external operation from being replayed as a new operation.

`NEEDS_RECONCILIATION` is an operator-controlled quarantine state, not an automatic retry state. It requires a separate audited reconciliation workflow that inspects persisted provider bindings and external Guardian/Hedera/Mirror evidence, records an explicit decision, and only then permits a controlled transition back to a supported processing stage. Do not include it in the worker claim query until that workflow is implemented and independently tested.

Binding functions must not perform state transitions. `persist_guardian_binding` may bind only in `GUARDIAN_SUBMITTED`; `persist_hedera_binding` may bind in `GUARDIAN_VERIFIED` or idempotently verify the same tuple in `HCS_SUBMITTED`. The separate `advance_job` call owns all state transitions and event-trigger execution. This separation is required because the restricted worker persists a provider binding and then advances state in a distinct fenced operation; a binding function that also changes status would create a double-transition/lease-clearing race.

| Operation | Required signature | Atomic responsibility |
|---|---|---|
| Claim | `mrv_worker_api.claim_next_job(text, integer) returns jsonb` | Select one due row with `FOR UPDATE SKIP LOCKED`, install a fresh UUID lease, increment attempt count, and return the complete immutable job snapshot plus lease token. |
| Live authorization | `mrv_worker_api.authorize_job(uuid) returns boolean` | In one statement/snapshot, re-check the verified organization, unsuspended requester, active same-org verified membership, role permission, completed activity, verified evidence, independent approved verification, geography scope, and exact observations/evidence/latest-measurement snapshot equality. |
| Guardian binding | `mrv_worker_api.persist_guardian_binding(uuid, uuid, text) returns boolean` | Lease-fenced, immutable idempotency binding; allow only GUARDIAN_SUBMITTED and reject conflicting retries. |
| Hedera binding | `mrv_worker_api.persist_hedera_binding(uuid, uuid, text, text, text) returns boolean` | Lease-fenced, immutable network/topic/transaction tuple; allow GUARDIAN_VERIFIED or idempotently verify the same tuple in HCS_SUBMITTED; reject conflicting retries. |
| Renew | `mrv_worker_api.renew_lease(uuid, uuid, integer) returns timestamptz` | Extend only a currently live matching lease; bound duration to 10–900 seconds. |
| Advance | `mrv_worker_api.advance_job(uuid, uuid, text, jsonb) returns jsonb` | Validate state transition and an explicit patch-key/type allow-list; fence by live token; clear lease; let the existing trigger append the event in the same transaction. |
| Release | `mrv_worker_api.release_job(uuid, uuid, timestamptz, text, text) returns boolean` | Clear only the matching live lease and store bounded retry/error metadata. |
| Finalize | `mrv_worker_api.finalize_provenance(uuid, uuid, text) returns boolean` | Re-check authorization and the persisted Mirror digest; insert-or-verify the exact provenance tuple; transition through PROVENANCE_PERSISTED to COMPLETED and append events atomically. |

The API must return no source-row data from authorization failures. It must not accept caller-supplied organization, geography, requester, activity, evidence or verification scope: those are derived from the locked job row and checked against live source rows. The worker may pass only the job ID and lease token for authorization.

### Trusted function-owner boundary under FORCE RLS

The runtime login remains function-only: no direct table grants, no role memberships, no schema CREATE, no BYPASSRLS. The eight functions require a dedicated NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS owner with no memberships. That owner receives only the table privileges needed by the functions and explicit RLS policies scoped to that owner on the exact source, job, event and provenance tables. Do not solve this by granting BYPASSRLS, making the runtime login a table owner, or adding a broad policy for PUBLIC/application roles. Function bodies must enforce the full job-derived tenant/geography binding before any cross-tenant queue operation or mutation. The owner/policy/grant design must be tested with FORCE ROW LEVEL SECURITY enabled and hostile caller-controlled schemas.

The runtime preflight's catalog checks must separately verify: (1) exact worker login attributes and no memberships; (2) zero direct table privileges; (3) EXECUTE on all eight exact signatures; (4) no PUBLIC EXECUTE on any signature; (5) expected SECURITY DEFINER owner and pinned search_path for each function; and (6) RLS plus FORCE RLS on every source/ledger/sink table. Checking only `claim_next_job` is insufficient once the full API exists.

### Source-to-API refactor rule

After all eight functions and their disposable PostgreSQL tests exist, replace `PoolClient`/SQL helpers in `mrv-submission-worker.ts` with a typed `MrvWorkerDatabase` adapter that calls only `select * from mrv_worker_api.<function>(...)`. Remove `mrv-submission-jobs.ts` direct-table helpers from the worker path. Keep Guardian, Hedera and Mirror Node network calls outside database transactions. Keep the same persisted provider idempotency and lease-token fencing semantics. The API adapter must validate returned JSON shape before provider calls.

### Schema facts verified from the current migration source

- `mrv_submission_jobs` and its immutable request payload/lease/state columns are created by `20261109_durable_mrv_submission_jobs.sql`.
- Append-only `mrv_submission_job_events` and its transition event trigger are created in that same migration; status changes already emit events transactionally.
- `mrv_provenance_events` is created in `015_guardian_hedera_mrv.sql`; Mirror Node timestamp is added in `083_mrv_mirror_node_registry_gate.sql`.
- Live authorization currently reads `organizations.status`, `identities.status/suspended_at`, `organization_memberships.status/role_id`, `roles.permissions`, `activities`, `evidence`, `verifications`, `organization_has_geography_scope`, `mrv_observations`, and `measurements`.
- The provenance uniqueness key is `(activity_id, verification_id, integrity_hash)`; the finalize function must verify an existing row's evidence, Guardian execution, HCS transaction and Mirror timestamp before treating a conflict as idempotent.

No API migration or owner role is included in this design update. These contracts must be implemented against the full migration chain and verified on disposable PostgreSQL before the runtime role is provisioned.


### Claim index and legacy transition reconciliation (2026-11-03)

The durable-job migration's original partial index covered only REQUESTED, RETRYABLE_FAILURE and CLAIMED, although the legacy claim query's exact allow-list also includes GUARDIAN_SUBMITTED, GUARDIAN_VERIFIED, HCS_SUBMITTED, HCS_CONSENSUS_CONFIRMED and MIRROR_VERIFIED. Migration `20261113_mrv_worker_claim_index_reconcile.sql` replaces that partial index with the complete eight-status predicate and aligns its key order with `next_attempt_at, created_at, id`. The SQL claim function must use the identical predicate and ordering; the index is an optimization, not an authorization boundary.

The legacy `persistMrvHcsTransactionId` helper updates status to HCS_SUBMITTED while persisting the HCS binding. The restricted worker intentionally makes two API calls: persist the immutable network/topic/transaction tuple while the job remains GUARDIAN_VERIFIED, then call `advance_job` to HCS_SUBMITTED. The restricted SQL binding function must update only the tuple and must not change status or clear the lease. The transition function alone changes status, clears the lease, and relies on the existing event trigger. The legacy helper must not be called by the restricted worker.

The existing migration's status guard permits NEEDS_RECONCILIATION -> CLAIMED, but the worker claim allow-list excludes NEEDS_RECONCILIATION. Preserve that quarantine in the worker API: only a separately audited operator reconciliation action may request a controlled transition. Do not infer safety from the generic trigger's wider transition matrix.
