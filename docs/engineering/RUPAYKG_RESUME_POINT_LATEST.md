# RupayKg — Latest Engineering Resume Point

> Read `AGENTS.md` first. This pointer is the active hand-off; historical checkpoints are immutable.

## Current verified snapshot — 2026-10-31
- Repository: `vishaltradewinds/rupaykg`
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`
- Latest completed immutable checkpoint: `95178ee8cf2c9048287f85200929db139f312015`.
- Latest production FK/privilege review: [PRODUCTION_FK_OWNERSHIP_AND_PRIVILEGE_REVIEW_2026-10-31.md](../security/PRODUCTION_FK_OWNERSHIP_AND_PRIVILEGE_REVIEW_2026-10-31.md).
- Latest checkpoint: [2026-10-31 FK ownership and privilege review](./checkpoints/2026-10-31-fk-ownership-privilege-review.md).
- Previous checkpoint: [API/database authorization mapping](./checkpoints/2026-10-31-api-database-authorization-map.md).
- Starting HEAD for this batch: `330eac0afa5ff977b6755debbbcf1154b7f75ca8`; exact-head CI run #3939 completed SUCCESS before this documentation batch. New documentation HEAD requires its own exact-head CI check.
- PRs #175, #161 and #173 remain unmerged in draft status at last verified state; recheck exact current status and dependency graph before any merge.

## Product and architecture
RupayKg is intended as pan-India national environmental infrastructure for waste/environmental operations, statutory/EPR compliance, digital MRV and governed environmental-value workflows. Current baseline is a PostgreSQL-centred modular monolith: React/Vite/TypeScript frontend, Fastify/Node/TypeScript API, shared domain packages, PostgreSQL operational system of record, controlled workers and external adapters. Do not split into microservices without measured evidence.

Truth lifecycle:
`LOCAL_CAPTURED → SYNC_RECEIVED → AUTHORITATIVE → VERIFIED → VALUE_ELIGIBLE → CERTIFIED/ISSUED → REGISTERED → TRANSFERRED/RETIRED → SETTLED → REPORTED`.
No state may be inferred from a prior state.

Mandatory Shakti Standards apply: reality/context, evidence, statutory boundaries, feasibility, validation, design, engineering, testing, approval, certification, deployment, operation, measurement and continuous assurance.
Golden Rule: **ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**
Assess software, hardware, integrated service and operational TRL separately. TRL 9 is NOT ESTABLISHED.

## Sole authoritative database
- Neon project: `rupaykg-production-fresh`, ID `steep-mud-79906940`.
- Sole authoritative production branch: `main`, ID `br-restless-base-b44cip2h`.
- Database: `rupaykg`.
- Verified production catalog baseline: 67 public base tables; 0 RLS-enabled; 0 public policies; 92 migration rows; max version `20261021`.
- Production FK constraints: 181.
- Production triggers: 109 trigger rows across 33 tables, 67 distinct trigger functions.
- Current privileged role catalog: `cloud_admin` is superuser/BYPASSRLS; `neon_service`, `rupaykg` and `neon_superuser` have BYPASSRLS and broad create/replication attributes; `rupaykg` is a member of `neon_superuser`. Do not use any of these as assumed least-privilege runtime roles.
- Staging/rehearsal branches are non-authoritative. Do not promote, reset or delete them merely because schema/migration counts are newer.
- No production DDL/DML, migration, role/grant/policy change, branch operation, deployment or worker activation occurred.

## Current security assessment
- Database-enforced tenant isolation is NOT ESTABLISHED: RLS disabled on all 67 public tables.
- Direct `organization_id`: 23 tables. Direct `identity_id`: 8 tables. Three overlap. 39 tables have neither direct key and require FK-derived/semantic classification.
- FK graph has 181 constraints. Key child-parent cases include BWG reports → reporting periods/evidence/verifications; carbon calculations → activities/projects/methodology/reference; chain of custody → activity/resource flow/evidence/actor organization; SWM status history → workspace/organization/actor; EPR allocations/transfers → credits/obligations/parties/evidence/verifications.
- Many records are bilateral or multi-party; do not use a single-organization predicate for credentials, transfers, settlements, chain-of-custody or EPR credit movement.
- Production has 109 trigger rows across 33 tables, invoking 67 distinct trigger functions. These enforce important lifecycle/integrity rules but are not access-control substitutes.
- Application authentication validates sessions, identities and memberships. Shared tenant transaction helper sets transaction-local GUCs from verified application context, but plain GUCs are forgeable by a direct SQL client and cannot be the only RLS authority.
- Auth, registry, sync, onboarding hierarchy, intelligence and platform-admin route families have direct/manual DB execution patterns and require distinct identity, bilateral, device, governance or platform-control boundaries.
- Function inventory is first-pass only; no displayed application SECURITY DEFINER function found, but full definitions/search_path/ACL/execute grants remain unverified.
- ACL/default privileges/sequence grants review was blocked by the inspection safety layer; this is an evidence gap, not proof of safety.
- Backup/restore independent rehearsal, RPO/RTO and actual app runtime principal remain unverified.
- Production release HOLD. Worker OFF. Scheduler OFF. Certification OFF. TRL 9 not claimed.

## Completed latest batch
- Verified starting HEAD CI run #3939 SUCCESS.
- Added `docs/security/PRODUCTION_FK_OWNERSHIP_AND_PRIVILEGE_REVIEW_2026-10-31.md`.
- Added immutable checkpoint `docs/engineering/checkpoints/2026-10-31-fk-ownership-privilege-review.md`.
- Confirmed 181 FK constraints and 109 trigger rows/33 tables/67 trigger functions.
- Recorded role privilege issue and table-specific authorization design principles.
- No production changes.

## Next executable sequence
1. Verify actual branch HEAD, exact-head CI and PR stack/dependencies.
2. Complete exhaustive route-handler → SQL callsite → table → operation → principal → tenant/device/platform-context mapping.
3. Finish ACL, schema/table/sequence/function grants, default privileges, ownership, memberships and effective privilege review with narrowly scoped read-only queries.
4. Inspect complete function/trigger definitions, SECURITY DEFINER, search_path and dynamic SQL.
5. Complete table-by-table FK ownership classification for all 67 tables.
6. Design least-privilege API, auth, migration, worker, event-writer and operations roles. Do not use current broad roles for runtime.
7. Design cryptographically authenticated tenant/device/platform capability context; GUCs may carry context but cannot be the only authority proof.
8. Establish Neon backup/PITR/restore options, retention, RPO/RTO and independent restore rehearsal; no production setting change without explicit approval.
9. Rehearse table-specific RLS and migrations on a disposable production-derived Neon branch; test forged context, cross-tenant, pooling, revoked memberships, bilateral access, platform-admin separation, sync replay and trigger/function behavior.
10. Independent security review and explicit approval before any production DDL/DML, migration, role/grant/RLS change or worker activation.
11. Continue statutory source contracts, external Guardian/Hedera verification, field hardware, pan-India operations and Shakti/TRL assurance.
12. At the end of every coherent batch, add an immutable checkpoint and update this pointer.

## Resume instruction
Do not restart with a generic repository audit. Read `AGENTS.md`, this pointer and the latest checkpoint. Verify branch/HEAD/PR/exact-head CI and Neon authority. Continue at step 1 above. Production remains read-only until security, recovery, review and approval gates pass.
