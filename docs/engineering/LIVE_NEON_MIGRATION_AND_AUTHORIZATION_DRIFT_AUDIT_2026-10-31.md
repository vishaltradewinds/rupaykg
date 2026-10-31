# Live Neon migration and authorization drift audit — 2026-10-31

## Scope and method

Read-only inspection of the three known Neon branches in project `steep-mud-79906940`, database `rupaykg`. No SQL writes, DDL, migration replay, branch creation, or data mutation was performed.

- Production: `br-restless-base-b44cip2h`
- Government inbox staging: `br-spring-hill-b4544vz5`
- Migration rehearsal: `br-broad-glade-b46npw8o`

## Findings

| Finding | Production | Staging | Rehearsal |
|---|---|---|---|
| `schema_migrations` rows | 92 | 95 | 95 |
| Maximum dated migration version | 20261021 | 20261025 | 20261025 |
| `async_mirror_inbox` | absent | present | present |
| `government_jurisdiction_crosswalks` | absent | absent | absent |
| `authoritative_source_snapshots` | absent | absent | absent |
| `organization_has_explicit_geography_scope(uuid,uuid)` | absent | absent | absent |

The 20261022–20261025 async schema exists in staging and rehearsal, but not production. The later jurisdiction crosswalk and source snapshot dependency chain is not installed in any of the three live branches.

The staging and rehearsal schemas differ on the `async_mirror_inbox.status` check constraint and column comment: rehearsal permits internal `UNRESOLVED`; staging does not. This schema difference is not represented by an additional migration-ledger row, so it is out-of-band drift.

## Critical verifier authorization divergence

Production's `prevent_invalid_verification()` function is materially stronger than staging/rehearsal. Production:
- binds verification activity to the evidence activity;
- requires an organization-bound activity for APPROVED;
- prevents actor self-verification;
- requires an active VERIFIED organization membership;
- requires a VERIFIED, non-suspended identity;
- checks verifier permission on the role in that same organization;
- persists membership, role, permission snapshot and authorization timestamp.

Staging and rehearsal use the weaker global `has_verification_permission(verifier_identity_id)` check and do not enforce the same organization-scoped membership/identity/snapshot requirements.

Production also has `096_verification_authorization_provenance.sql` recorded in its migration ledger. Its deletion from current main was explicitly described as removal of an accidentally placed unreviewed migration. The live production controls are already present; do not replay, remove, or overwrite them.

## Release decision

1. Do not merge or apply the 19-migration chain to any live branch yet.
2. Do not copy staging/rehearsal schema wholesale to production.
3. Preserve production's stronger verifier function and authorization snapshot columns.
4. Reconstruct the proposed chain from a clean, disposable copy of the current production baseline and validate migration ordering, data compatibility, function/trigger replacement and rollback/recovery.
5. Resolve the unledgered staging/rehearsal `UNRESOLVED` drift through a separately reviewed reconciliation plan; do not infer that the migration was applied from its schema effect.
6. Obtain independent authorized review before any migration application or worker activation.

## Status

Read-only audit completed. Production remains unchanged. Staging and rehearsal remain unchanged. No live worker is installed or active. Production HOLD; scheduler OFF; certification OFF; TRL 9 not established.


## Follow-up schema comparison evidence — 2026-10-31

Neon schema comparison was run read-only across the three live branches:

| Comparison | Added lines | Removed lines | Diff hunks | Interpretation |
|---|---:|---:|---:|---|
| Staging vs production | 355 | 82 | 9 | Staging has the async inbox/AI intake schema absent from production, while lacking production's verifier authorization snapshot columns and stronger verifier function. |
| Rehearsal vs production | 362 | 82 | 9 | Same core divergence, plus rehearsal-only internal UNRESOLVED status/comment. |
| Rehearsal vs staging | 8 | 1 | 2 | Difference is limited to the UNRESOLVED status constraint and its explanatory comment. |

The diff independently confirms that staging/rehearsal do not preserve the production verifier authorization provenance. The proposed 20261026–20261111 migration chain does not redefine `prevent_invalid_verification()` or drop the production authorization snapshot columns; nevertheless, production-equivalent reconstruction must prove this on a disposable clone before application.

These comparisons are schema-only snapshots; they do not prove data equivalence, migration-history equivalence, runtime parity or operational readiness. No branch was modified.


## Exact rehearsal-only UNRESOLVED drift reconciliation evidence — 2026-10-31

A second read-only catalog query captured the exact `async_mirror_inbox_status_check` definition and `status` column comment in staging and rehearsal:

- Staging allows `RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED` only; the status column has no explanatory comment.
- Rehearsal allows the same values plus `UNRESOLVED` and has the exact explanatory comment found in repository migration `20261101_async_mirror_unresolved_crosswalk.sql`.
- The repository migration drops/recreates only the status check constraint and adds the status column comment. Its SQL matches the observed rehearsal constraint and comment.
- The `20261101` ledger row is absent from the previously captured staging and rehearsal ledgers (both remain 95 rows through `20261025`).

This is strong evidence that the rehearsal schema contains the exact schema effect of migration 20261101 without a corresponding ledger record. It does **not** prove how or by whom that SQL was applied. Treat the branch as out-of-band drift until provenance is established. Do not replay the migration, edit the ledger, or automatically roll back the constraint. Preserve the current rehearsal state and require a reviewed reconciliation record before any branch change.


## Authoritative database and role reconciliation — 2026-10-31 11:51 UTC

A fresh read-only inspection reconfirmed the current branch list and directly queried the live database catalogs:
- Production default branch is `main` (`br-restless-base-b44cip2h`), ledger 92 rows through `20261021`.
- Staging (`br-spring-hill-b4544vz5`) and rehearsal (`br-broad-glade-b46npw8o`) each have 95 ledger rows through `20261025`.
- Production has none of `async_mirror_inbox`, `async_mirror_inbox_events`, `government_jurisdiction_crosswalks`, or `authoritative_source_snapshots`.
- Staging and rehearsal have the first two but not the latter two. Staging excludes `UNRESOLVED`; rehearsal includes it without a corresponding ledger row.
- The previous production-derived rehearsal branch `br-frosty-term-b47k7ayc` is absent from the current branch list.

The production inspection connection reports `session_user=current_user='rupaykg'`; this is the Neon inspection identity, not Render runtime evidence. On production, this role is not superuser but has `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, membership in `neon_superuser`, ownership of 67 public tables, and DELETE/INSERT/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE grants across 67 public tables. Staging's `rupaykg` role also has BYPASSRLS/CREATEROLE/CREATEDB and the same broad table privileges across 71 public tables.

**Decision:** neither existing application/owner identity is suitable for a worker. Do not use `rupaykg` or `neon_superuser` for the worker. A new independent login must be proven on disposable PostgreSQL with positive/negative privilege tests. The live schema divergence is unchanged; no migration, role, grant, queue or deployment mutation was performed.
