# CTO execution checkpoint — 2026-11-04 batch 15

## CI confirmation
- PR #244 handoff commit `61094b13a1f9c76e78965765082b5791beaf4422` passed exact-head CI run #5327 (`41784108394`).
- Passed dependency audit, migration validation, disposable PostgreSQL migration execution, typecheck, production build, browser smoke, full test suite, production-container build and cleanup.
- This is documentation-branch engineering CI only; it is not production certification.

## Production tenant-isolation evidence
- Read-only production Neon catalog remains 67 public base tables, 181 public-schema foreign keys, 0 RLS and 0 FORCE RLS.
- All 67 tables remain owned by `rupaykg`; role retains BYPASSRLS, CREATEROLE, CREATEDB, REPLICATION and `neon_superuser` membership.
- Full catalog, 23 direct tenant-key tables, indirect/multi-party classifications and release gates are documented in `docs/engineering/PRODUCTION_TENANT_ISOLATION_INVENTORY_2026-11-04.md`.
- API authorization/execution surface review is documented in `docs/security/API_AUTHORIZATION_EXECUTION_SURFACE_REVIEW_2026-11-04.md`.
- Static route map covers 90 route declarations across 15 source files. This is not yet handler-by-handler dynamic authorization sign-off.
- Repository tree scan found no separate server-side worker/queue/cron entrypoint; operation sync is synchronous API intake/apply. External Render cron/worker configuration remains unverified. Guardian/Hedera live acceptance is manual workflow_dispatch, not CI.

## New API finding and remediation PR
- Found that `GET /api/v1/geography/roots` and `GET /api/v1/geography/children/:parentId` used any verified membership's geography scopes rather than the selected active organization.
- Created draft PR #246: `security/geography-active-organization-scope-2026-11-04`.
- Current head: `2fc6e37fc8000e766ac24cff8d234ce1c84aa327`.
- Added shared active-organization-bound `canReadGeography`, restricted roots/children queries to active organization, and added five unit tests (cross-org denial, SQL organization binding, missing active organization, malformed UUID, absent verified scope).
- CI run #5329 (`41784724429`) started on exact head. At checkpoint time, dependency installation was still running; no pass/fail conclusion yet.
- PR #246 remains draft and unmerged. Do not merge or deploy on pending CI.

## Verification authorization follow-up
- Reviewed PR #238 and issue #215. `canVerifyEvidence` helper does not itself accept/bind the subject organization; current route call sites add outer checks. The helper should be bound to the exact activity organization or accept an already-bound authorization context to avoid unsafe future reuse.
- PR #238 remains draft because the legacy live `verification_independence_guard` integration gap and unified trigger design remain unresolved.
- Added findings to issue #215; no production trigger changes.

## Migration/runtime separation
- Source confirms Docker web-service startup executes `migrate.js`, then guarded acceptance seed, then API server in the same web container.
- `migrate.ts` and runtime `server.ts` both consume `DATABASE_URL`; `render.yaml` defines one DB secret for the web service.
- Required design remains separate one-shot migration job with a separate narrow credential; do not inject migrator credential into the API service.

## Safety and current status
- Production remains READ-ONLY / HOLD.
- No production SQL writes, DDL, role/grant/ownership changes, RLS activation, migration, branch setting change, deployment, merge, worker activation or certification.
- PRs #243, #244, #238 and #246 remain draft/unmerged.
- Production migration drift, tenant RLS, runtime least privilege, independent DBA/security review, live Guardian/Hedera round-trip and SITE-JBP-01 field acceptance remain open.
- TRL 9 and production certification are NOT achieved.

## Next batch
1. Complete PR #246 exact-head CI; fix any failures and rerun.
2. Continue handler-level authorization review for EPR/ESG database permission functions, workspace projections, evidence artifact reads and bilateral resources.
3. Complete table-by-table RLS policy matrix and actual-runtime-role negative test harness on disposable Neon.
4. Resolve migration source/ledger drift without rewriting ledger or blindly replaying missing migrations.
5. Design and rehearse separate migration job and least-privilege runtime identity; no production changes.
