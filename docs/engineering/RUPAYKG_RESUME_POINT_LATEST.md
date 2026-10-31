# RupayKg — Latest Engineering Resume Point

> Mandatory start: read root `AGENTS.md`, this hand-off, the latest immutable checkpoint and linked decision records. Resume from the exact branch below; do not restart from memory.

## Current repository state — 2026-10-31
- Repository: `vishaltradewinds/rupaykg`.
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Latest recorded branch HEAD before this pointer refresh: `a2fc40643ff61721fd5c14114a5361fd2a61914c` (BWG HTTP authentication boundary checkpoint commit). Verify live branch HEAD before continuing.
- Main base: `862512c8c904cef0f604df0350f02672318953af`.
- PR #175: OPEN/DRAFT, unmerged; do not merge or rebase without dependency, independent review, migration and security gates. PR URL: https://github.com/vishaltradewinds/rupaykg/pull/175.
- Branch divergence last freshly measured: 307 ahead / 1 behind main (16:19 UTC preflight); remeasure before integration decisions.
- Latest checkpoint: [BWG HTTP authentication boundary tests](./checkpoints/2026-10-31-bwg-http-auth-boundary-tests.md). Previous governance checkpoint: [Autonomous execution and Founder time protection](./checkpoints/2026-10-31-autonomous-execution-founder-time-protection.md).
- Latest preflight: [Autonomous execution protocol preflight](./session-logs/2026-10-31-1624-utc-autonomous-execution-protocol.md).

## Latest completed work
### Autonomous execution / Shakti governance
- Preflight log commit: `6081d9ced9d6a3cd30f5c15f64cea5f5440e7a4b`.
- Root `AGENTS.md` policy commit: `ec3a2b2a3fe46a1e3fcae7be994f7f775e2699ef`.
- Immutable checkpoint commit: `b2fe65d5fa5634aa7fcaa70557dfb16a48841c8c`.
- Added mandatory section 9, **Autonomous execution and Founder time protection**: proactive discovery and prioritisation; implementation rather than plan-only work; dependency-aware parallelisation; continue safe work around blockers; selective escalation; continuity checkpoints; exception-based reporting; Founder time protection; truthful and bounded authority. Existing completion standard is now section 10.
- No production, schema, deployment, worker, scheduler or certification changes in the governance batch. The follow-on BWG test batch adds HTTP authentication boundary coverage only.

### BWG/EPR engineering
- BWG workspace read authorization implementation: `825d430a4b8140b7e3072a536508632db8547359`.
- BWG permission tests: `824acb8d0c3866651d9038d369565dc7073a62b4`.
- Corrected stakeholder matrix: `d8f13a9abcd7618c4525958ad0972ef45341256c`.
- EPR quantity validation / narrow database constraint mapping work was present at preflight HEAD `4ae53077a37d023818879f9470fce71bb795dcd1`.
- Applicability conflict classifier test commit: `62a9ab9e0dee51bac9b69853d17af0224c8b826a`.
- BWG unauthenticated HTTP boundary test commit: `f9cb9b8ccbd1f4971b06884fabfe1041200782a8`; immutable checkpoint: [BWG HTTP authentication boundary tests](./checkpoints/2026-10-31-bwg-http-auth-boundary-tests.md). All six registered BWG routes are exercised through Fastify injection and must return 401/AUTH_REQUIRED without a session.
- Correct BWG route finding: all six BWG API paths exist in `apps/src/value-routes.ts` and are registered by `registerValueRoutes()` in `apps/src/server.ts`. Do not create duplicate routes or tables.
- Production BWG tables: `bwg_profiles`, `bwg_reporting_periods`, `bwg_waste_reports`, `bwg_epr_reports`, `bwg_esg_reports`.
- Issue #176 tracks remaining authorization, statutory approval linkage, quantity/error semantics and HTTP acceptance: https://github.com/vishaltradewinds/rupaykg/issues/176.

## CI evidence — do not conflate commits
- CI #3955 / ID `41218341622`: SUCCESS on `825d430a4b8140b7e3072a536508632db8547359`.
- CI #3956 / ID `41218359754`: SUCCESS on `824acb8d0c3866651d9038d369565dc7073a62b4`.
- CI #3960 / ID `41218598855`: SUCCESS on `4ae53077a37d023818879f9470fce71bb795dcd1`; validate job included dependency audit, migration validation, production-baseline reconstruction, proposed migration upgrade/idempotency, typecheck, build, browser smoke, disposable PostgreSQL acceptance tests, evidence upload and container build.
- CI #3965 / ID `41219392554`: SUCCESS on `62a9ab9e0dee51bac9b69853d17af0224c8b826a`.
- CI #3967 / ID `41219650791`: SUCCESS on governance commit `ec3a2b2a3fe46a1e3fcae7be994f7f775e2699ef`.
- CI #3971 / ID `41219851252`: IN_PROGRESS on BWG HTTP test commit `f9cb9b8ccbd1f4971b06884fabfe1041200782a8`; recheck exact SHA.
- Checkpoint commit `a2fc40643ff61721fd5c14114a5361fd2a61914c` had no exact-head CI run returned at checkpoint creation.
- Checkpoint commit `b2fe65d5fa5634aa7fcaa70557dfb16a48841c8c` had no run returned by exact-head query at checkpoint creation. Check latest Actions before claiming current-head CI.
- Never infer a current-head pass from a prior SHA.

## BWG remaining work — verified NOT DONE
1. Full authenticated HTTP acceptance tests for all six BWG API paths remain NOT DONE. The new unauthenticated HTTP test verifies all six routes return 401/AUTH_REQUIRED without a session; authenticated permission, cross-organization and geography cases still require DB-backed acceptance tests.
2. Positive and negative HTTP tests for unauthenticated requests, unverified membership, missing read/write permission, cross-organization access and geography scope.
3. Resolve the statutory workflow boundary: `POST /api/v1/statutory/bwg/assess` writes `organization_bwg_assessments`; BWG profile intake writes `bwg_profiles` as `REVIEW_REQUIRED/PENDING`. Migration 044 requires `APPLICABLE/VERIFIED` before reporting-period creation. No authorized dual-control transition connecting the assessment to verified profile state has been established. Never auto-promote.
4. Test evidence provenance, verification binding, read-after-write, idempotency, period trigger rejection and error semantics.
5. EPR route now explicitly rejects fulfilled quantity above obligated quantity and maps the exact known DB constraint to a stable conflict. Verify with route-level tests; do not rely only on helper tests.
6. Continue route → UI → tables → permissions → reports → tests crosswalk for all 14 route families.

## National product contract
RupayKg is pan-India national environmental infrastructure. Preserve the PostgreSQL-centred modular monolith; do not split services without measured evidence. One shared event/evidence/material model supports role-specific journeys.

Physical lifecycle:
`Obligation/Plan → Generation → Segregation → Storage → Collection Request/Schedule → Pickup → Weigh/Handover → Transport → Facility Receipt → Inspection/Sorting → Aggregation → Processing/Treatment → Recovered Output/By-product/Reject/Residual → Buyer/Offtake or Authorized Disposal → Verification → Reporting/Recognition`.

Truth lifecycle:
`LOCAL_CAPTURED → SYNC_RECEIVED → AUTHORITATIVE → VERIFIED → VALUE_ELIGIBLE → CERTIFIED/ISSUED → REGISTERED → TRANSFERRED/RETIRED → SETTLED → REPORTED`.
Never infer a later state from an earlier one. Distinguish declared, measured, received, reconciled, independently verified, eligible, officially accepted and settled quantities/statuses.

Generator must be first-class and distinct from BWG. A complete general generator journey (all generator types, site/stream ledger, segregation/storage, pickup scheduling, bilateral handover, destination receipt and reconciliation) is not yet proven. Continue collector/transporter/MRF/processor handoffs, mass balance, role-specific reporting, pagination/export and reproducible snapshots.

## Sole authoritative live database and safety posture
- Neon project: `rupaykg-production-fresh`, ID `steep-mud-79906940`.
- Sole production branch: `main`, ID `br-restless-base-b44cip2h`.
- Database: `rupaykg`.
- Latest read-only catalog in 16:19 UTC preflight: 67 public base tables; 0 RLS-enabled; 0 FORCE RLS; 0 public policies; five BWG tables; migration ledger 92 rows through `20261021`.
- Inspected roles `rupaykg` and `neon_service` have LOGIN/BYPASSRLS and elevated role/database/replication attributes; `cloud_admin` is SUPERUSER/BYPASSRLS. Least-privilege runtime identity NOT ESTABLISHED.
- Neon primary branch protection and GitHub main branch protection were disabled at last recorded check.
- Actual deployed application runtime DB principal NOT ASSESSED. Latest recorded live deployment was main commit `862512c8c904cef0f604df0350f02672318953af`; recheck only through authorized provider evidence.
- Production SQL read-only by default. No production DDL/DML, migrations, grants/RLS/role changes, production branch operations, deployment, worker activation or scheduler activation without all required gates and explicit Founder approval.
- Production HOLD; tenant isolation NOT ESTABLISHED; worker OFF; scheduler OFF; certification OFF.

## TRL and external assurance
- Internal software engineering maturity only; no independent TRL assessment is established by these CI results.
- Hardware/integrated national service readiness, representative field operation, statutory/CPCB acceptance, independent validation/verification, external registry/Hedera consensus, settlement, SLOs and backup/restore RPO/RTO are NOT ESTABLISHED.
- TRL 9 is NOT ESTABLISHED. Do not claim national production readiness.

## Ordered next execution
1. Re-poll CI #3971 on exact test SHA `f9cb9b8ccbd1f4971b06884fabfe1041200782a8` and check newer exact-head runs.
2. Add DB-backed authenticated HTTP tests for missing `reports:read`/write permission, unverified membership, cross-organization payload mismatch and geography denial.
3. Design and test the evidence-backed, dual-control statutory BWG assessment → verified-profile transition; preserve separation of duties and source/version provenance.
4. Complete EPR route-level quantity and DB error mapping tests.
5. Continue the all-route UI/API/schema/permission/report/test crosswalk and generator-to-processor lifecycle.
6. Prioritise P0 tenant isolation, table-specific RLS design, ACL/function/sequence ownership, trusted identity context and least-privilege API/migration/worker principals.
7. Reconcile production migration history against candidate migrations on a disposable production-derived Neon branch; never copy rehearsal schema wholesale or rewrite production ledger.
8. Inventory PR dependency graph; maintain one controlled integration spine. Do not merge/rebase PR #175 without independent review and approval.
9. Complete worker authority approval, tenant consumer, runtime identity, monitoring and recovery before activation.
10. Validate statutory sources/external interfaces, qualify hardware, run representative field trials, and prove operational SLOs, backup restore, privacy, support and multi-site operations before certification or TRL advancement.

## Resume instruction
Act as autonomous CTO execution owner under Shakti Standards. Discover and prioritise the next safe task without waiting for routine Founder prompts. Execute the largest coherent batch possible, continue independent work around blockers, test and preserve evidence, create immutable checkpoints and update this pointer. Escalate only decisions/approvals that genuinely require Founder authority. Report material verified progress, critical risks and indispensable Founder decisions only.
