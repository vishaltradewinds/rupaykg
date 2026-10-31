# RupayKg immutable checkpoint — production catalog security refresh — 2026-10-31 15:34 UTC

## Identity
- Repository: `vishaltradewinds/rupaykg`
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`
- HEAD immediately before this checkpoint: `d0a127fb69aa4d2aaa6110ea60aa2a7b7bef13f5`
- PR #175: OPEN / DRAFT, base `main`, same branch; not merged.
- PR #161: OPEN / DRAFT, stacked on `shakti/integrate-government-inbox-worker-2026-10-31`; shares this head branch. Do not merge independently.
- PR #173: OPEN / DRAFT, separate authoritative database/repository cleanup stream; reconcile before merge.
- Exact-head CI for prior starting HEAD `4833e607c56176a7d0aff55dec7de88e77063037`: run #3931 / ID `41215002551`, COMPLETED / SUCCESS.
- CI for the documentation commits in this checkpoint batch must be checked against the final pointer HEAD; do not transfer prior success.

## Work completed in this batch
1. Read mandatory `AGENTS.md`, latest resume pointer, latest immutable checkpoint, security gap assessment and architecture audit.
2. Verified current PR state and exact-head CI before writes.
3. Reconfirmed Neon project `rupaykg-production-fresh` / `steep-mud-79906940`; authoritative production branch `main` / `br-restless-base-b44cip2h` remains primary/default/ready.
4. Reconfirmed read-only production catalog: database `rupaykg`; principal `rupaykg`; 67 public base tables; 0 RLS-enabled; 0 public policies; 92 migration ledger rows; max version `20261021`.
5. Queried production role attributes: `rupaykg` is LOGIN/non-superuser but has BYPASSRLS, CREATEDB, CREATEROLE, REPLICATION and is a member of `neon_superuser`; `neon_superuser` is NOLOGIN and has elevated privileges. This confirms the inspection principal is not suitable as an assumed least-privilege runtime identity.
6. Queried direct tenant-key and FK catalog relationships across all 67 public tables. The 23 direct `organization_id` tables, 8 direct `identity_id` tables (3 overlap), and 39 tables without either direct key are recorded in the new inventory.
7. Added `docs/security/PRODUCTION_CATALOG_SECURITY_INVENTORY_2026-10-31.md`.
8. Updated `AGENTS.md` so deployment/runtime verification is provider-neutral and must be based on repository evidence; Neon remains the sole authoritative database.
9. Added session preflight record `docs/engineering/session-logs/2026-10-31-1534-utc-security-preflight.md`.

## Production facts and release status
- Production branch protection: `protected=false` at latest branch listing.
- Project history retention: 21,600 seconds (6 hours).
- Staging/rehearsal branches remain non-authoritative; none were promoted, reset, deleted or modified.
- RLS remains disabled on all 67 production public tables. Tenant isolation NOT ESTABLISHED.
- Full route → SQL → table → operation → principal → tenant-context mapping remains incomplete.
- 39 tables without direct organization/identity keys need FK-derived and semantic classification; direct keys alone do not establish safe RLS design.
- Backup/restore independent rehearsal, RPO/RTO, application runtime principal, migration reconciliation and independent security review remain unverified/incomplete.
- Production HOLD; worker/scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.

## Changes and safety
- Preflight commit: `8422c1e673d38251b2405f2a0b8f0bc84833cfaa`.
- Catalog inventory commit: `a43c0fd220aae5c9ad04d8f2bee3eaee87cd52d0`.
- Provider-neutral AGENTS rule commit: `d0a127fb69aa4d2aaa6110ea60aa2a7b7bef13f5`.
- No production DDL/DML, migration, role/grant/credential/policy changes, branch operations, deployment, worker activation or certification action occurred.

## Next ordered execution
1. Complete route/repository/query-to-table and operation/principal mapping, including all FK child ownership paths.
2. Inventory production views, triggers, functions, sequences, ACLs/default privileges and SECURITY DEFINER execution paths.
3. Define table-specific tenant/multi-party/global/identity-private/audit classifications and deny-by-default policy model.
4. Design least-privilege API/migration/worker/event-writer/operations roles and non-forgeable tenant context.
5. Establish backup/PITR/restore capabilities, RPO/RTO and independent restore rehearsal.
6. Rehearse table-specific RLS and migration changes on a disposable production-derived Neon branch; test cross-tenant denial, pooled connections, membership revocation and forged context.
7. Independent security review and explicit authorization before production changes.
8. Recheck exact-head CI and update latest resume pointer after this checkpoint.

## Explicit NOT DONE
No production security controls have been changed; no RLS policy implemented; no production migration; no worker runtime activated; no deployment verified; no statutory acceptance, carbon-credit issuance, external registry settlement, hardware field certification or TRL 9 established.
