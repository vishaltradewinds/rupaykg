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
- The API route's session advisory lock and the durable worker's lease/idempotency model are separate execution paths. Commit `beef362ebe6538e53d28f97a55b619c6c79ec741` now fail-closes the legacy synchronous submit route unless `RUPAYKG_MRV_DIRECT_SUBMIT_ENABLED=true`, and refuses it whenever the durable worker is enabled. The durable queue remains the intended canonical path; direct mode is only a controlled fallback.
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


## Restricted worker database contract — implementation specification

The worker currently issues direct SQL for claim, authorization, lease renewal, stage persistence and finalization. This is a release blocker: do not solve it by granting the worker broad SELECT/UPDATE/INSERT privileges on tenant tables.

### Runtime identity
- `rupaykg_mrv_worker_runtime`: LOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION; no membership in app/auth/owner/security roles; no schema CREATE.
- Worker runtime receives only EXECUTE on the reviewed worker API functions and CONNECT on the database. It receives no direct table, sequence, view, or signing-key privileges.
- `rupaykg_mrv_worker_owner`: NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION. Owns only the narrowly scoped SECURITY DEFINER worker functions, not application tables. Fixed `search_path = pg_catalog, public`; all object references schema-qualified; no dynamic SQL; revoke EXECUTE from PUBLIC.
- The function owner receives only the table/sequence privileges needed by reviewed function bodies. FORCE RLS remains enabled on every tenant table. A dedicated worker policy for the non-login function owner must be explicitly reviewed per table; it must not become a general-purpose runtime policy. Do not use BYPASSRLS as a shortcut.
- The worker owner must not own signing keys, request-context key tables, authentication/session tables or general application schemas.

### Required narrow function API
1. `mrv_worker_claim_next(worker_id, lease_seconds)`: atomically claims one due job with SKIP LOCKED; returns only the immutable job snapshot and lease token needed for the next stage. It must never claim `NEEDS_RECONCILIATION`, `PERMANENT_FAILURE`, `REJECTED`, or `CANCELLED`.
2. `mrv_worker_authorize_job(job_id)`: rechecks verified requester identity, active organization, verified membership, current guardian:operate permission, completed activity, independent approved verification, verified evidence, and current geography scope. Return a boolean and no unrelated row data.
3. `mrv_worker_persist_guardian_key(job_id, lease_token, key)`: lease-fenced, immutable idempotency-key write.
4. `mrv_worker_persist_hcs_binding(job_id, lease_token, network, topic_id, transaction_id)`: lease-fenced, immutable HCS transaction binding.
5. `mrv_worker_renew_lease(job_id, lease_token, lease_seconds)`: renew only an unexpired matching token; return the new expiry or null.
6. `mrv_worker_advance_stage(job_id, lease_token, next_status, typed_patch)`: allow-listed state transitions and fields only; append audit event atomically; clear lease atomically.
7. `mrv_worker_release_lease(job_id, lease_token, retry_at, error_code, detail)`: release only a live matching token and append event.
8. `mrv_worker_finalize_provenance(job_id, lease_token, digest)`: in one transaction, recheck authorization and all immutable provider bindings, insert-or-verify append-only provenance, transition to completed, append audit event, and clear lease. It must not accept organization/activity/evidence IDs from the caller; derive all identifiers from the locked job row.

Every function must reject missing/expired lease tokens, reject cross-job IDs, use row locks for state transitions, and return the minimum required fields. The worker TypeScript repository must call these functions only; no direct SQL against tenant or MRV ledger tables. The enqueue API remains a separate signed tenant-context transaction and must not receive worker function privileges.

### RLS / ownership test matrix before worker enablement
- Runtime role cannot SELECT/INSERT/UPDATE/DELETE any application or MRV table, cannot read request-context signing keys, cannot create objects, and cannot SET ROLE to any owner.
- Runtime role can invoke only the named worker functions; PUBLIC and unrelated roles cannot invoke them.
- Function owner is non-login and NOBYPASSRLS; no owner membership or table ownership.
- Under two tenants, a claimed job returns only its own immutable snapshot; authorization fails when requester membership is revoked, role permission removed, evidence unverified, verification revoked, activity changed, or geography scope removed.
- Wrong job ID, tenant identifiers supplied by a caller, stale lease token, expired lease, replayed stage, duplicate provider result, and attempted provenance mutation all fail closed.
- Crash injection after every durable boundary proves restart/reconciliation without a new Guardian idempotency key or Hedera transaction ID.
- Verify function definition hashes, grants, policies, owners, FORCE RLS, and runtime `current_user` from the actual connection in CI and in the pre-deployment rehearsal.

### Current implementation gap
The worker currently uses direct SQL in `apps/src/mrv-submission-jobs.ts` and finalization in `apps/src/mrv-submission-worker.ts`; `apps/src/mrv-worker-server.ts` currently expects broad table privileges. These must be replaced with the narrow function API before any worker credential is issued or worker is enabled. No production migration or grants are authorized by this specification.


### Immutable source snapshot revalidation
A second static audit found that the durable worker rechecked membership, permission, geography and record status but did not compare live observations/evidence/quantity with the immutable enqueue snapshot. Commit `30661ab6dc350f19dcbd44d4034486a428c151fc` now re-reads the source rows and rejects provider-stage authorization when the current source differs from the stored snapshot. The disposable integration test (`f0ffd8523f69602752d5a5e74d818bdd12d939e5`) changes the measurement after enqueue and asserts that authorization fails until the original value is restored. This remains direct SQL today and must move behind the restricted worker function API before release.

The integration assertion was expanded in `3d4879fbaa02c66dcf02f446f39e8900f3c902bf` to mutate and restore an evidence content hash as well as a measurement quantity. Both changes must invalidate worker authorization until the exact enqueue-time source state is restored.


### Integration fixture correction — 2026-11-02
The first source-parity CI run correctly rejected the existing ledger integration fixture because it manually inserted a minimal `{"schema":"rupaykg:mrv:v1"}` snapshot rather than the complete observations/evidence/quantity payload produced by the real enqueue route. The fixture now seeds the same source fields from its disposable PostgreSQL rows (`59c5dc1d0976dbd7b92e2d9194c3d3f07f40e431`). This preserves strict source parity; it does not relax authorization. Exact-head CI is queued as run `41496873635`.

### Provider request bounds
Guardian submission already uses an AbortController with a validated configurable timeout. Mirror Node transaction lookup also has a 10-second abort bound; its second-stage topic-message verification fetch now has an explicit 10-second `AbortSignal.timeout` (`4bfc85b`), with a regression assertion (`3c0cd88`). Hedera SDK submission remains a separate timeout-review item; do not infer SDK cancellation solely from the worker lease heartbeat.

The latest ordering refinement also uses `(measured_at DESC, id DESC)` for the single current measurement in the route, worker revalidation, and disposable fixture (`97714a9`, `7aa0022`). This closes the remaining tie-order ambiguity for equal measurement timestamps.
