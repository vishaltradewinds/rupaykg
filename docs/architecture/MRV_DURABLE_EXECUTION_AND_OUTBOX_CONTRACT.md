# RupayKg MRV Durable Execution — Architecture and Acceptance Contract

**Status:** design approved for implementation planning; not a production migration or release approval  
**Scope:** Guardian MRV execution, Hedera HCS anchoring, Mirror Node verification, provenance persistence and registry eligibility  
**Governing rule:** external trust-rail calls must never run inside a long-lived database transaction; every stage must be durable, replay-safe, actor-bound and auditable.

## 1. Current state and verified correction

The submit route previously held a session advisory lock on one checked-out PostgreSQL client while issuing its reads and provenance writes through `pool.query` on other connections. The route now uses the same checked-out client for the lock, activity/verification/evidence reads, authorization checks, observations, replay lookup and provenance persistence.

This fixes the lock/connection split. It does **not** yet implement a durable outbox, a transaction-local signed RLS context, worker leasing, or crash-safe exactly-once external effects. The session advisory lock is still held across Guardian and Hedera network calls. Do not describe this as complete distributed transaction safety.

Guardian already derives a deterministic SHA-256 idempotency key from activity, verification, evidence, policy and methodology, and sends it as the `Idempotency-Key` header. This is a useful provider contract, but it only protects retries if the configured Guardian service actually honors and retains that key.

Hedera submit currently creates a fresh SDK transaction ID internally. If the process crashes after Hedera accepts a transaction but before the response is persisted, a retry may submit a second anchor. This is the main unresolved duplicate-effect window.

## 2. Required durable state machine

Use a dedicated `mrv_submission_jobs` record keyed by a deterministic request key and immutable payload hash. It is an execution ledger/outbox, not a replacement for `mrv_provenance_events`.

State progression:

```text
REQUESTED
  -> CLAIMED
  -> GUARDIAN_SUBMITTED
  -> GUARDIAN_VERIFIED
  -> HCS_SUBMITTED
  -> HCS_CONSENSUS_CONFIRMED
  -> MIRROR_VERIFIED
  -> PROVENANCE_PERSISTED
  -> COMPLETED

Terminal / recoverable branches:
  REJECTED, RETRYABLE_FAILURE, PERMANENT_FAILURE, NEEDS_RECONCILIATION
```

Each transition must be compare-and-set against the expected prior state and active lease token. Persist stage result before advancing. A worker crash must leave a recoverable state, not a silently lost side effect.

## 3. Data contract

Proposed job fields (names may be adapted to existing naming conventions during implementation):

- `id` UUID primary key.
- `idempotency_key` unique deterministic key derived from activity, verification, evidence, Guardian policy and methodology.
- `payload_hash` immutable SHA-256 of the exact canonical MRV input snapshot.
- `activity_id`, `verification_id`, `evidence_id`, `organization_id`, `geography_id`.
- `requested_by_identity_id` and authorization snapshot identifiers; never trust a client-supplied actor or organization.
- `status`, `attempt_count`, `lease_owner`, `lease_token`, `lease_expires_at`, `next_attempt_at`.
- `guardian_idempotency_key`, `guardian_execution_id`, `guardian_status`, bounded sanitized response metadata.
- `hedera_network`, `hedera_topic_id`, `hedera_transaction_id`, `hedera_consensus_timestamp`, `hedera_status`.
- `mirror_verified_at`, `mirror_verification_digest`, `last_error_code`, bounded sanitized error details.
- `created_at`, `updated_at`, `completed_at`.

Use restrictive checks for status values, non-empty identifiers, and immutable binding columns. Keep raw secrets, bearer tokens, private keys and unrestricted provider response bodies out of this table. Payload snapshots should contain only the evidence/measurement data necessary to reproduce the request and should follow the platform's evidence retention/access controls.

## 4. Transaction boundaries

### A. Request / claim transaction
1. Authenticate request.
2. Start a short transaction on one checked-out client.
3. Set signed, transaction-local actor context using the existing verified request-context mechanism.
4. Lock and re-read activity, verification, evidence, organization, geography and current authorization.
5. Confirm all three source records bind to the same activity; require completed activity, approved verification, verified evidence, verified organization membership, explicit `guardian:operate`, and verified geography scope for the owning organization.
6. Build canonical payload and hash server-side.
7. Insert or retrieve the unique idempotency job. If the same key exists with a different payload hash, reject with a conflict and create an auditable security event.
8. Claim only if the state is eligible and the lease is absent/expired; assign a fresh random lease token and bounded expiry.
9. Commit. No Guardian/Hedera/Mirror Node call inside this transaction.

### B. Guardian stage
1. Call Guardian outside a DB transaction with the persisted deterministic idempotency key and correlation ID.
2. Persist the returned execution ID and decision using a short transaction and lease-token compare-and-set.
3. If the provider times out, query/retry using the same idempotency key; never silently mint a new key for the same payload.
4. A VERIFIED result without an authoritative execution ID remains unavailable and cannot advance.

### C. Hedera stage
1. Generate and persist a stable Hedera transaction ID before submission, using the configured operator account and SDK-supported transaction ID contract.
2. Submit using that exact transaction ID.
3. On retry, reuse the persisted transaction ID; query Mirror Node/reconciliation endpoints before considering a new transaction ID.
4. Persist transaction ID and consensus response with a lease-token compare-and-set.
5. If the SDK/provider cannot support deterministic retry with the same transaction ID, set `NEEDS_RECONCILIATION` after ambiguous timeouts and do not auto-submit a new anchor. This prevents duplicate HCS writes at the cost of manual/provider reconciliation.

### D. Mirror Node and finalization
1. Verify exact topic, consensus timestamp, transaction, schema, activity, verification, evidence, Guardian execution ID and integrity hash outside a DB transaction.
2. Start a short finalization transaction; re-establish signed actor context and revalidate current actor authorization, owning organization, geography and immutable source bindings.
3. Persist `mrv_provenance_events` with exact Guardian/HCS values and only set `mirror_node_verified_at` after successful independent Mirror Node verification.
4. Mark job `COMPLETED` using expected state + lease token.
5. Credential issuance remains blocked by the existing database trigger until exact provenance is persisted and Mirror Node verified.

## 5. Authorization and tenant isolation

- The job's organization and geography are derived from the activity row, never request JSON.
- Every claim and finalize transaction revalidates the actor's current verified membership and `guardian:operate` permission.
- Organization scope must be exact; a different verified membership cannot authorize this activity.
- A worker must use a dedicated least-privilege runtime role and a signed, short-lived job execution context. It must not use the privileged migration/owner role.
- Enable RLS only after the full 67-table ownership matrix, route/worker inventory, role design and two-tenant negative tests are accepted.
- Background worker claims, lease renewals and finalization are protected data paths and must appear in the endpoint-to-table-to-function authorization matrix.

## 6. Required failure and concurrency tests

1. Same idempotency key + same payload returns the same job and never starts a second active provider submission.
2. Same idempotency key + different payload is rejected.
3. Two concurrent workers cannot claim the same unexpired lease.
4. Expired lease can be recovered without losing already persisted Guardian/HCS stage results.
5. Crash after Guardian accepts but before DB persistence reuses the same Guardian idempotency key and recovers the same execution.
6. Crash after HCS accepts but before DB persistence reuses the same persisted Hedera transaction ID; ambiguous result moves to reconciliation, not blind resubmission.
7. Wrong actor, revoked membership, wrong organization, unverified geography, wrong evidence, changed payload and stale lease token all fail.
8. Provider REJECTED is terminal and never creates registry-eligible provenance.
9. Mirror Node mismatch never sets `mirror_node_verified_at`.
10. Credential insert/update stays blocked until exact verified provenance is present.
11. No external network call occurs inside a DB transaction.
12. Job/event audit history is append-only or tamper-evident and contains no secrets.

## 7. Rollout sequence

1. Implement migration and disposable-PostgreSQL tests only.
2. Implement repository/state-transition layer and lease concurrency tests.
3. Refactor Guardian adapter to accept persisted idempotency/correlation keys.
4. Refactor Hedera adapter to accept a persisted SDK transaction ID; prove retry semantics against a controlled test network before production use.
5. Implement claim, provider-stage, reconciliation and finalize worker paths.
6. Add actor-bound RLS context to claim and finalize and test exact runtime role grants.
7. Run fault injection at every transition, including process termination after provider acceptance.
8. Complete independent security review, backup/restore and rollback rehearsal.
9. Pilot only after production owner/runtime privilege separation and all tenant isolation gates are accepted.

## 8. Explicit release gates

This design does not authorize production changes. Do not merge/deploy the migration until:
- all 67 production tables have a reviewed RLS policy or documented non-tenant classification;
- runtime roles are least-privilege and do not own protected tables or bypass RLS;
- all API and worker paths bind actor context and use a single transaction client for protected SQL;
- bilateral operations use an explicit two-party authorization contract;
- external Guardian/Hedera retries are proven idempotent with fault-injection tests;
- CI, independent DBA/security review, backup/restore and rollback checks pass.

**Current release posture remains Production HOLD, Certification OFF, and platform-wide TRL 9 NOT ESTABLISHED.**


## Implementation progress (2026-11-02)

An initial schema slice is now present in `migrations/20261109_durable_mrv_submission_jobs.sql`: immutable request/payload binding, organization/geography/source references, explicit stage state, lease metadata, provider identifiers, state-transition guard, and append-only event ledger. A disposable-PostgreSQL integration test was added at `apps/src/mrv-submission-jobs.integration.test.ts`.

The first CI attempts caught a malformed dollar-quoted PL/pgSQL delimiter in the append-only trigger function. The migration source was corrected and re-fetched to verify the exact `$$` delimiters in commit `07cf79538700a6fccb233a9d96800090064aeb1d`. Exact-head migration and integration CI remains pending. This is not yet a working outbox: worker claim/lease logic, actor-context enforcement, provider-stage transitions, durable Hedera transaction-ID retry, Mirror Node reconciliation and RLS/grants still need implementation and tests.


### Current implementation checkpoint — 2026-11-02 15:31 UTC

The earlier implementation-progress paragraph above is historical; migration quoting has since been repaired and exact-head CI `41470418440` passed all migration, disposable PostgreSQL, browser, test and container gates. Exact-head worker authorization integration tests also passed in `41471858495` (commit `b690a5ec19ccc6b38c8d8a2ffc77f142b17af8bf`).

New branch-only application changes:
- `isMrvSubmissionJobStillAuthorized(client, jobId)` rechecks activity completion, verified organization and identity, non-suspended requester, current verified membership, `guardian:operate` role permission, verified evidence, approved same-activity verification, independent verifier, and organization geography scope. Positive and membership-revocation negative integration assertions passed in `41471858495`.
- `POST /api/v1/mrv/activities/:activityId/jobs` adds authenticated, permission-checked durable enqueue. Organization and geography are read from the activity row, not request JSON. It uses a single checked-out client and short transaction; provider calls are not performed in the route.
- `GET /api/v1/mrv/jobs/:jobId` returns permission-scoped status and append-only stage events without returning the payload snapshot or provider raw response.
- Both routes fail closed unless `RUPAYKG_MRV_DURABLE_JOBS_ENABLED=true`. The flag must remain unset until the migration, least-privilege role, RLS policies, worker and production release gates are approved.

The latest route changes are on PR #192 branch. Exact-head CI for commit `304541ad58384c6fb9190ea044f71b4c14a8810c` is running; earlier commit `ffd9ae65cd046049c884e56d1b4121b097f18e09` has its own CI run in progress. Do not claim the new route code is accepted until latest exact-head CI succeeds.

**Still not implemented:** durable worker loop and provider stage orchestration; revalidation call sites before every external stage and final provenance; atomic provenance/job finalization; runtime role and RLS policies; production migration. No production changes or provider writes have been made.


### 15:35 UTC — authenticated enqueue/status route gates passed

- Exact-head code commit `304541ad58384c6fb9190ea044f71b4c14a8810c`, workflow `41472574337`: **SUCCESS**.
- Passed migration validation and disposable PostgreSQL execution, bootstrap privilege revocation, synthetic two-custodian bootstrap, typecheck, production build, browser smoke, full tests including disposable PostgreSQL acceptance, and production-container build.
- The commit adds:
  - `POST /api/v1/mrv/activities/:activityId/jobs`: authenticated enqueue, organization/geography derived from the activity row, `guardian:operate` permission, verified organization/activity/evidence/independent verification preconditions, short transaction and 202 queue response.
  - `GET /api/v1/mrv/jobs/:jobId`: organization/geography/permission-scoped status and event history; payload snapshot and provider raw response are not returned.
  - Both endpoints are disabled unless `RUPAYKG_MRV_DURABLE_JOBS_ENABLED=true`; leave disabled in production.
- Current PR #192 head is documentation successor `8be1edd4c65e0c7300ef92a1d78c2bc0f9253171`; the last code commit is the exact tested commit above. The documentation successor does not alter runtime code.
- The endpoints are not yet connected to a running worker. Production migration is not applied; production RLS/least-privilege roles remain absent. The feature flag must remain off.

### Immediate next engineering slice

Implement the worker runner with a stage-by-stage state machine:
1. claim and lease in a short transaction;
2. revalidate current job authorization before each external stage;
3. persist Guardian idempotency key, call Guardian outside DB transaction, persist execution ID;
4. generate Hedera transaction ID, persist under current lease, submit with that same ID, then reconcile through Mirror Node;
5. revalidate authorization and current evidence/verification again;
6. persist provenance and job completion atomically, with append-only event attribution;
7. add crash/retry/fault-injection tests for every boundary.


### 2026-11-02 15:42 UTC — worker orchestration implementation checkpoint

A first lease-fenced stage runner is now present at `apps/src/mrv-submission-worker.ts`:

- Claims one due job per invocation using the existing atomic `FOR UPDATE SKIP LOCKED` lease claim.
- Performs a fresh database authorization check immediately before Guardian submission, before Hedera submission/reconciliation, and before final provenance persistence.
- Persists Guardian's deterministic idempotency key before its HTTP request. Retries retain the same key.
- Generates and persists the Hedera transaction ID before the HCS side effect. Ambiguous outcomes are reconciled against that exact ID; no new transaction ID is generated on retry.
- Reconciles exact Mirror Node transaction, topic, HCS payload and integrity hash before setting MIRROR_VERIFIED.
- Inserts provenance and advances PROVENANCE_PERSISTED -> COMPLETED inside one transaction under the active lease. A conflicting pre-existing provenance row is checked for matching evidence, Guardian execution, HCS transaction and Mirror verification.
- All provider network calls occur outside DB transactions. Each stage ends with a lease-fenced update; a stale worker cannot advance after lease expiry.
- Jobs in NEEDS_RECONCILIATION and the transient PROVENANCE_PERSISTED state are excluded from automatic claims. Manual reconciliation is not silently retried.

The runner requires `RUPAYKG_MRV_WORKER_ENABLED=true` and is not registered as an API startup task or production process. A test asserts that when disabled it makes zero database connections. The queue API remains separately gated by `RUPAYKG_MRV_DURABLE_JOBS_ENABLED=true`.

CI history: the first worker commit had an exact-optional-property TypeScript error; it was corrected by omitting absent optional properties rather than passing `undefined`. Subsequent branch workflows are running. Do not mark worker implementation accepted until the latest exact-head workflow is green and integration tests exercise all stages, lease expiry, retries, provider ambiguity, authorization revocation and finalization on disposable PostgreSQL.

**Not yet proven / not production-ready:** no separately deployed worker process or supervised scheduler; no worker DB role or forced RLS; no live provider test; no real pilot job; no independent review of provenance upsert semantics; no production migration or rollout. Production flags must remain unset. No production database or provider writes have occurred.


### Separate worker process and startup guard

- Added `apps/src/mrv-worker-server.ts` and package command `npm run start:worker:mrv -w @rupaykg/api`.
- The worker is a separate process; it is not imported by the HTTP API server and cannot start as a side effect of serving user traffic.
- Requires both `RUPAYKG_MRV_WORKER_ENABLED=true` and a dedicated `MRV_WORKER_DATABASE_URL`.
- Startup rejects any database identity other than `rupaykg_mrv_worker_runtime`, and rejects login roles with inheritance, superuser, BYPASSRLS, CREATEDB, CREATEROLE or replication privileges, or membership in app/auth owner roles.
- Startup also requires RLS **and FORCE RLS** on all eleven data tables the worker touches, plus the geography-scope authorization function. With the current production schema (0/67 RLS enabled), this worker must fail closed and cannot start.
- The worker handles SIGTERM/SIGINT, uses a small pool, processes one durable stage per loop and backs off when idle or on failure.

This creates an executable process boundary, not production deployability. The worker database role and policies do not yet exist in production; no role, grant, policy, migration, service or compute was created. Do not set the worker flags or configure the URL until the independent RLS/least-privilege migration and tests are approved.
