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
