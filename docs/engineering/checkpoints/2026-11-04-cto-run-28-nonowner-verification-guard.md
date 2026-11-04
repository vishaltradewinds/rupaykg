# RupayKg CTO Run 28 — non-owner verification guard prototype and recovered 096 rehearsal

**Date:** 2026-11-04
**Repository:** `vishaltradewinds/rupaykg`
**Base security PRs:** [#247](https://github.com/vishaltradewinds/rupaykg/pull/247), [#252](https://github.com/vishaltradewinds/rupaykg/pull/252)
**Prototype PR:** [#263](https://github.com/vishaltradewinds/rupaykg/pull/263) — OPEN / DRAFT / UNMERGED
**Latest prototype head:** `1f5e4a6f195f0514f7fe46be696b73561caeb80d`
**Exact-head CI:** #5409 / run `41805919316` — SUCCESS

## Objective

Resolve the known least-privilege blocker in PR #247 without granting broad UPDATE rights to the API runtime, and establish disposable PostgreSQL evidence for the interaction between SECURITY DEFINER execution, FORCE RLS, row locks and the recovered historical verification-trigger composition.

## Prototype architecture

PR #263 adds an isolated-schema PostgreSQL integration test, not a production migration:

- Separate API login role: LOGIN, NOSUPERUSER, NOBYPASSRLS.
- Separate guard function-owner role: NOLOGIN, NOSUPERUSER, NOBYPASSRLS, not a tenant-table owner.
- FORCE RLS on evidence, activities, identities, memberships, roles and organization geography scopes.
- SECURITY DEFINER trigger function owned by the guard role, with fixed search_path (pg_catalog first, pg_temp last) and row_security=on.
- API role has no EXECUTE privilege on the guard function and no membership/SET ROLE path to the guard.
- Narrow column-level UPDATE(id) exists only to satisfy PostgreSQL's SELECT ... FOR SHARE privilege requirement. Exact-row UPDATE RLS policies pin both USING and WITH CHECK to transaction-local guard context. The guard can lock the selected row but cannot change its identifier; no other columns or DELETE grants are provided.
- A real password-authenticated API login proves caller GUC spoofing cannot reveal tenant rows because RLS policies target only the inaccessible guard role.
- Trigger restores the caller's pre-existing GUC values after both successful and rejected decisions.

## Security regression coverage

The disposable PostgreSQL test proves:

1. Missing guard context exposes zero evidence rows.
2. Exact guard context exposes only the selected evidence and membership rows.
3. Exact-row policies permit required FOR SHARE locks.
4. Identifier mutation is rejected by RLS despite the narrow technical column grant.
5. API login cannot SET ROLE to the guard, cannot directly read tenant source tables, and cannot execute the trigger function directly.
6. Authorized same-organization verification INSERT succeeds and captures membership, role and permission snapshot.
7. Cross-organization evidence, self-verification, out-of-scope geography and suspended identity are rejected.
8. API cannot UPDATE or DELETE verification records; immutable trigger rejects owner-side UPDATE.
9. Three concurrent revocation races are serialized: role permission removal, membership deactivation and identity suspension. Verification waits for the corresponding row lock and is denied after the revocation commits.
10. Caller-supplied custom GUC values are restored after trigger success and do not expose rows to API role.

## Recovered migration 096 composition rehearsal

A separate disposable PostgreSQL integration setup now recreates the recovered migration-096 verification function body and the real migration-010 independence trigger, including the two historical trigger names. It verifies the historical behavior before applying the new candidate migration:

- The recovered 096 trigger rejects APPROVED when the verifier lacks same-organization permission.
- The older independence trigger's global membership lookup allows a cross-organization REJECTED decision through the combined historical trigger composition.
- The forward-only candidate migration is then applied; the test asserts that exactly one authoritative verification trigger remains.

This is a disposable rehearsal of the recovered trigger composition and the observed cross-org REJECTED path. It is **not** a replay of the full historical migration 096 against production, not a production-like full-schema restore, and not authorization to restore/replay the absent migration source.

## Exact-head CI evidence

CI #5409 on exact PR #263 head `1f5e4a6f195f0514f7fe46be696b73561caeb80d` completed SUCCESS across:
- Production dependency audit
- Migration validation
- Fresh disposable PostgreSQL migration
- TypeScript typecheck
- Production build
- Browser smoke test
- Full tests including disposable PostgreSQL acceptance
- Production-container build
- Cleanup

The non-owner/FORCE RLS guard test passed as API test 57. API workspace suite: 100/100; additional workspace suites: 22/22, 2/2, 29/29, 1/1 and 2/2. No failures or skips in those reported suites.

An earlier exact head `1ce986d3e5ceab339a77fd1d64d4911b0fbabad4` also passed CI #5407. The temporary validation-only PR #264 was closed unmerged after its CI purpose was completed. PR #263 remains the authoritative prototype PR.

## Remaining limitations — do not overclaim

- Prototype is isolated-schema disposable evidence only. It does not provision roles, grants, policies or triggers in production/staging.
- No proof yet that Neon managed Postgres permits the exact role/ownership/grant provisioning contract through the intended one-shot migrator/DBA path.
- Geography-scope row mutation is not locked by the current prototype; concurrent scope revocation/addition and fail-closed behavior need dedicated design/tests. Production's no-verified-scope permissive behavior remains a separate P0 fail-closed issue.
- Evidence/activity reassignment races, global lock ordering, deadlock behavior, lock/statement timeouts and bounded retries require further tests/review.
- Table-owner DELETE/tamper powers remain a separate ownership/ACL/audit-control issue; trigger immutability is not a substitute for owner separation.
- Independent DBA/security review remains outstanding.

## Next execution batch

1. Add disposable races for evidence-to-activity reassignment and activity organization/geography reassignment, with the verifier decision waiting on row locks and re-reading committed state.
2. Design and test geography-scope fail-closed semantics and scope-row locking; do not retain the permissive no-scope fallback.
3. Review complete lock order across evidence, activity, identity, membership, role and scope rows; test deadlock/timeout/retry behavior.
4. Inspect Neon role provisioning/ownership constraints through a disposable branch or isolated database only; do not change production.
5. Continue the 67-table RLS policy matrix, dynamic tenant tests and production migration-drift reconciliation.
6. Obtain independent DBA/security review before any release or migration decision.

## Production and TRL boundary

Production Neon remains READ-ONLY / HOLD. No production/staging SQL writes, migrations, role/grant/ownership changes, RLS activation, deployments, merges, worker activation or certification occurred. PRs #247, #252 and #263 remain draft/unmerged. SITE-JBP-01 Kathonda remains PRE-VALIDATION. Production certification and TRL 9 are NOT ACHIEVED.
