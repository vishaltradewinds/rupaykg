# 2026-10-31 — BWG cross-tenant evidence rejection acceptance batch

## Scope and repository state
- Repository: `vishaltradewinds/rupaykg`.
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Tested code commit: `b5849670e06d6b397456cdd51873c87600f796c6`.
- PR #175: OPEN/DRAFT/unmerged; PR #161 also OPEN/DRAFT and shares this head on a stacked base. No review submissions or inline review threads were present at preflight.
- Preflight log: `docs/engineering/session-logs/2026-10-31-1718-utc-resume-preflight.md`.
- Related work tracked in Issue #176.

## Implementation
Added three disposable-PostgreSQL authenticated HTTP acceptance cases in `apps/src/value-routes.test.ts`:
1. A waste-report writer cannot attach verified evidence belonging to another organization.
2. An EPR-report writer cannot attach verified evidence belonging to another organization.
3. An ESG-report writer cannot attach verified evidence belonging to another organization.

Each case expects HTTP 409 / `EVIDENCE_NOT_VERIFIED` and asserts the target report table row count is unchanged. The test reuses independently reviewed evidence from the other fixtures; no production data is involved.

The BWG EPR route-level quantity rejection and exact database check-constraint mapping tests were already present in this branch. The previous resume pointer's statement that these tests were NOT DONE was stale and must be corrected.

## Exact-head CI evidence
- Workflow run #4032 / ID `41224099854`.
- Exact tested SHA: `b5849670e06d6b397456cdd51873c87600f796c6`.
- Overall conclusion at checkpoint creation: PENDING / IN_PROGRESS.
- Passed: dependency audit; migration validation; exact production migration baseline reconstruction; proposed migration upgrade and idempotency; typecheck; build; browser smoke; disposable PostgreSQL acceptance (including the new cross-tenant cases); production-shaped migration evidence upload.
- Production-container build was still IN_PROGRESS. Do not report overall CI success until the workflow completes.
- Prior preflight documentation run #4031 / ID `41224059390` was also IN_PROGRESS at checkpoint creation.

## Statutory BWG workflow audit — verified gap
- Official Gazette S.O. 388(E), Solid Waste Management Rules, 2026, defines BWGs by any one threshold: floor area >=20,000 sq.m.; water consumption >=40,000 litres/day; or solid waste generation >=100 kg/day. Rules effective 2026-04-01.
- Rule 6 requires BWG registration with the concerned local body through the centralised online portal, duties for collection/processing and EBWGR, and annual returns. The local body is the issuer of EBWGR certificates.
- Internal route `POST /api/v1/statutory/bwg/assess` writes `organization_bwg_assessments` with a calculated applicability status and submitter identity.
- BWG profile intake writes `bwg_profiles` as `REVIEW_REQUIRED/PENDING`; it does not consume or bind the statutory assessment.
- Migration 044 correctly blocks reporting-period creation unless `bwg_profiles` is `APPLICABLE/VERIFIED`.
- No authorized, independent-review transition from assessment to verified BWG profile has been established. Do not auto-promote, and do not treat an internal threshold calculation as local-body registration or statutory acceptance.
- Relevant source: Official Gazette PDF `https://egazette.gov.in/WriteReadData/2026/269620.pdf`; Rules 2026 definition and Rule 6.

## Production/database safety snapshot
- Sole authoritative live database: Neon project `rupaykg-production-fresh` (`steep-mud-79906940`), primary branch `main` (`br-restless-base-b44cip2h`), database `rupaykg`.
- Read-only catalog: 67 public base tables; zero RLS-enabled tables; zero public RLS policies; 92 migration rows through version `20261021`.
- Inspected roles `rupaykg` and `neon_service` have LOGIN, CREATEROLE, CREATEDB, REPLICATION and BYPASSRLS; `cloud_admin` is SUPERUSER/BYPASSRLS. Application runtime principal remains NOT ESTABLISHED.
- Neon production branch protection is disabled. GitHub main protection read was denied (403; NOT ASSESSED).
- Render service/runtime inspection is NOT ASSESSED because Render requires explicit workspace selection. Do not infer runtime principal from the Neon inspection role.
- No production SQL writes, DDL/DML, grants, roles, RLS, migrations, deployments, worker/scheduler activation, queue replay or certification activation.

## Remaining gates and ordered next work
1. Recheck CI #4032 and #4031; record exact conclusions. If #4032 fails, fix the failure on the same branch and rerun.
2. Design tenant-scoped idempotency for BWG waste/EPR/ESG report creation before implementation; current repository search found no idempotency implementation. Cover replay, key reuse with different payload, concurrent duplicate requests, atomic response persistence and no duplicate rows.
3. Design an evidence-backed, dual-control BWG applicability approval workflow. Preserve separation between submitter assessment, independent reviewer decision, local-body registration evidence, verified profile and reporting-period eligibility.
4. Continue route-to-UI/schema/permission/report/test crosswalk and P0 tenant isolation/RLS/least-privilege runtime work.
5. Keep PRs draft. Production remains HOLD; worker OFF; scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.
