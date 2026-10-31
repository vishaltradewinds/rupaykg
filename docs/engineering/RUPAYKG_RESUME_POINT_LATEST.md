# RupayKg — Latest Engineering Resume Point

> Read `AGENTS.md` first. This pointer is the active hand-off; historical checkpoints are immutable.

## Current verified snapshot — 2026-10-31
- Repository: `vishaltradewinds/rupaykg`
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`
- Latest completed engineering checkpoint commit: `22778b1eaa4270082ebd1176b83affb20cbe508a`.
- This pointer update follows that checkpoint; query the branch ref at session start for final HEAD and exact-head CI.
- PR #175: OPEN / DRAFT, base `main`, not merged.
- PR #161: OPEN / DRAFT, stacked dependency; do not merge independently.
- PR #173: OPEN / DRAFT, separate database/repository cleanup stream; reconcile before merge.
- Latest immutable checkpoint: [API/database authorization mapping](./checkpoints/2026-10-31-api-database-authorization-map.md).
- Previous immutable checkpoint: [Production catalog security refresh](./checkpoints/2026-10-31-production-catalog-security-refresh.md).

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
- Sole authoritative production branch: `main`, ID `br-restless-base-b44cip2h`, primary/default/ready.
- Database: `rupaykg`.
- Read-only live catalog: 67 public base tables; 0 RLS-enabled; 0 public policies; 92 migration rows; max version `20261021`.
- Inspection principal `rupaykg` has BYPASSRLS, CREATEDB, CREATEROLE and REPLICATION; it is a member of `neon_superuser`. Do not assume this is a least-privilege app/worker identity.
- Branch protection reported `protected=false`; project history retention is 21,600 seconds (6 hours).
- Staging/rehearsal branches are non-authoritative. Do not promote, reset or delete them merely because schema/migration counts are newer.
- No production DDL/DML, migration, role/grant/policy change, branch operation, deployment or worker activation occurred.

## Current security assessment
- Database-enforced tenant isolation is NOT ESTABLISHED: RLS disabled on all 67 public tables.
- Direct `organization_id`: 23 tables. Direct `identity_id`: 8 tables. Three overlap. 39 tables have neither direct key and require FK-derived/semantic classification.
- Full route → SQL → table → operation → principal → tenant/device/platform-context map remains incomplete.
- API authentication validates bearer session, verified identity, verified memberships and active organization selection.
- Shared tenant transaction helper sets transaction-local custom GUCs from server AuthContext. It prevents stale pooled context but is not a non-forgeable database identity boundary.
- Tenant transaction helper is not used by every route family. Auth, registry, sync, onboarding hierarchy, intelligence and platform-admin have direct/manual DB paths and need distinct identity, bilateral, device, governance or platform-control models.
- Registry/settlement are bilateral; offline sync is device/identity/organization/activity bound; onboarding/platform admin are control-plane operations. Do not apply a simplistic single-organization policy.
- Production views previously inventoried: 0. Trigger inventory contains many integrity/lifecycle guards. Exact function definitions, SECURITY DEFINER/search_path, ACL/default privileges and sequence grants need full review.
- Backup/restore independent rehearsal, RPO/RTO and actual runtime DB principal remain unverified.
- Production release HOLD. Worker OFF. Scheduler OFF. Certification OFF. TRL 9 not claimed.

## Completed latest batch
- Added `docs/security/API_ROUTE_DATABASE_AUTHORIZATION_MAP_2026-10-31.md` from 15 route-family source scans.
- Recorded route counts and shared-helper/direct-pool/manual-transaction patterns.
- Documented first-pass ownership classes and special bilateral/device/control-plane boundaries.
- Added immutable checkpoint `docs/engineering/checkpoints/2026-10-31-api-database-authorization-map.md`.
- No production changes.

## Next executable sequence
1. Verify actual branch HEAD, exact-head CI and PR stack/dependencies.
2. Continue exhaustive route-handler → SQL callsite → table → operation → principal → tenant/device/platform-context mapping, including indirect helpers and dynamic SQL.
3. Complete FK ownership classification for all 67 tables.
4. Inspect function/trigger definitions, SECURITY DEFINER/search_path, schema/table/sequence ACLs, default privileges and ownership.
5. Design separate least-privilege API, auth, migration, worker, event-writer and operations roles.
6. Design non-forgeable tenant/device/platform capabilities; GUCs may carry context but cannot be the only authority proof.
7. Establish Neon backup/PITR/restore options, retention, RPO/RTO and independent restore rehearsal; no production setting change without explicit approval.
8. Rehearse table-specific RLS and migration reconciliation on a disposable production-derived Neon branch; test forged GUC, cross-tenant, pooling, revoked memberships, bilateral access, platform-admin separation and offline-sync replay.
9. Obtain independent review and explicit approval before any production DDL/DML, migration, role/grant/RLS change or worker activation.
10. Continue official statutory-source contracts, Guardian/Hedera external verification, field hardware, pan-India operations and Shakti/TRL assurance.
11. At the end of every coherent batch, add an immutable checkpoint and update this pointer.

## Resume instruction
Do not restart with a generic repository audit. Read `AGENTS.md`, this pointer and the latest checkpoint. Verify branch/HEAD/PR/exact-head CI and Neon authority. Continue at step 1 above. Production remains read-only until security, recovery, review and approval gates pass.
