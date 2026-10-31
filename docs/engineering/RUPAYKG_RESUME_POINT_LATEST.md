# RupayKg — Latest Engineering Resume Point

> Read `AGENTS.md` first. This pointer is the active hand-off; historical checkpoints are immutable.

## Current verified snapshot — 2026-10-31 15:34 UTC
- Repository: `vishaltradewinds/rupaykg`
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`
- Last verified pre-pointer HEAD: `e5d2f864543d250485b14dc9c93a3742e5c1e7d4`. Query the branch ref at session start for the pointer commit's final HEAD; do not assume it.
- PR #175: OPEN / DRAFT, base `main`, not merged.
- PR #161: OPEN / DRAFT, stacked on `shakti/integrate-government-inbox-worker-2026-10-31`; shares this head branch. Do not merge separately.
- PR #173: OPEN / DRAFT, separate database/repository cleanup stream; reconcile before merge.
- Exact-head CI before this documentation batch: run #3931 / ID `41215002551`, SUCCESS for `4833e607c56176a7d0aff55dec7de88e77063037`. The final documentation HEAD requires its own exact-head CI check.
- Latest immutable checkpoint: [2026-10-31 production catalog security refresh](./checkpoints/2026-10-31-production-catalog-security-refresh.md).
- Latest preflight: [2026-10-31 15:34 UTC security preflight](./session-logs/2026-10-31-1534-utc-security-preflight.md).

## Product and architecture
RupayKg's goal is pan-India national environmental infrastructure for waste/environmental operations, statutory/EPR compliance, digital MRV and governed environmental-value workflows. Current baseline is a PostgreSQL-centred modular monolith: React/Vite/TypeScript frontend, Fastify/Node/TypeScript API, shared domain packages, PostgreSQL operational system of record, controlled workers and external adapters. Do not split into microservices without measured evidence.

Truth lifecycle remains distinct:
`LOCAL_CAPTURED → SYNC_RECEIVED → AUTHORITATIVE → VERIFIED → VALUE_ELIGIBLE → CERTIFIED/ISSUED → REGISTERED → TRANSFERRED/RETIRED → SETTLED → REPORTED`.
No state may be inferred from a prior state.

Mandatory Shakti Standards apply: reality/context, evidence, statutory boundaries, feasibility, validation, design, engineering, testing, approval, certification, deployment, operation, measurement and continuous assurance.
Golden Rule: **ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**
Assess software, hardware, integrated service and operational TRL separately. TRL 9 is NOT ESTABLISHED.

## Authoritative database — rechecked
- Neon project: `rupaykg-production-fresh`, ID `steep-mud-79906940`.
- Sole authoritative production branch: `main`, ID `br-restless-base-b44cip2h`, primary/default/ready.
- Database: `rupaykg`.
- Read-only live catalog: 67 public base tables; 0 RLS-enabled; 0 public policies; 92 migration rows; max version `20261021`.
- Principal: `session_user=current_user=rupaykg`. Role has LOGIN, BYPASSRLS, CREATEDB, CREATEROLE and REPLICATION; member of `neon_superuser`. Do not assume this is a least-privilege application/worker identity.
- Branch protection reports `protected=false`; project history retention is 21,600 seconds (6 hours).
- Other branches are staging/rehearsal only. Do not promote, reset or delete them merely because their schema/migration count is newer.
- No production DDL/DML, migration, role/grant/policy change, branch operation, deployment or worker activation occurred.

## Current security assessment
- Database-enforced tenant isolation is NOT ESTABLISHED: RLS is disabled on all 67 public tables.
- Direct `organization_id`: 23 tables. Direct `identity_id`: 8 tables. Three overlap. 39 tables have neither direct key and require FK-derived and semantic classification.
- Full route → SQL → table → operation → principal → tenant-context map is incomplete.
- Table-by-table classification must include child-FK ownership, multi-party records, global reference/control plane, identity-private data, append-only evidence/audit and maintenance-only tables.
- Views, triggers, functions, sequences, grants/default privileges and SECURITY DEFINER paths require inventory.
- Caller-controlled GUC alone is not a sufficient security boundary.
- Backup/restore independent rehearsal, RPO/RTO and actual application runtime principal remain unverified.
- Production release posture: HOLD. Worker OFF. Scheduler OFF. Certification OFF. TRL 9 not claimed.

## Completed in latest batch
- Exact-head CI verified for starting HEAD: run #3931 SUCCESS.
- Rechecked PR state and Neon production branch.
- Captured read-only production table/RLS/migration counts and elevated role attributes.
- Added `docs/security/PRODUCTION_CATALOG_SECURITY_INVENTORY_2026-10-31.md`.
- Updated `AGENTS.md` to make deployment/runtime verification provider-neutral and evidence-led.
- Added immutable checkpoint and session preflight record.
- No production changes or deployment actions.

## Next executable sequence
1. Verify current branch HEAD and exact-head CI; reconcile PR #175/#161/#173 dependency relationships.
2. Complete route/repository/query → table → operation → principal → tenant-context mapping.
3. Classify all 67 production tables, including FK ownership and multi-party/global/identity/audit semantics.
4. Inventory views, triggers, functions, sequences, ACLs/default privileges and SECURITY DEFINER paths.
5. Design least-privilege API, migration, worker, event-writer and operations roles plus non-forgeable tenant context.
6. Establish Neon backup/PITR/restore options, retention, RPO/RTO and independent restore rehearsal; no production setting change without explicit approval.
7. Rehearse table-specific RLS and migration reconciliation on a disposable production-derived Neon branch; test cross-tenant denial, pooling, revoked memberships and forged context.
8. Obtain independent review and explicit approval before any production DDL/DML, role/grant/RLS change, migration or worker activation.
9. Continue official statutory-source contracts, Guardian/Hedera external verification, field hardware, pan-India operating evidence and Shakti/TRL assurance.
10. At the end of each coherent batch, add an immutable checkpoint and update this pointer with exact evidence.

## Resume instruction
Do not restart with a generic repository audit. Read `AGENTS.md`, this pointer and the latest checkpoint. Verify actual branch/HEAD/PR/CI and Neon authority. Continue at step 1 above. Production remains read-only until the security, recovery, review and approval gates pass.
