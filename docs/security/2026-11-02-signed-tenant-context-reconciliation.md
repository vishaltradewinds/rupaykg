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
