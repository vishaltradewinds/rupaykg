# BWG Workspace Read Authorization Correction — 2026-11-01

## Repository state
- Repository: vishaltradewinds/rupaykg
- Base: main
- Corrective branch: fix/bwg-workspace-reports-read-gate-2026-11-01
- Draft PR: https://github.com/vishaltradewinds/rupaykg/pull/194
- Related engineering issue: #176

## Finding
Current main implementation of GET /api/v1/workspaces/bwg authenticated the caller and selected the active organization, but queried BWG profile, reporting-period, waste, EPR, ESG, geography and scheme data without enforcing the documented reports:read permission. A previous checkpoint claimed this gate had been implemented; the current source did not contain it.

## Corrective change
- Reject callers without a verified active organization membership.
- Require reports:read before any BWG workspace data query.
- Return HTTP 403 / BWG_WORKSPACE_READ_FORBIDDEN on permission denial.
- Add Fastify HTTP tests proving a caller without reports:read is denied before BWG queries and a permitted caller can read the workspace.

## Validation
Exact-head CI is pending for PR #194. The CI workflow includes dependency audit, migration validation, disposable PostgreSQL migration/acceptance, typecheck, build, browser smoke test and production container build.

## Safety
- No schema changes.
- No production/staging data writes or DDL.
- No deployment, worker/scheduler activation, external submission or certification.
- Draft for independent review; do not merge until exact-head CI and independent review pass.
- Production remains HOLD.


## Exact-head CI result — 2026-11-01

Workflow #4280 / ID 41326506849 passed at PR code head 4724d68c1cfbe594b9751062b98dab3ee1c88135. All steps succeeded:
- dependency audit
- migration validation
- disposable PostgreSQL migration and acceptance
- TypeScript typecheck
- full build
- production web browser smoke test
- production container build
- cleanup

This is an engineering CI pass only. PR #194 remains draft/unmerged pending independent review. Production remains HOLD.


## Real PostgreSQL workspace authorization and tenant-isolation acceptance — 2026-11-01

Added `apps/src/bwg-workspace-postgres.integration.test.ts`:
- Creates two disposable organizations, each with a BWG profile.
- Creates a verified reader with `reports:read` and a separate verified member without it.
- Calls the actual Fastify `GET /api/v1/workspaces/bwg` route against disposable PostgreSQL using real session-token authentication and database-backed role permissions.
- Confirms the member without `reports:read` receives HTTP 403 / `BWG_WORKSPACE_READ_FORBIDDEN`.
- Confirms the authorized reader receives HTTP 200.
- Confirms the response contains only the selected organization's BWG profile and organization permission summary, not the second tenant's profile.
- Cleans up disposable identities, sessions, memberships, roles, profiles, geography and organizations.

The first CI run identified an invalid disposable fixture value (`NOT_SUBMITTED`) for `bwg_profiles.regulatory_registration_status`. The fixture was corrected to the schema-valid `ACCEPTED` enum with synthetic `TEST-CPCB-REG-*` references. No application authorization logic or production data was changed.

Exact-head code CI #4300 / ID 41329225214 passed at `9bba408244510553cec79d8e75a2a63db80209ee`, including dependency audit, migration validation, disposable PostgreSQL migration and acceptance, typecheck, build, browser smoke test and production container build. Documentation checkpoint update will receive its own exact-head CI run.

This is an engineering acceptance result only. The synthetic accepted registration fixture is test-only; it does not represent an actual CPCB registration. PR #194 remains draft/unmerged pending independent review. Production remains HOLD.


## Exact-head documentation CI confirmation — 2026-11-01

Documentation checkpoint commit `236b8e149e07d6894564c85a0856455cceab96f9` passed CI #4305 / ID 41329412332. All steps passed: dependency audit, migration validation, disposable PostgreSQL migration/acceptance, TypeScript typecheck, build, production web browser smoke test, disposable PostgreSQL workspace authorization acceptance, production container build and cleanup.

The workspace integration test validates both the `reports:read` deny/allow boundary and tenant-scoped result set using real disposable PostgreSQL. PR #194 remains draft/unmerged pending independent review. Production remains HOLD.

## Exact-head checkpoint CI confirmation — 2026-11-01 (run #4309)

The documentation checkpoint commit `74ae29d8fb0a371ab77e2ded779f07f1262789a8` passed exact-head CI #4309 / ID 41329700964. All workflow steps completed successfully, including dependency audit, migration validation, disposable PostgreSQL migration and acceptance, TypeScript typecheck, build, browser smoke test, production container build and cleanup.

This confirms the checkpoint's recorded workspace authorization and tenant-isolation acceptance. It remains engineering CI evidence only; PR #194 remains draft/unmerged pending independent review and production remains HOLD.

## Disposable membership fixture isolation and onboarding boundary finding — 2026-11-01

Removed test-time `ALTER TABLE ... DISABLE/ENABLE TRIGGER` from the BWG workspace PostgreSQL integration suite. The test uses a privileged disposable-CI membership fixture to exercise workspace authorization and tenant-scoped reads; it does not exercise the stakeholder onboarding approval lifecycle.

A schema review first identified migration 077's update-only membership trigger, then checked the superseding migration 086. Migration 086 replaces the guard with `BEFORE INSERT OR UPDATE OF status`, but intentionally returns early for INSERTs whose role is not `super_admin` or `platform_admin`; reserved-role inserts are subject to dual-control approval. The supported public onboarding API creates ordinary memberships as `PENDING`, and the hierarchy approval route promotes them only after the application approval chain completes. Consequently, ordinary-role direct SQL INSERTs with `status='VERIFIED'` are permitted by the current explicit policy exception. This is a policy/threat-model question for independent security review, not a confirmed unauthenticated HTTP bypass. Do not treat this workspace privileged fixture as proof of onboarding enforcement.

Exact-head CI for the latest PR #194 test-hygiene change is pending. Production remains HOLD.

## Test-fixture cleanup CI correction — 2026-11-01

The trigger-toggle removal edit malformed one workspace membership fixture SQL string. The prior CI run #4326 at the intermediate head is not accepted as validation. Reconstructed the fixture statement and verified the resulting source text. The latest PR #194 code head is now `a7f1a4fdf318f12b3969c5f45aefaae54e9e1a5b`; a new exact-head CI run is required and pending.

## Production tenant-isolation release blocker — 2026-11-01

Read-only inspection of authoritative Neon project `rupaykg-production-fresh`, default branch `main`, database `rupaykg` confirmed:
- 67 public ordinary tables; 0 have RLS enabled and 0 have FORCE RLS enabled.
- All 67 public tables are owned by `rupaykg`.
- Runtime-connected role `rupaykg` has `rolbypassrls=true`.
- The Neon default branch is reported as `protected=false`.
- `schema_migrations` contains 92 applied rows; latest version `20261021`.

No production writes, DDL, role changes or branch-setting changes were made. Application-level workspace authorization is not a substitute for database tenant isolation. A dedicated P0/P1 follow-up was opened as issue #196: https://github.com/vishaltradewinds/rupaykg/issues/196. The current PR #194 only hardens the BWG workspace HTTP read boundary; it does not remediate RLS or BYPASSRLS. Production remains HOLD pending a complete disposable-branch RLS programme, runtime-role separation, cross-tenant regression coverage and independent review.
