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
