# Tenant-context integration decision and MRV route audit — 2026-11-02

Status: engineering decision record; documentation only. No production database, credentials, deployment, or pilot state changed.

## Decision

Use the explicit checked-out-client transaction boundary `withRlsRequestTransaction` as the canonical integration pattern for tenant-protected routes. Do not merge or enable the broad AsyncLocalStorage pool-interception bridge from PR #205 until an independent architecture review proves it is necessary and resolves its divergence from the foundation branch.

Reasons:
1. The foundation already provides a small explicit transaction primitive that requires a verified active organization, rejects bilateral scope, signs the validated AuthContext and sets the context transaction-locally.
2. The existing route inventory documents route-local BEGIN/COMMIT/ROLLBACK patterns. Implicitly intercepting all pool.query()/pool.connect() calls creates a second transaction model and makes it harder to prove that each protected operation uses the intended client.
3. PR #205 is 84 commits behind the current PR #192 foundation and its base SHA does not equal the current PR #192 head. PR #211 is similarly based on an earlier PR #205 head. These stacked branches require explicit rebase/reconciliation and fresh exact-head CI; mergeable=true is not sufficient.
4. Route-by-route migration allows every authorization lookup, ownership lookup, mutation and audit write to be proven on one client before RLS is enabled.

## Current PR and CI snapshot

- PR #192 current head: `ae41ed76ee7f5a64045f526edb1d95acda390945`; exact-head CI run `41491278736` succeeded.
- PR #205 current head: `ac06be31b044afe37ccf98f37835ff145433b0fe`; exact-head CI run `41491391613` succeeded, but the architecture/divergence gate remains open.
- PR #209 current head: `bb85c96b90632efe56c510bf34935c9cc408ad03`; documentation-only baseline reconciliation; no CI run returned for this head.
- PR #211 current head: `a5cbe33bc7a4feb21a4ae89b5065350585fbf258`; exact-head CI run `41491788286` succeeded. It remains dependent on PR #205 and therefore cannot be independently merged.
- All four PRs remain open and draft. No merge is authorized by this engineering record.

## MRV route audit findings

Static review of `apps/src/mrv-routes.ts` on the PR #192 foundation branch found:
- The Guardian execution queue path acquires a client, locks/reads the job and checks organization authority, permission and activity geography on that client. It still needs a signed tenant context installed on that same client before protected reads.
- The execution path acquires a client and performs its authorization/ownership checks and state transition through that client. The transaction/context boundary and all downstream writes/side effects still require explicit reconciliation.
- The verification path acquires a client and runs a transaction; its authorization and evidence/activity linkage checks must be proven to share the signed tenant context and the same client through commit/rollback.
- The provenance read path first reads activity ownership, then checks permission/geography and reads provenance through the general pool. This is a priority cross-client/unscoped-read remediation: bind ownership, permission, geography and provenance query to one signed tenant transaction.
- The provenance verification path similarly reads provenance and activity ownership through separate general-pool queries. Convert to one scoped transaction and bind every row to the active organization before returning state.

## Required route migration contract

For each MRV handler:
1. Resolve the session once through the restricted auth resolver.
2. Require a single active organization backed by VERIFIED membership; reject missing, forged, or bilateral context.
3. Start `withRlsRequestTransaction` using the validated AuthContext.
4. Perform owner lookup, geography check, permission check, evidence/verification linkage, row lock, mutation, provenance append and audit event on the callback's exact `PoolClient`.
5. Never fall back to the general pool inside the callback. Never trust organization IDs supplied by body, query, or headers as the tenant authority.
6. Add PostgreSQL integration tests for tenant A/B isolation, missing/forged context, cross-organization activity/evidence IDs, unauthorized permissions, rollback atomicity and append-only provenance.
7. Keep Guardian/Hedera external side effects outside the database transaction; use an idempotent outbox/state machine so retries cannot create duplicate external submissions or falsely mark consensus as verified.

## Release boundary

This audit is not proof of complete route/worker coverage, RLS acceptance, production readiness, pilot acceptance or TRL 9. Production remains HOLD; certification OFF. Do not apply migrations, create production roles, alter grants/RLS, enable request-context enforcement, deploy or activate workers until the complete 67-table policy matrix, route/worker mapping, restricted credentials, independent security review, backup/restore and rollback rehearsals, and approved controlled-pilot gates pass.
