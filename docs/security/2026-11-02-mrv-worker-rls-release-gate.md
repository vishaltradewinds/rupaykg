# MRV worker RLS and release gate — 2026-11-02

## Decision

The durable MRV worker remains disabled and must not be deployed or connected to production. The API durable-job routes remain feature-gated. Migration `20261109_durable_mrv_submission_jobs.sql` is an un-applied engineering proposal, not an approved production migration.

## Verified code posture

- `apps/src/mrv-submission-worker.ts` claims jobs and performs short database transactions around lease/state updates; Guardian, Hedera and Mirror Node calls occur outside those transactions.
- The worker re-checks organization, identity, membership, role permission, evidence, verification and geography before irreversible provider stages.
- `apps/src/mrv-worker-server.ts` checks its expected database login, role attributes, owner-role membership, required table privileges, geography-helper EXECUTE and FORCE RLS on its declared table set before entering the polling loop.
- The worker currently performs its authorization and job-stage SQL directly through its worker connection. It does not yet establish the same signed tenant-context transaction used by tenant-facing API routes.
- The durable-job migration intentionally creates no worker grants, RLS policies, worker SECURITY DEFINER functions or production role changes.

## Blocking security gap

A worker runtime that is required to obey tenant RLS cannot safely query/claim jobs or read related activity/evidence/verification rows until the exact worker access model is designed and tested. Simply granting table access, bypassing RLS, or allowing the worker to assume an owner role is not acceptable.

The worker needs a narrow, auditable system-actor execution contract. Preferred design for review:
1. A dedicated non-login owner for tightly scoped SECURITY DEFINER claim/lease functions, separate from the worker login.
2. The worker login gets EXECUTE only on the approved claim/advance/lease functions, plus only those SELECT/INSERT/UPDATE rights independently justified by the matrix.
3. Each claim returns a minimal immutable job envelope. Before provider execution, a security-definer authorization function rechecks the current identity, VERIFIED membership, organization status, role permission, evidence/verification linkage and geography. It must not accept caller-supplied organization scope as authority.
4. Every stage mutation is fenced by job ID, lease token and live expiry inside a single DB transaction; immutable request payload and append-only events remain database-enforced.
5. Provenance finalization uses a narrow function that independently verifies current authorization and all persisted Guardian/HCS/Mirror bindings, then writes provenance and completes the job atomically.
6. Worker role has no BYPASSRLS, no owner membership, no schema CREATE, no access to signing keys, no broad table UPDATE, no ability to alter policies/functions, and no access to unrelated tenant data.
7. A disposable PostgreSQL acceptance test creates two organizations and two workers. It proves worker A cannot read, claim, advance, or finalize worker B's job, including guessed UUIDs and stale/forged lease tokens. It also proves revocation between stages prevents further external provider calls.
8. External calls use stable provider idempotency keys and pre-persisted Hedera transaction IDs. Ambiguous outcomes reconcile the same transaction; they never create a second anchor. Provider calls are never made while holding a DB transaction.

## Additional implementation defects to resolve before enabling

- Fixed 120-second renewal before provider calls was insufficient for slow providers. Follow-up commit `248e9979fbd0eb62b2338f05bec928e9228dc61b` adds a 30-second lease heartbeat around Guardian, Hedera submission and Mirror Node reconciliation. If renewal fails, the provider result is not persisted under the lost lease; stable provider bindings allow the next owner to reconcile. This does not cancel an already-running external call, so bounded provider timeouts and adapter-level cancellation remain required.
- Guardian retries must reuse the persisted Guardian idempotency key. Hedera retries must reuse the persisted transaction ID; the worker must reconcile ambiguous submissions before any re-submit.
- Job claim status and retry transitions must match the database transition trigger. A code path that attempts a transition not allowed by the SQL state machine must fail closed and be tested.
- The API route's session advisory lock and the durable worker's lease/idempotency model are separate execution paths. Only one path should be authoritative after the worker is approved; avoid parallel direct-provider and durable-queue submissions.
- The API preflight source snapshot must be cryptographically bound to the actual provider payload and durable job payload. Canonical serialization and exact snapshot parity tests are required; plain object JSON serialization is not a sufficient cross-language canonicalization contract.

## Required acceptance suite

- Worker A/B tenant isolation across claim, authorization, lease renew/release, stage update, event insert and provenance finalization.
- Missing/forged/expired lease token and stale lease fencing.
- Membership, role permission, organization, geography, evidence and verification revocation between each provider stage.
- Retry after timeout, process crash after provider acceptance, Hedera duplicate transaction, Mirror Node indexing lag and exact transaction reconciliation.
- Atomic provenance + job completion; rollback leaves neither partial finalization nor false completion.
- Runtime-role catalog assertions for attributes, memberships, schema privileges, table privileges, function EXECUTE grants, RLS and FORCE RLS.
- No real provider calls in CI; provider adapters must be deterministic fakes in integration tests.

## Release decision

**HOLD.** No worker activation, production grants, RLS migration, deployment, provider credentials or production DB writes are authorized by this engineering checkpoint. Queue remains disabled until the above controls and acceptance evidence pass independent review.
