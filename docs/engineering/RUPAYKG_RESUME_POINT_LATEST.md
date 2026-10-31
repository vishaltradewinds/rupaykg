# RupayKg — Latest Engineering Resume Point

> Current hand-off pointer. Read `AGENTS.md` first. This pointer is updated after each coherent work batch; historical checkpoints are immutable.

## Current snapshot
- Checkpoint: 2026-10-31 15:27 UTC.
- Repository: `vishaltradewinds/rupaykg`.
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Pre-documentation verified HEAD: `f51acf7fcf5a8730e0e15d115a119f87b02a05b2`.
- This batch added a preflight log and immutable checkpoint; their commits advance HEAD. **Next session must query the branch API for the actual final HEAD** rather than assume the pre-documentation SHA.
- PR #175: OPEN / DRAFT, base `main`, not merged.
- PR #161: OPEN / DRAFT, stacked on `shakti/integrate-government-inbox-worker-2026-10-31`, shares the head branch; do not merge separately.
- PR #173: OPEN / DRAFT, separate DB/repository cleanup workstream; reconcile dependencies before any merge.
- PR #160: diagnostic candidate only; not deployed.
- CI for pre-documentation SHA: run #3928 / ID `41214689174`, COMPLETED / SUCCESS. This does NOT certify the documentation commits. Recheck exact final HEAD CI.
- Branch protection for this feature branch: disabled. Production branch protection also needs separate verification/approval.

## Read first
1. `AGENTS.md` — mandatory session procedure, safety and Shakti rules.
2. [Immutable 2026-10-31 comprehensive checkpoint](./checkpoints/2026-10-31-national-infrastructure-security-resume.md).
3. [Session preflight evidence](./session-logs/2026-10-31-1527-utc-resume-checkpoint-preflight.md).
4. [Hybrid government inbox architecture ADR](../architecture/ADR-20261031-government-inbox-worker-authority-scope.md).
5. [Production authorization/RLS gap assessment](../security/PRODUCTION_AUTHORIZATION_RLS_GAP_ASSESSMENT_2026-10-31.md).
6. [Database identity/privilege matrix](../security/DATABASE_IDENTITY_PRIVILEGE_MATRIX_2026-10-31.md).
7. [Integrated migration/worker release plan](./INTEGRATED_MIGRATION_WORKER_RELEASE_PLAN_2026-10-31.md).
8. [Repository architecture audit](./RUPAYKG_REPOSITORY_ARCHITECTURE_AUDIT_2026-10-31.md).

## Product and architecture
RupayKg's goal is pan-India national environmental infrastructure for waste/environmental operations, statutory/EPR compliance, digital MRV and governed environmental-value workflows. Current baseline is a PostgreSQL-centred modular monolith: React/Vite/TypeScript frontend, Fastify/Node/TypeScript API, PostgreSQL system of record, shared domain packages, controlled workers and external adapters. Preserve this architecture absent measured evidence for decomposition.

Truth lifecycle remains distinct: LOCAL_CAPTURED → SYNC_RECEIVED → AUTHORITATIVE → VERIFIED → VALUE_ELIGIBLE → CERTIFIED/ISSUED → REGISTERED → TRANSFERRED/RETIRED → SETTLED → REPORTED. No state may be implied by a prior state.

## Completed engineering foundations
- Government inbox: atomic bounded claims (`FOR UPDATE SKIP LOCKED`), leases/fencing, heartbeat/abort, timeout, retries/backoff/quarantine, canonical payload/timestamp validation, scoped source/crosswalk resolution, unresolved ambiguity handling and append-only payload-free transition events. Tests cover concurrency, fencing, retry/quarantine and crosswalk ambiguity.
- Hybrid national-ingestion / tenant-execution architecture is selected as the review baseline: public government source ingestion at national level; worker has narrowly named queue/snapshot/crosswalk/resolver access only; no private tenant evidence/measurement reads; minimal dispatch envelope; tenant-bound consumer revalidates membership, organization, jurisdiction, rule version and evidence.
- Repository session continuity rule in `AGENTS.md`: preflight before writes; exact HEAD/PR/CI/Neon/Render checks; immutable checkpoint plus latest pointer after every coherent batch.
- Comprehensive current checkpoint records architecture, completed work, evidence, database posture, release blockers, explicit NOT DONE items and ordered next steps.

## Authoritative database — rechecked
- Neon project `rupaykg-production-fresh`, ID `steep-mud-79906940`.
- Sole authoritative production branch `main`, ID `br-restless-base-b44cip2h`, primary/default/ready.
- Read-only SQL to database `rupaykg`: 67 public base tables; 0 RLS-enabled; 0 public policies; 92 migration ledger rows; max version `20261021`; inspection connection principal `rupaykg`.
- Project history retention 6 hours; production branch protection reports false.
- The inspected Neon principal is not proven to be Render's runtime identity.
- Staging and rehearsal branches are non-authoritative. Do not promote, reset or delete them based on newer migration counts.
- No production DDL/DML, migrations, role/grant changes, branch operations or deployment occurred.

## Release blockers / not done
- Tenant isolation is NOT ESTABLISHED: no RLS policies are enabled; no table-by-table classification and full route × SQL × table × operation × principal × tenant map yet.
- Render service/deployment/runtime principal NOT VERIFIED. Render tools could not proceed because no workspace is selected; ask user to choose the correct workspace. Do not guess.
- Independent backup/restore rehearsal, RPO/RTO and production recovery proof NOT VERIFIED.
- Migration ledger/source divergence remains unresolved; preserve production migration 096 and its four verifier authorization provenance columns. Never copy a rehearsal schema wholesale or rewrite ledgers.
- Separate least-privilege API/migration/worker/event-writer/operations DB identities not yet established.
- Worker process/scheduler, dedicated production worker principal, tenant-scoped consumer and production activation NOT DONE.
- Official CPCB/BEE source contract, signed transport, acknowledgement/regulator acceptance NOT PROVEN.
- Guardian/Hedera external consensus, registry issuance, payment settlement and nationwide operation NOT PROVEN.
- Hardware/IoT approval, calibration, field operations and integrated service TRL NOT ESTABLISHED.
- Software TRL estimate around 4–5 is provisional internal assessment only; TRL 9 NOT ESTABLISHED. Production certification remains BLOCKED.

## Exact next execution sequence
1. Verify actual branch HEAD, PR relationships and exact-head CI for the latest docs commit.
2. Ask user to select the correct Render workspace; then inspect services/deployments and verify deployed commit/database target/runtime principal without exposing secrets.
3. Establish backup/PITR/recovery options, RPO/RTO and independent restore rehearsal. Do not alter production settings without approval.
4. Complete route × SQL × table × operation × principal × tenant-context mapping and classify all production tables, including FK children, multi-party records, views, triggers, functions, sequences and grants.
5. Design least-privilege identities and signed/verified tenant context; plain caller-controlled GUC-only enforcement is not acceptable.
6. Reconcile exact migration SQL bytes, ledger and schema in a disposable production-derived rehearsal; preserve migration 096.
7. Prototype table-specific RLS and adversarial cross-tenant, forged-context, pooling, revocation and append-only tests. Obtain independent review before production.
8. Only then operationalize the hybrid inbox worker and tenant consumer with narrow privileges, monitoring, recovery and explicit approval.
9. Continue statutory source, Guardian/Hedera, hardware, pan-India operations and Shakti/TRL assurance work.
10. At end of every batch, rerun relevant tests, verify exact-head CI, add immutable checkpoint and update this pointer.

## Production safety
**Production remains HOLD.** No merge, production migration, production data mutation, role/grant change, branch promotion/deletion, Render environment change, worker activation, certification activation or deployment is authorized by this checkpoint.

## Resume instruction
Do not restart with a generic repository audit. Read `AGENTS.md` and the checkpoint above, verify the actual branch/HEAD/PR/CI, obtain the user's Render workspace selection, then execute next step 2. Preserve the authoritative Neon production branch and all existing evidence.
