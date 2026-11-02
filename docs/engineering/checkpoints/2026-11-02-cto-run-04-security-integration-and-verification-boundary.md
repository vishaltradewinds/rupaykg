# RupayKg CTO checkpoint — 2026-11-02 security integration and verification boundary

## Scope and safety

Autonomous CTO run under Shakti Standards. Inspected the canonical repository, open issues/PRs, exact-head CI, Neon production and non-authoritative rehearsal branches, and connected Render access. Executed safe repository-only changes and read-only database inspection.

No production DDL/DML, migration, role/grant/RLS change, secret write, branch operation, deployment, provider write, worker/scheduler activation or certification occurred.

## Engineering work preserved

### EPR read-only tenant route

- PR #213 rebased onto the latest auth/MRV foundation without discarding either branch history. Merge commit cd96ec579e2eda726b3fbe9e2d261f5b2ce9d832; parent foundation 51b673dcf662dbae3f6a04ff84682083f6295fee; original EPR head preserved as second parent.
- Compare confirms 30 commits ahead and 0 behind the current #192 head.
- Exact-head CI 41499847180 passed all 22 steps.
- Route remains GET-only, explicitly enabled, default OFF in environment/render configuration.
- Hardened startup database contract, tests and migration preflight to reject non-SELECT EPR table privileges, all direct request-signing-key table privileges and CREATE on app_security.
- No production activation or migration.

### BWG authorization candidates

- PR #193 rebased onto current main with merge commit 29e1c29254ff81db341bc55da5f2031e68928846. Exact-head CI 41500716186 passed 17/17 steps.
- PR #194 rebased onto current main with merge commit 5008a04038f2002a48949044c7389acc9eabe66f. Exact-head CI 41500726098 passed 17/17 steps.
- Both remain open and unmerged. Independent review remains required.
- BWG profile intake remains PENDING / REVIEW_REQUIRED; applicant evidence does not self-certify statutory applicability. Workspace data requires reports:read before queries.

### Auth/MRV integration spine

- PR #192 current head 51b673dcf662dbae3f6a04ff84682083f6295fee; exact-head CI 41498504841 passed 22/22.
- PR #192 remains DRAFT and UNMERGED. It is 537 commits ahead and 2 behind current main. The two main-only commits are the AUTH_DATABASE_URL add/revert sequence; no blind merge/rebase attempted.
- Worker source-snapshot revalidation and ambiguous HCS retry-stage preservation have passing disposable tests. Worker remains OFF.

## Production Neon evidence

Project steep-mud-79906940, primary branch br-restless-base-b44cip2h, database rupaykg:
- 67 public base tables; 0 RLS / 0 FORCE RLS.
- 92 migration rows; latest date-version 20261021.
- 0 organizations, 0 identities, 0 memberships and 0 platform access requests.
- Only rupaykg-prefixed application role observed: LOGIN, BYPASSRLS, CREATEROLE, CREATEDB, INHERIT and REPLICATION.
- Neon primary branch reports protected=false.

Non-authoritative rehearsals:
- Tenant-isolation lab: 67 tables, 4 RLS/4 FORCE RLS.
- RLS-assurance lab: 67 tables, 1 RLS/1 FORCE RLS on epr_returns.
- Runtime/auth lab roles are restricted, but RLS-enabled tables remain owned by rupaykg; owner/migrator/runtime separation is not proven.
- Government-inbox staging: 71 tables, 95 ledger rows through 20261025, 0 RLS/0 FORCE RLS; four extra migration rows/tables and no production 096 ledger row.
- Disposable geography/verifier rehearsal: seven candidate function replacements succeeded; missing organization/geography and unknown verifier context returned FALSE; pinned search_path observed. Zero organizations/activities were present, so this is smoke evidence only, not two-tenant acceptance.

## Migration source and verification findings

- Production ledger records 096_verification_authorization_provenance.sql applied at 2026-10-27T13:46:14.262Z. Source was recovered from commit ca8f4100782e13f8d72106187fafc8e1e446214f (Git blob 258b1f4534efbf915688f78aa84d4ec24a47cbc0) and removed in commit 54a7fe1ceb41b37a68720a71c10a1dd03af30dea as unreviewed. Exact source is archived outside the active migrations directory.
- Staging-only migrations 20261022–20261025 have no source in current repository path history. Do not copy to production.
- Migration README corrected: 023_lifecycle_state_guards.sql exists and is recorded in production; prior statement that 023 was absent was stale.
- Production verifications has zero rows and four authorization snapshot columns. prevent_invalid_verification matches recovered 096; verification_independence_guard remains a global-membership/role-name fallback trigger. No dedicated immutable snapshot trigger observed.
- Candidate migrations 20261106/20261107 reintroduce role-name fallback and apply same-org checks only inside APPROVED decisions. Candidate 20261108 changes missing geography scope to FALSE, but is not deployed. Production organization_has_geography_scope currently returns TRUE when no VERIFIED scope exists.
- P0 issues #214 and #215 created. #214 tracks source/ledger reconciliation; #215 tracks tenant-bound explicit verification permission, fail-closed geography, legacy trigger replacement and snapshot immutability.
- No production trigger/function change made.

## Tenant isolation and release governance

- P0 issue #196 updated with production/lab evidence.
- Production: 0/67 RLS, 0/67 FORCE RLS; only elevated rupaykg runtime role observed.
- 78 rupaykg-owned public functions have PUBLIC EXECUTE; none SECURITY DEFINER. 37 cloud_admin extension functions require separate classification. 70 trigger instances map to 67 app-owned trigger functions; all inspected functions SECURITY INVOKER without pinned search_path.
- GitHub rulesets list empty; branch-protection endpoint returned 403 to the integration. Main protection could not be verified. No settings changed.
- Render inspection requires explicit workspace selection; none was selected.
- Issue #195 still requires founder approval for the initial authority identity/trust model and two-custodian ceremony.

## TRL and next gates

- National platform provisional TRL 3; tested software components at most TRL 4. No TRL 9 claim.
- Evidence discovery, design and engineering are complete for these isolated candidate slices; independent approval, production deployment, field operation, measurement and continuous assurance are not complete.
- Next: resolve #215 on disposable PostgreSQL with negative tests; resolve #214 source/ledger drift; independently review #192/#213; complete 67-table RLS/authorization matrix and role split; implement worker system-actor/RLS contract; complete BWG and UI reviews; obtain founder and DBA approvals.
- Production remains HOLD; worker OFF; certification OFF.