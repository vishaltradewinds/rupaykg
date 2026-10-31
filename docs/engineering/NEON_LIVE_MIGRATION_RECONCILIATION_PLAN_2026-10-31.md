# Neon live migration reconciliation plan — 2026-10-31

## Status

Read-only audit and reconciliation plan only. No Neon branch creation, live SQL writes, DDL, migration replay, data changes, worker activation or deployment has been performed.

## Canonical environments

| Environment | Branch ID | Ledger rows | Latest dated migration | Key schema |
|---|---|---:|---|---|
| Production | `br-restless-base-b44cip2h` | 92 | 20261021 | No async inbox/crosswalk/source-snapshot tables; contains production-only migration 096 verifier provenance |
| Government inbox staging | `br-spring-hill-b4544vz5` | 95 | 20261025 | Async inbox/lease/rate-limit/intake tables present; no crosswalk/source-snapshot chain |
| Migration rehearsal | `br-broad-glade-b46npw8o` | 95 | 20261025 | Same async tables; additionally permits internal UNRESOLVED in inbox constraint without a corresponding 20261101 ledger row |

Staging/rehearsal ledger rows 20261022–20261025 match the four async migrations restored in PR #157. Production does not have those four migrations or their tables.

## Non-negotiable production verifier protection

Production has `096_verification_authorization_provenance.sql` and a stronger `prevent_invalid_verification()` implementation. It binds verification to evidence/activity, requires an organization-bound activity, blocks self-verification, requires an active VERIFIED organization membership and VERIFIED/non-suspended identity, checks organization-scoped role permission, and persists membership/role/permission snapshots and authorization timestamp.

Staging/rehearsal use the weaker global `has_verification_permission(verifier_identity_id)` path and do not have the same organization-scoped membership/snapshot checks.

The historical deletion of migration 096 from main was described as removal of an accidentally placed unreviewed migration. Do not restore/replay 096 blindly, and never replace the production verifier with the weaker staging/rehearsal function. The live production function is the safety baseline to preserve.

## Drift inventory

1. Production lacks `async_mirror_inbox`, worker lease and AI intake tables; staging/rehearsal have them.
2. Staging and rehearsal differ on the `async_mirror_inbox.status` check constraint and column comment. Rehearsal allows internal `UNRESOLVED`; staging does not. The rehearsal schema effect is not represented by a 20261101 migration-ledger row.
3. None of the three live branches has `government_jurisdiction_crosswalks`, `authoritative_source_snapshots`, or `organization_has_explicit_geography_scope(uuid,uuid)`.
4. The 20261026–20261110 authorization/geography/crosswalk/source-snapshot chain in PR #157 is not applied to any live branch.
5. Production-only verifier provenance is not represented by the current main migration history.

## Reconciliation plan

### Gate A — preserve evidence and freeze changes
- Keep production/staging/rehearsal read-only until a migration owner and independent reviewer approve the exact reconciliation plan.
- Export current migration ledgers and schema/function definitions as dated evidence before any change.
- Preserve production's verifier function and authorization snapshot columns as a protected baseline.
- Do not copy staging/rehearsal wholesale into production.

### Gate B — production-equivalent reconstruction
- Use a disposable clone of production as the migration baseline, not a clean empty database and not staging/rehearsal.
- Verify the clone's 92-row ledger, production-only 096 row, verifier function hash/definition, auth snapshot columns and existing data constraints.
- Apply the proposed chain in order using the repository migration runner.
- Verify the 20261022–20261025 migrations create the async tables without altering verifier authorization.
- Verify 20261026–20261110 dependencies, triggers, indexes, RLS/permissions, backfill behaviour and rollback/recovery.
- Compare the resulting schema to the PR's expected schema and run all DB acceptance tests with zero skips.

A disposable Neon clone has not been created because the prior branch-provisioning attempt failed and zero-cost/no-billing behaviour has not been verified. GitHub CI PostgreSQL 16 provides useful disposable migration/worker evidence but is not a production-equivalent clone. Do not incur a paid compute/storage resource without confirming cost and receiving approval.

### Gate C — staging/rehearsal reconciliation
- Treat staging/rehearsal's 20261022–20261025 migrations as already applied; do not replay or manually reapply them.
- Resolve the unledgered rehearsal UNRESOLVED constraint by comparing its exact constraint/comment to migration 20261101 in a disposable clone first.
- Apply a reviewed migration to staging/rehearsal only after a backup and independent approval; record the actual migration ledger row.
- Verify the later crosswalk/source-snapshot chain in disposable clones before any staging/rehearsal application.
- Keep synthetic fixtures out of live data and do not seed national LGD crosswalks without source evidence and review.

### Gate D — production release
- Production application requires a separately approved migration plan, verified backup/recovery, independent reviewer sign-off, change window, rollback criteria, post-migration verifier function hash comparison and smoke tests.
- Worker scheduler remains OFF until authorization, monitoring, rate limits, operational ownership and incident response are approved.
- No external government acceptance, authoritative MRV mutation, Guardian/HCS submission or credit decision may be inferred from internal inbox status.

## Release decision

- Production schema change: HOLD.
- Staging/rehearsal schema change: HOLD.
- Migration 096: preserve current production state; no replay.
- Migration 20261101: reconcile rehearsal out-of-band drift; do not assume it was applied.
- Migrations 20261022–20261025: present in staging/rehearsal, absent in production.
- Migrations 20261026–20261110: not applied to any live branch.
- Worker activation/deployment: OFF.
- Production certification and TRL 9: not established.


## Follow-up security migrations — 2026-10-31

The proposed repository chain now contains two additional PR-local hardening migrations after the 19 historical source restorations:
- `20261110_government_source_scope_geography_binding.sql`
- `20261111_prevent_approved_source_scope_hierarchy_expansion.sql`

The second closes a discovered scope-expansion path through new geography descendants or reparenting. Both migrations passed the ordered CI PostgreSQL 16 disposable migration run at PR #157 head `c8d251489260acf8eb3308d212764e6b1be00e1e` (run 41179522126), and the worker DB acceptance test passed with zero skips. These are CI-only results. Neither migration nor any earlier proposed chain migration has been applied to production, staging or rehearsal. The three live Neon branches remain unchanged and divergent; production verifier provenance remains preserved.


## Schema comparison confirmation — 2026-10-31

Read-only Neon schema comparisons:
- staging vs production: 355 additions, 82 removals across 9 diff hunks;
- rehearsal vs production: 362 additions, 82 removals across 9 hunks;
- rehearsal vs staging: 8 additions, 1 removal across 2 hunks.

The staging/rehearsal additions include async inbox/lease and AI intake schema; production-only verifier authorization columns/function are missing from staging/rehearsal. Rehearsal's only difference from staging is its unledgered UNRESOLVED status constraint and comment. This corroborates the branch-by-branch inventory above and reinforces the no-copy/no-replay release gate. All comparisons were read-only; no branch was modified.
