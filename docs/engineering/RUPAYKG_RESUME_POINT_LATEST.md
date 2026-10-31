# RupayKg — Latest Engineering Resume Point

> Read `AGENTS.md` first. This is the active hand-off; dated checkpoints are immutable.

## Latest work — national stakeholder work/reporting contract (2026-10-31)
- BWG route-gap clarification commit: `f95cd24d926187de6c959cbf9d4c1f6b6f6e8883`.
- BWG API gap checkpoint commit: `668426a1b5be685aeb7eada2276fc7a1f2c02fde`.
- Previous resume-pointer commit before this correction: `ce2dcbad4293d6a30eb593a35776cb6f8b2cce4b`.
- Repository: `vishaltradewinds/rupaykg`; branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Matrix document commit: `4e5a4cb66df0fee409708d4187ea7fe7b111ac9a` (CI run #3947 / ID `41217457750` SUCCESS on that exact SHA).
- Immutable matrix checkpoint commit: `15f52d616c78fad8218565dddd59f0534232d26d`.
- Controlling product contract: [National Stakeholder Work-and-Reporting Matrix](../product/NATIONAL_STAKEHOLDER_WORK_AND_REPORTING_MATRIX_2026-10-31.md).
- Immutable checkpoint: [National stakeholder work/reporting matrix checkpoint](./checkpoints/2026-10-31-national-stakeholder-work-reporting-matrix.md).
- Latest route-gap checkpoint: [BWG API contract gap confirmed](./checkpoints/2026-10-31-bwg-api-contract-gap-confirmed.md).
- Matrix covers household/citizen, all generator types, BWG, waste picker/collector, contractor, transporter, aggregator, MRF, recycler/processor, treatment/disposal, PIBO, PRO, buyer/offtaker, verifier, ULB, Gram Panchayat/district, regulator, carbon/MRV, registry/trust rail, funder/insurer/CSR and platform operator.
- Generator explicitly first-class and distinct from BWG. Source code shows BWG reporting panel, statutory assessment, citizen/farmer panel and general generation field capture; a complete all-generator lifecycle is not yet proven.
- Specific unresolved route issue: BWG UI calls `GET /api/v1/workspaces/bwg`; no matching handler was found in the route modules inspected. Trace server registration and add HTTP acceptance before claiming BWG reporting is fully operational.
- Field-capture quantity is declared metadata, not calibrated weighment or receiver-accepted quantity.
- Workspace APIs inspected return bounded recent rows; period aggregation, export, pagination and reproducibility need explicit tests.
- Corrected BWG finding: issue [#176](https://github.com/vishaltradewinds/rupaykg/issues/176) now tracks the remaining authorization, statutory approval linkage, quantity/error semantics and HTTP acceptance work. This batch added a PostgreSQL-backed `reports:read` gate to the BWG workspace GET plus unit tests. Corrected matrix and immutable checkpoint: [BWG API correction and read authorization](./checkpoints/2026-10-31-bwg-api-correction-and-read-authorization.md).


## Latest correction and authorization batch — 2026-10-31
- Session preflight log: [BWG route re-audit preflight](./session-logs/2026-10-31-1608-utc-bwg-route-reaudit-preflight.md).
- BWG workspace permission fix: `825d430a4b8140b7e3072a536508632db8547359`; tests: `824acb8d0c3866651d9038d369565dc7073a62b4`; corrected stakeholder matrix: `d8f13a9abcd7618c4525958ad0972ef45341256c`; checkpoint: `c44830746bd58d73c54d3860cc86460a80e85835`.
- Exact CI run #3957 / ID `41218377380` was IN_PROGRESS on matrix SHA `d8f13a9abcd7618c4525958ad0972ef45341256c`; re-poll current branch HEAD after this resume-pointer update.
- Verified BWG read path now requires explicit `reports:read`. Unit tests cover allow, permission denial and organization-scope mismatch; full HTTP acceptance remains NOT DONE.
- Remaining statutory blocker: separate `organization_bwg_assessments` vs `bwg_profiles` state; no authorized dual-control transition to APPLICABLE/VERIFIED has been established. Do not auto-promote.
- Fresh live recheck: Neon main still 67 public tables, 0 RLS, 0 policies, five BWG tables, 92 migration rows through `20261021`; runtime roles retain BYPASSRLS/elevated attributes. Neon main branch and GitHub main branch protection are both disabled.
- Render RupayKg service is on main, live deployment commit `862512c8c904cef0f604df0350f02672318953af`; runtime DB principal remains NOT ASSESSED.
- Working branch diverged from main by 300 ahead / 1 behind; PR #175 OPEN/DRAFT and unmerged. Production HOLD; no production writes, migration, deployment or worker activation.

## Repository-wide readiness audit (2026-10-31)
- Audit report: [RupayKg repository-wide readiness and execution audit](./RUPAYKG_REPOSITORY_READINESS_AND_EXECUTION_AUDIT_2026-10-31.md).
- Immutable checkpoint: [Repository readiness and execution audit](./checkpoints/2026-10-31-repository-readiness-execution-audit.md).
- Pre-audit exact-head CI run #3942 / ID `41216157190`, SUCCESS on `afbbfeffdc60c614332acee965964de1785ceb1b`.
- Audit preflight log: [repository readiness audit preflight](./session-logs/2026-10-31-1550-utc-repository-readiness-audit-preflight.md).
- Audit verdict: ENGINEERING CANDIDATE; NATIONAL PRODUCTION EXECUTION = NO-GO / HOLD.
- Recursive inventory at audited HEAD: 396 blobs; 61 API source files; 43 web files; 50 tests; 115 SQL migrations plus README; 103 docs; 36 shared-package files; 14 route-family files; five shared packages.
- Open PR search returned 84; branch divergence snapshot was 289 ahead / 1 behind main base `862512c8c904cef0f604df0350f02672318953af`, 101 changed files. Treat as an integration-governance risk; recheck fresh before merges.
- PR #175 OPEN/DRAFT on working branch; #161 OPEN/DRAFT stacked dependency; #173 OPEN/DRAFT separate stream. No independent merges without dependency graph/review.

## Product and architecture
RupayKg is intended as pan-India national environmental infrastructure. Keep the PostgreSQL-centred modular monolith; do not split services without measured evidence. One shared event/evidence/material model must serve role-specific workflows and reports.

Physical lifecycle:
`Obligation/Plan → Generation → Segregation → Storage → Collection → Pickup → Weigh/Handover → Transport → Facility Receipt → Inspection/Sorting → Aggregation → Processing/Treatment → Recovered Output/By-product/Reject/Residual → Buyer/Offtake or Authorized Disposal → Verification → Reporting/Recognition`.

Truth lifecycle:
`LOCAL_CAPTURED → SYNC_RECEIVED → AUTHORITATIVE → VERIFIED → VALUE_ELIGIBLE → CERTIFIED/ISSUED → REGISTERED → TRANSFERRED/RETIRED → SETTLED → REPORTED`.
No state may be inferred from a prior state. Distinguish declared, measured, received, reconciled, independently verified, eligible, officially accepted and settled quantities/statuses.

Mandatory Shakti Standards apply. Golden Rule: **ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.** Software, hardware, integrated service and operational TRL must be assessed separately. TRL 9 is NOT ESTABLISHED.

## Sole authoritative live database
- Neon project: `rupaykg-production-fresh`, ID `steep-mud-79906940`.
- Sole authoritative production branch: `main`, ID `br-restless-base-b44cip2h`.
- Database: `rupaykg`.
- Latest recorded read-only catalog: 67 public base tables; 0 RLS-enabled; 0 public policies; 92 migration rows through `20261021`; 181 foreign keys; 109 trigger rows across 33 tables/67 trigger functions.
- Broad BYPASSRLS/role-creation attributes exist in inspected role catalog; no least-privilege application or worker runtime principal is established.
- No production DDL/DML, migration, role/grant/RLS change, production branch operation, deployment, worker activation or scheduler activation occurred.

## Critical readiness blockers
- Tenant isolation NOT ESTABLISHED; 0/67 production tables have RLS enabled.
- Production migration ledger remains 92 rows; candidate worker migration chain is rehearsal/candidate only.
- Worker OFF; scheduler OFF; national queue authority-scope ADR not approved.
- External regulatory/registry/Hedera/settlement acceptance, hardware qualification, field operation, backup/restore RPO/RTO, SLOs and TRL 9 are NOT ESTABLISHED.
- 84 open PRs and significant branch divergence require integration consolidation.
- No complete all-stakeholder operational journey/report contract was previously established; the new matrix is now the controlling product acceptance contract.

## Next executable sequence
1. Recheck branch HEAD and exact-head CI after each documentation or code batch. Matrix CI run #3947 / ID `41217457750` completed SUCCESS on exact matrix SHA `4e5a4cb66df0fee409708d4187ea7fe7b111ac9a`.
2. Add full BWG HTTP acceptance tests and finish read/write permission denial tests. Trace the statutory BWG assessment-to-verified-profile approval path; migration 044 blocks reporting periods unless `bwg_profiles` is APPLICABLE and VERIFIED, while current profile intake remains REVIEW_REQUIRED/PENDING.
3. Add EPR fulfilled<=obligated route validation and map known database constraint failures to stable client errors. Then build route → UI → table → report → permission → test crosswalk for all 14 route families.
4. Implement/verify general generator journey: site/stream profile → segregation/storage → pickup schedule → bilateral handover → transport → destination receipt → reconciliation → reports. Do not conflate declared quantity with calibrated measurement.
5. Complete collector/contractor/transporter/MRF/processor physical handoffs, inventory and mass balance.
6. Define report definitions, periods, aggregation, pagination/export, reproducible snapshots and permission scopes for each stakeholder.
7. Inventory all open PRs and establish one dependency-controlled integration spine; avoid overlapping PRs.
8. Complete P0 route-to-SQL authorization, all-table/FK ownership, ACL/function/sequence review, least-privilege principals, trusted context and table-specific RLS rehearsal.
9. Reconcile production migration history and candidate migrations on a disposable production-derived Neon branch. No production migration without independent review, restore readiness and explicit approval.
10. Complete worker authority approval, tenant consumer, runtime identity, monitoring, recovery and negative security tests before activation.
11. Validate official regulatory sources/external interfaces; qualify hardware and conduct representative field trials.
12. Prove operational SLOs, backup restore, RPO/RTO, incident response, privacy, support and multi-site operation before production certification or TRL advancement.
13. At every coherent batch, add an immutable checkpoint and update this pointer.

## Resume instruction
Continue from this hand-off. Do not restart from scratch, do not infer production readiness from CI, and do not modify authoritative Neon production without explicit approval and all Shakti gates.
