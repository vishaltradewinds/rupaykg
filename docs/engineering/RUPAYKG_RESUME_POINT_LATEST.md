# RupayKg — Latest Engineering Resume Point

> Read `AGENTS.md` first. This is the active hand-off; dated checkpoints are immutable.

## Current session — 2026-10-31 repository readiness audit
- Repository: `vishaltradewinds/rupaykg`
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`
- Verified branch HEAD immediately before this pointer update: `1e3d59e1d05d324fb4c78603c3c66ee62987fdd2`.
- Audit preflight log: [2026-10-31 repository readiness audit preflight](./session-logs/2026-10-31-1550-utc-repository-readiness-audit-preflight.md).
- Audit report: [RupayKg repository-wide readiness and execution audit](./RUPAYKG_REPOSITORY_READINESS_AND_EXECUTION_AUDIT_2026-10-31.md).
- Latest immutable checkpoint: [2026-10-31 repository readiness and execution audit](./checkpoints/2026-10-31-repository-readiness-execution-audit.md).
- Audit report commit: `bf286b5aebade12aafd7cd56011eb1310bea30f0`.
- Checkpoint commit: `1e3d59e1d05d324fb4c78603c3c66ee62987fdd2`.
- Pre-audit exact-head CI: run #3942 / ID `41216157190`, SUCCESS on `afbbfeffdc60c614332acee965964de1785ceb1b`.
- The final pointer update is documentation-only. Its returned commit SHA and exact-head CI must be rechecked immediately after this write; do not infer CI success from run #3942.
- PR #175 OPEN/DRAFT on this branch; PR #161 OPEN/DRAFT on the same head but stacked; PR #173 OPEN/DRAFT on a separate branch. Do not merge any independently without a reviewed dependency graph.
- Open PR search returned 84. Branch comparison against main base `862512c8c904cef0f604df0350f02672318953af`: 289 ahead, 1 behind, 101 changed files. Integration governance risk HIGH.

## Product and architecture
RupayKg is intended as pan-India national environmental infrastructure. Keep the PostgreSQL-centred modular monolith; do not split services without measured evidence. Product capabilities span generation, segregation, collection, transport, aggregation, processing, compliance, evidence/MRV, value workflows and reporting.

Truth lifecycle:
`LOCAL_CAPTURED → SYNC_RECEIVED → AUTHORITATIVE → VERIFIED → VALUE_ELIGIBLE → CERTIFIED/ISSUED → REGISTERED → TRANSFERRED/RETIRED → SETTLED → REPORTED`.
No state may be inferred from a prior state.

Mandatory Shakti Standards apply. Golden Rule: **ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.** Software, hardware, integrated service and operational TRL must be assessed separately. TRL 9 is NOT ESTABLISHED.

## Sole authoritative live database
- Neon project: `rupaykg-production-fresh`, ID `steep-mud-79906940`.
- Sole authoritative production branch: `main`, ID `br-restless-base-b44cip2h`.
- Database: `rupaykg`.
- Latest recorded read-only catalog: 67 public base tables; 0 RLS-enabled; 0 public policies; 92 migration rows through `20261021`; 181 foreign keys; 109 trigger rows across 33 tables/67 trigger functions.
- Broad BYPASSRLS/role-creation attributes exist in the inspected role catalog; no least-privilege application or worker runtime principal is established.
- No production DDL/DML, migration, role/grant/RLS change, production branch operation, deployment, worker activation or scheduler activation occurred.

## Audit verdict
**ENGINEERING CANDIDATE; NATIONAL PRODUCTION EXECUTION = NO-GO / HOLD.**
- Core foundations exist: identity/organization, geography, field/offline sync, resource flows/custody, evidence/MRV, BWG/SWM, EPR, CCTS methodology, ESG, intelligence, registry/settlement controls and proposed government-source intake.
- Complete end-to-end stakeholder work/reporting contract is not yet established. Generator exists in product concept and BWG/SWM foundations, but full generator-to-destination/reporting journey is not proven.
- Tenant isolation NOT ESTABLISHED; 0/67 production tables have RLS enabled.
- Production migration ledger remains 92 rows; worker migration chain is rehearsal/candidate only.
- Worker OFF; scheduler OFF; national queue authority-scope ADR not approved.
- External regulatory/registry/Hedera/settlement acceptance, hardware qualification, field operation, backup/restore RPO/RTO, SLOs and TRL 9 are NOT ESTABLISHED.
- Read full audit report for complete findings and ordered execution gates.

## Next executable sequence
1. Recheck current branch ref, exact-head CI, PR metadata and dependencies. Do not merge from green CI alone.
2. Create the National Stakeholder Work-and-Reporting Matrix for Generator, collector, transporter, aggregator/MRF, processor, ULB/Panchayat, producer/importer/brand owner, buyer/offtaker, verifier, regulator, carbon/MRV participant, funder/insurer and platform operator.
3. Trace every workflow against actual UI, route, database tables, evidence, permissions, reports, exception handling and automated/field acceptance tests.
4. Inventory all open PRs and establish one dependency-controlled integration spine; resolve duplicate, stale and conflicting candidates.
5. Complete P0 route-to-SQL authorization mapping, all-table/FK ownership, ACL/function/sequence review, least-privilege principals, cryptographically trusted context and table-specific RLS rehearsal.
6. Reconcile production migration history and candidate migrations on a disposable production-derived Neon branch. No production migration without independent review, restore readiness and explicit approval.
7. Complete worker authority approval, tenant consumer, runtime identity, monitoring, recovery and negative security tests before activation.
8. Validate official regulatory sources and external interfaces; qualify hardware and conduct representative field trials.
9. Prove operational SLOs, backup restore, RPO/RTO, incident response, privacy, support and multi-site operation before production certification or TRL advancement.
10. At every coherent batch, add an immutable checkpoint and update this pointer.

## Resume instruction
Continue from this audit. Do not restart from scratch, do not infer production readiness from CI, and do not modify authoritative Neon production without explicit approval and all Shakti gates.
