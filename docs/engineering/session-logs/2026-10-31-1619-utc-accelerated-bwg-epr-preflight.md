# Session preflight — accelerated BWG EPR contract correction — 2026-10-31

## Scope and evidence snapshot
- Repository: `vishaltradewinds/rupaykg`.
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Exact branch HEAD at preflight: `4ae53077a37d023818879f9470fce71bb795dcd1`; GitHub branch-to-commit comparison returned IDENTICAL.
- Main base: `862512c8c904cef0f604df0350f02672318953af`.
- Branch divergence at preflight: 307 commits ahead, 1 behind main. This is a controlled integration risk; no rebase, merge or branch switch is performed.
- PR #175: OPEN/DRAFT, unmerged. Review submissions: none; inline review threads: none. PR URL: https://github.com/vishaltradewinds/rupaykg/pull/175.
- Exact-head CI run #3960 / ID `41218598855`: SUCCESS on exact HEAD `4ae53077a37d023818879f9470fce71bb795dcd1`. The single `validate` job passed dependency audit, migration validation, exact production baseline reconstruction, proposed migration upgrade, migration runner idempotency, typecheck, build, browser smoke, disposable PostgreSQL acceptance tests, evidence upload and container build.
- Current PR branch is not deployed. Render service `rupaykg` (service `srv-daki4d7qj5pc73b8qksg`) is configured for `main`; latest live deploy `dep-dbis4nm417fc73a8m7ng` runs main commit `862512c8c904cef0f604df0350f02672318953af`. Actual Render runtime DB principal remains NOT ASSESSED; no environment secret values were inspected.

## Mandatory resume/decision records read
- `AGENTS.md`.
- `docs/engineering/RUPAYKG_RESUME_POINT_LATEST.md`.
- `docs/engineering/checkpoints/2026-10-31-bwg-api-correction-and-read-authorization.md`.
- `docs/engineering/RUPAYKG_2026-10-31_ATOMIC_INBOX_CHECKPOINT.md`.
- `docs/architecture/ADR-20261031-government-inbox-worker-authority-scope.md`.
- `docs/security/PRODUCTION_AUTHORIZATION_RLS_GAP_ASSESSMENT_2026-10-31.md`.
- `docs/engineering/STATEMENT_LEVEL_TENANT_ACCESS_REVIEW_PRIORITY_ROUTES_2026-10-31.md`.
- `docs/engineering/INTEGRATED_MIGRATION_WORKER_RELEASE_PLAN_2026-10-31.md`.
- `docs/security/API_ROUTE_DATABASE_AUTHORIZATION_MAP_2026-10-31.md`.
- `docs/product/NATIONAL_STAKEHOLDER_WORK_AND_REPORTING_MATRIX_2026-10-31.md`.

## Fresh read-only Neon production verification
- Sole authority: project `rupaykg-production-fresh` / `steep-mud-79906940`; default/primary branch `main` / `br-restless-base-b44cip2h`; database `rupaykg`.
- Public base tables: 67; RLS-enabled: 0; FORCE RLS: 0; public policies: 0.
- Migration ledger: 92 rows; maximum version `20261021`.
- Roles inspected: `rupaykg` and `neon_service` are LOGIN and BYPASSRLS with CREATEROLE, CREATEDB and REPLICATION; `neon_superuser` is NOLOGIN with the same elevated attributes; `cloud_admin` is SUPERUSER/BYPASSRLS. No least-privilege runtime identity is established.
- Primary Neon branch `protected=false`. Existing staging/rehearsal branches are not production authorities.
- Production check constraints on `bwg_epr_reports` include `bwg_epr_reports_fulfilled_le_obligated` with `fulfilled_quantity <= obligated_quantity`.
- All SQL in this preflight was read-only. No Neon DDL/DML, migration, role/grant/RLS change, branch operation or credential access occurred.

## Source finding for this batch
- `apps/src/value-routes.ts` contains the BWG EPR POST route. It validates non-negative quantities but does not explicitly reject `fulfilledQuantity > obligatedQuantity` before insert.
- The route's generic catch maps the known database check-constraint rejection to HTTP 503. The verified constraint name allows a narrow, non-leaking conflict mapping.
- `apps/src/value-routes.test.ts` currently has pure/helper tests for BWG intake and workspace read authorization; full HTTP acceptance remains NOT DONE.
- This batch will add route-level EPR quantity validation plus a narrow exact-constraint error classifier and unit tests. It will not change the schema, statutory applicability state, reporting submission state, or production data.

## Pointer discrepancies discovered
- The current resume pointer's branch divergence count (300 ahead / 1 behind) is stale; fresh GitHub comparison is 307 ahead / 1 behind.
- The pointer contains an earlier statement that the BWG workspace route handler was missing, followed later by the corrected finding that all six paths exist. The corrected finding is authoritative; the stale statement must be removed in the next pointer refresh.
- The exact-head CI status in the pointer is stale; CI #3960 has since passed on the preflight HEAD.

## Safety and TRL posture
- Production remains HOLD. Database-enforced tenant isolation is NOT ESTABLISHED.
- Worker OFF; scheduler OFF; certification OFF. Government/CPCB acceptance, external registry/Hedera confirmation, settlement, hardware field qualification and operational TRL 9 are NOT ESTABLISHED.
- No production deployment or production database change is authorized or performed.
