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
