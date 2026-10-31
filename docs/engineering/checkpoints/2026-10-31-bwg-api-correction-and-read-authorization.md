# Immutable checkpoint — BWG API correction and workspace read authorization — 2026-10-31

## Exact repository state
- Repository: vishaltradewinds/rupaykg.
- Branch: shakti/atomic-inbox-claim-2026-10-31.
- Source baseline at session start: b2deb5fb7b793e9a90aa59b7eadc22debebc980d.
- Preflight session-log commit: e91cacf839f39538b088936d2f8c0a87316824ca.
- BWG workspace permission fix commit: 825d430a4b8140b7e3072a536508632db8547359.
- BWG permission unit tests commit: 824acb8d0c3866651d9038d369565dc7073a62b4.
- Corrected national stakeholder matrix commit / exact source HEAD before this checkpoint: d8f13a9abcd7618c4525958ad0972ef45341256c.
- PR #175: OPEN/DRAFT, not merged; PR head tracks the working branch. Base main at 862512c8c904cef0f604df0350f02672318953af.
- Exact-head CI run #3957 / ID 41218377380 on d8f13a9abcd7618c4525958ad0972ef45341256c: IN_PROGRESS at checkpoint creation. Do not claim success until re-polled.

## Corrected BWG finding
- All six BWG API paths already exist in apps/src/value-routes.ts; registerValueRoutes() is registered in apps/src/server.ts. Do not create duplicate endpoints or tables.
- Canonical tables exist in production: bwg_profiles, bwg_reporting_periods, bwg_waste_reports, bwg_epr_reports, bwg_esg_reports.
- Candidate migration sources include 036–038, 043–044 and 20261019 workflow tracking.
- Issue #176 (https://github.com/vishaltradewinds/rupaykg/issues/176) has been corrected to track remaining authorization, statutory workflow, quantity, error semantics and HTTP acceptance work.

## Implemented in this batch
1. Added canReadBwgWorkspace() to enforce explicit PostgreSQL-backed reports:read permission for the BWG workspace read.
2. The GET handler now returns 403 BWG_WORKSPACE_READ_FORBIDDEN when that permission is absent.
3. Added unit coverage for allowed reports:read, denied permission and organization-scope mismatch.
4. Corrected the controlling stakeholder matrix to record the actual implemented endpoints and remaining blockers.
5. Added a mandatory session-start/preflight log with exact branch, PR, CI, Neon and Render evidence.

## Verified remaining BWG blockers
- POST /api/v1/statutory/bwg/assess writes organization_bwg_assessments; the BWG profile route writes bwg_profiles as REVIEW_REQUIRED/PENDING.
- Migration 044 requires a BWG profile with applicability_status=APPLICABLE and status=VERIFIED before reporting periods can be created. No reviewed authorized transition connecting assessment approval to the BWG profile was found. Do not auto-promote.
- The existing BWG test file previously contained only a pure review-basis test. This batch adds permission-helper unit tests, not full HTTP acceptance tests.
- Waste/EPR/ESG routes allow missing evidence and keep records PENDING; this must remain draft/intake only. No external filing/acceptance can be inferred.
- EPR fulfilled<=obligated is constrained by migration 043 but lacks an explicit route-level guard; known DB rejection currently risks surfacing as generic 503.
- Route-level HTTP tests, cross-tenant denial, evidence and quantity boundary tests, read-after-write, period trigger rejection and statutory approval workflow remain NOT DONE.

## Live authority and production safety recheck
- Sole authoritative Neon project rupaykg-production-fresh, ID steep-mud-79906940.
- Sole primary/default production branch main, ID br-restless-base-b44cip2h; database rupaykg.
- Read-only catalog: 67 public base tables, 0 RLS-enabled, 0 public policies, five BWG tables, migration ledger 92 rows through 20261021.
- Runtime role attributes remain unsafe for least privilege: rupaykg LOGIN + BYPASSRLS + CREATEDB + CREATEROLE + REPLICATION; neon_service similarly elevated; cloud_admin SUPERUSER. No runtime identity was verified.
- Neon primary branch protection is disabled. GitHub main branch protection and required status checks are also disabled.
- Working branch vs main is diverged: 300 commits ahead, 1 behind at preflight. PR #175 had 304 commits and 108 changed files after this batch's commits; integration risk remains high.
- Render service rupaykg remains on main; latest live deployment dep-dbis4nm417fc73a8m7ng runs commit 862512c8c904cef0f604df0350f02672318953af. Runtime DB principal/configuration NOT ASSESSED.
- No production DDL/DML, migration, grants/RLS/role change, deployment, worker or scheduler activation.

## TRL and release posture
- Engineering-only code and unit test changes; no external statutory acceptance, field validation or independent assurance.
- Production remains HOLD; tenant isolation NOT ESTABLISHED; worker OFF; scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.

## Ordered next steps
1. Re-poll exact-head CI for the latest resume-pointer commit after this checkpoint is added.
2. Add full BWG HTTP acceptance tests and explicit read/write permission negative tests.
3. Trace statutory BWG assessment to a dual-control, evidence-backed determination workflow; reconcile organization_bwg_assessments and bwg_profiles without automatic promotion.
4. Add explicit EPR quantity validation and stable DB constraint error mapping.
5. Build all-route UI→handler→table→permission→report→test crosswalk.
6. Recheck branch divergence/dependency graph and consolidate safely; do not merge PR #175.
7. Continue Neon P0 isolation/ACL/least-privilege and production-derived disposable migration rehearsal; no production writes.
8. Reassess Render runtime identity, backup/restore, monitoring and recovery before any production execution.