# Signed tenant-context integration reconciliation — 2026-11-02

## Purpose

Track safe integration of PR #205 (`shakti/signed-request-tenant-context-bridge-2026-11-02`) onto the current authentication/bootstrap foundation in PR #192. This checkpoint is an engineering record, not approval to merge, enable RLS, or alter production.

## Exact Git evidence

- PR #192 head: `c48d3e274acadb22db9968f894278786c1a74d89`
- PR #192 branch: `shakti/auth-bootstrap-application-integration-2026-11-01`
- PR #205 head: `e1f1c952d6d1e24e8e8bd522fa3a4fbcc482901e`
- PR #205 base: `e34536c0fec929b02640cf1cfb79a3a28d47d4f3`
- Compare: PR #192 current head is 74 commits ahead of PR #205's recorded base; the base is therefore stale.
- PR #205 exact-head Actions lookup returned zero workflow runs. This is NOT a passing CI result.
- Exact-head CI observed on PR #192 current head: run `41475438403`, success.

## File overlap requiring a real rebase/merge

PR #205 changes eight files. Six also changed in PR #192:

1. `.env.example`
2. `apps/src/auth.ts`
3. `apps/src/production-config.test.ts`
4. `apps/src/production-config.ts`
5. `apps/src/production-server.ts`
6. `apps/src/server.ts`

The two PR #205-only additions are:

7. `apps/src/tenant-db-context.test.ts`
8. `apps/src/tenant-db-context.ts`

Do not overwrite the six overlapping files with the old PR #205 snapshots. Resolve each file against the current PR #192 versions, preserving the newer authentication/bootstrap changes and integrating only compatible tenant-context changes. Re-check imports, initialization order, pool ownership, and route registration after reconciliation.

## Integration sequence

1. Rebase PR #205 onto the current PR #192 head using a normal Git rebase/merge workflow; inspect and resolve all six overlaps.
2. Keep request-context mode explicitly `disabled` by default. No production activation.
3. Prove the auth resolver is called once per request and that the validated AuthContext is cached only for that request.
4. Confirm every protected route module and every direct pool consumer receives the context-aware pool. Explicitly account for excluded sync routes, internal delegation, webhook routes, scheduled jobs and worker processes.
5. Add real PostgreSQL integration tests using restricted application/auth roles. Fake-pool tests are useful unit tests but do not prove PostgreSQL transaction-local GUC behavior, RLS, role grants, or connection-pool isolation.
6. Test concurrent tenant A/B requests, connection reuse, nested transactions/savepoints, error/timeout/connection loss, rollback, revoked sessions, missing/malformed/expired signatures and bilateral settlement rejection.
7. Validate verifier schema, key table, function owner and grants on a disposable Neon clone, never production.
8. Run exact-head GitHub Actions CI after the rebase. Record run URL, commit SHA, job conclusions and test summary.
9. Obtain independent DBA/security review before any migration or runtime-mode change.

## Production database boundary

Read-only production baseline in Neon project `rupaykg-production-fresh`, primary branch `main`:

- 67 public tables.
- 0/67 tables have RLS enabled.
- 0/67 have FORCE RLS enabled.
- Production login role `rupaykg` has BYPASSRLS, CREATEROLE and CREATEDB.

The policy matrix is still a draft. The application runtime role, table owner, migration principal, authentication role and SECURITY DEFINER owner must be distinct and least-privileged. Do not apply broad RLS policies or use the privileged owner as the app runtime.

## Disposition

- PR #205: keep open; dependency reconciliation and exact-head CI required.
- PR #192: keep in its existing review posture; do not merge based solely on CI.
- Production Neon: read-only; no DDL, DML, grants, role changes, secrets or migrations.
- Production certification: OFF / HOLD.
- TRL 9: NOT ESTABLISHED.

## Acceptance evidence to attach

- Rebased commit SHA and resolved-file review.
- Exact-head CI run with all required jobs successful.
- PostgreSQL integration test report under exact proposed runtime roles.
- Complete route/worker-to-table/function coverage matrix.
- Two-tenant negative test results.
- Independent DBA/security approval and rollback rehearsal.


## Source-level integration review — follow-on

The PR #205 patch was inspected against the current PR #192 snapshots. The following are verified patch-level deltas and review requirements:

- `apps/src/auth.ts`: PR #205 adds a request-keyed `WeakMap`, an exported cache setter, and a cache read at the start of `authenticate`. The current PR #192 implementation has no such cache. Preserve PR #192's current authentication resolver and membership logic; port only the cache behavior after proving the Fastify request lifecycle cannot retain stale auth across reuse (Fastify request objects are per request) and that null results are intentionally cached.
- `apps/src/production-config.ts`: PR #205 adds a strict `disabled | enforced` parser with default `disabled`. This is a small additive delta, but the returned type and tests must be updated together.
- `apps/src/production-config.test.ts`: PR #205 adds default-disabled, explicit-enforced and invalid-mode tests. Preserve the current PR #192 production contract assertions.
- `apps/src/production-server.ts`: PR #205 forwards the mode, secret and key ID to the server process. Preserve the existing validated TLS/auth configuration and ensure no secret is logged or exposed to the browser.
- `.env.example`: PR #205 adds a documented `RUPAYKG_REQUEST_CONTEXT_MODE=disabled` default. Keep this disabled until all security gates pass.
- `apps/src/server.ts`: This is the highest-risk overlap. PR #205 wraps the domain pool, introduces a raw pool, conditionally registers Fastify hooks, adds production database-verifier/role probes, and changes pool shutdown to close the raw pool. These hunks must be reconciled against the latest PR #192 pool/auth startup and production assertions; do not copy the old whole file.
- PR #205-only files `tenant-db-context.ts` and `tenant-db-context.test.ts` are additive candidates, but they are not production assurance by themselves.

### Newly identified behavior requiring explicit negative tests

1. `registerRequestTenantContext` skips non-`/api/v1/` paths, `/api/v1/operations/sync`, and requests without a bearer header. Inventory these bypasses and prove each is either intentionally public/authenticated elsewhere or covered by a dedicated worker/device principal.
2. Bilateral settlement paths are explicitly rejected with `RLS_BILATERAL_CONTEXT_UNSUPPORTED`. This is fail-closed and should remain so until the two-party policy is independently approved.
3. Authentication is resolved before the request transaction is opened. Verify that this is safe with the separate auth runtime role and that the context-aware pool does not accidentally scope the auth resolver query.
4. The context-aware pool redirects `pool.query` and `pool.connect` only while AsyncLocalStorage has a request context. Prove propagation from the Fastify callback-style `preHandler` completion into every asynchronous route handler and downstream callback.
5. Route-local `BEGIN/COMMIT/ROLLBACK` are translated into savepoints. Add tests for nested failure recovery, unsupported transaction commands, open savepoints at response time, release-with-error, and connection loss.
6. `onSend` commits for status codes below 400 and rolls back for 400+. Test response serialization failure, streaming/aborted responses, thrown errors and hooks ordering; never allow a response to claim success if transaction finalization fails.
7. The startup verifier check inspects RLS presence and SECURITY DEFINER ownership/grants. It must be validated against actual disposable Neon runtime roles and schema, not merely mocked catalog rows.

### Integration decision

The patch is not ready to be transplanted as a mechanical six-file overlay. Proceed only with a conflict-aware merge/rebase in a normal Git environment, then run the exact-head CI and disposable-PostgreSQL test suite. No production setting change is authorized by this review.


## Existing repository foundation discovered in the current PR #192 head

A further repository-tree pass found that PR #192 already contains a first-generation signed RLS transaction boundary and an opt-in PostgreSQL integration test:

- `apps/src/rls-request-transaction.ts` exports `withRlsRequestTransaction`. It validates a single active organization backed by a VERIFIED membership, rejects bilateral context, opens one client transaction, installs the signed transaction-local `app.request_context`, invokes the operation on that client, and commits/rolls back before releasing it.
- `apps/src/rls-request-transaction-postgres.integration.test.ts` tests transaction-local context clearing on pooled connection reuse and rollback. It is skipped when `DATABASE_URL` is absent; therefore its existence is not evidence that it ran in CI or against PostgreSQL.
- `apps/src/rls-request-transaction.test.ts` supplies unit-level coverage.
- The route SQL inventory already documents 90 HTTP route declarations and 218 direct query/connect call-site indicators in the core route/server/auth cohort; it explicitly says the signed helper is not yet used by those modules.
- The worker runtime inventory found no dedicated queue consumer, cron or background worker entrypoint; API field sync/offline queue is present. Treat worker support as unproven, not implemented.

### Architecture decision required before transplant

PR #205 introduces a second, broader mechanism: `createContextAwarePool` + `AsyncLocalStorage` + Fastify hooks + implicit transaction/savepoint translation. The existing helper instead uses an explicit callback receiving one `PoolClient`. These are two different transaction integration models.

Do not combine them or enable both by default. The safer initial integration path is to adapt one representative, lower-risk route to the existing explicit `withRlsRequestTransaction` contract, preserving the route's single checked-out client for every protected query. Measure the refactor and test it end-to-end before deciding whether the implicit pool proxy is necessary. This avoids silently translating existing route-level transaction boundaries across the entire application before behavior is proven.

### Suggested staged implementation gate

1. Select one representative read-only or simple single-organization route with no bilateral, sync-device, admin, streaming or nested transaction semantics.
2. Refactor that route to obtain validated AuthContext, call `withRlsRequestTransaction`, and execute every tenant-owned SQL statement through the provided client; do not leave helper calls using the global pool inside the transaction callback.
3. Add route-level tests for missing auth, no active organization, unverified membership, tenant A/B isolation and query failure rollback.
4. Run the existing PostgreSQL integration test and new route-level integration test against a disposable Neon branch with the exact restricted runtime role and a minimal test policy/table.
5. Only after this passes should the same explicit-client pattern be extended to the next route cohort. Keep auth lifecycle, public catalog, platform-control and bilateral settlement paths separately classified.
6. Revisit PR #205's proxy only if a measured migration plan proves the explicit-client refactor is impractical; if chosen, it must replace—not duplicate—the first-generation transaction abstraction and must pass the full route/worker matrix.

No route has been modified in this checkpoint. This is an architecture finding and sequencing decision, not a code-completion claim.
