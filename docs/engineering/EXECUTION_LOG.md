

## 2026-11-04 — CTO Run 13 (06:03 UTC onward)
- Resumed from saved checkpoint and inspected PR #243, its exact head, workflow run and PR #244 handoff branch.
- Confirmed PR #243 remains open/draft/unmerged at `b700db8ffde6cd6492b545ed4c6e5bf2271b53b8`.
- Exact-head CI run #5320 (`41693406353`) completed SUCCESS. Its validate job passed production dependency audit, migration validation, disposable PostgreSQL migration execution, typecheck, production build, browser smoke, full tests including PostgreSQL acceptance and production-container build.
- Confirmed the strict custom TRUNCATE-trigger assertion is in the tested head; no FK-only fallback was accepted.
- Added exact-head CI evidence comments to PR #243 and issue #245.
- Inspected migration `20261022_mrv_artifact_source_revision.sql`, migration 089, MRV integration tests and snapshot contract. Artifact version/review revision triggers exist, but dedicated mutation regression tests remain outstanding; inspect actual artifact schema before implementing.
- Refreshed this resume point and execution log in PR #244 branch only. PR #244 remains open/draft/unmerged pending its own latest-head CI.
- Production remains READ-ONLY / HOLD. No production SQL writes, migrations, role/grant/RLS changes, deployments, merges, worker activation or certification.

### Next
- Inspect artifact table creation schema and add precise mutation invalidation tests on disposable PostgreSQL.
- Continue role/owner/runtime privilege mapping and full tenant table/endpoint/worker inventory.
- Keep PR #243 draft until independent DBA/security review and production blockers are resolved.


## 2026-11-04 — CTO Run 14 (06:06 UTC onward)
- Inspected PR #243 CI after adding artifact mutation tests. Latest test commit `4a8a4572a084811725eed8dd31c2c4a3f4d39eac` passed run #5323 (`41783246996`) end-to-end, including PostgreSQL acceptance and production-container build.
- Verified migration 20261021 actual evidence artifact table schema and added precise series/version/review invalidation regressions; UPDATE/DELETE attempts against immutable versions and append-only reviews are asserted to fail with their explicit trigger errors.
- Updated `migrations/README.md` to document migrations 088, 089 and 20261022 in commit `9bd10a7ae63ac07fe642b4044ad30383f25d71f2`. New exact-head CI #5324 (`41783404982`) was in progress at typecheck after migration validation and disposable PostgreSQL migration passed.
- Read-only source inspection found runtime and migration clients both consume `DATABASE_URL`; Render declares one DB secret. Added evidence/remediation comment to issue #196. Actual deployed role and memberships remain unverified; no grants changed.
- Added artifact test evidence to PR #243 and issue #245.
- Production remains READ-ONLY / HOLD. No production write, migration, role/grant/RLS change, deployment, merge, worker activation or certification.



## 2026-11-04 — CTO Run 14 final refresh
- Exact current PR #243 head 9bd10a7ae63ac07fe642b4044ad30383f25d71f2 passed CI run #5324 (41783404982) end-to-end, including PostgreSQL acceptance and production-container build. Added CI evidence comments to PR #243 and issue #245.
- Exact test head 4a8a4572 passed run #5323; artifact series/version/review invalidation tests and immutability guards passed.
- Read-only Neon catalog query confirmed 67 public base tables, 181 public FKs, 0 RLS, 0 FORCE RLS, all 67 tables owned by rupaykg; role rupaykg has LOGIN, CREATEROLE, CREATEDB, REPLICATION, BYPASSRLS, INHERIT and is a member of neon_superuser.
- Updated P0 issue #196 with production catalog evidence. No role, grant, ownership, RLS, schema or data mutation was made.
- Refreshed canonical resume point with exact CI and production catalog evidence. PR #243 and PR #244 remain draft/unmerged.
- Production remains READ-ONLY / HOLD. No production migration, deployment, merge, worker activation or certification.

## 2026-11-04 — CTO Run 15 (06:10 UTC onward)
- Confirmed PR #244 documentation head 61094b13 passed exact-head CI #5327 end-to-end, including dependency audit, migration validation, disposable PostgreSQL migration, typecheck, build, browser smoke, full tests and production container.
- Completed read-only production 67-table/181-FK tenant-isolation inventory; confirmed 0/67 RLS, 0/67 FORCE RLS, all tables owned by BYPASSRLS-capable privileged role. Committed full classification and release gates on PR #244 branch.
- Completed static route-family map across 90 route declarations in 15 source files; documented positive controls, unresolved dynamic tests, worker inventory and shared DB URL/migration-in-web-startup issue.
- Found geography roots/children endpoints scope via any verified membership rather than selected active organization. Created draft PR #246 with active-org-bound helper, endpoint filters and five regression tests. Exact-head CI #5329 is running; typecheck is in progress after dependency audit, migration validation and disposable DB migration passed. No CI pass claimed yet.
- Updated issue #196 with tenant inventory/route-surface evidence and issue #215 with the canVerifyEvidence organization-binding design requirement.
- PR #246 remains draft/unmerged. Production remains READ-ONLY / HOLD; no production SQL, DDL, role/grant/RLS, migration, deployment, merge, worker activation or certification.


## 2026-11-04 — CTO Run 16 (06:25 UTC onward)
- Verified PR #244 current head `94d7eff6f1486e24dffc323b7eec7daca5fd8170`; exact-head CI run #5332 (`41784895122`) completed SUCCESS. Dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests/PostgreSQL acceptance, production-container build and cleanup all passed.
- Verified PR #246 exact head `2fc6e37fc8000e766ac24cff8d234ce1c84aa327`; CI #5329 (`41784724429`) completed SUCCESS. Active-organization geography fix remains draft/unmerged.
- Re-read EPR/BWG route authorization and auth helper. EPR route-local membership checks are followed by active-organization-aware `hasOrganizationPermission`; do not misclassify the preliminary check as a confirmed bypass. Existing `canVerifyEvidence` helper still lacks an explicit subject-organization argument and needs full call-site mapping plus disposable cross-org tests before modification.
- A guessed migration-root fetch returned 404; no claims made about EPR/ESG database function definitions. Next locate authoritative migration directory through repository tree metadata and inspect exact function SQL, grants and search_path.
- Refreshed canonical resume point with exact CI evidence, updated authorization review and next batch.
- Production remains READ-ONLY / HOLD. No production SQL/DDL, migration, role/grant/ownership/RLS change, branch operation, deployment, merge, worker activation or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 — CTO Run 17 (06:28 UTC onward)
- Reconciled the exact production `schema_migrations` ledger (92 rows) against current-main migration tree (91 SQL files). Production records 001–087, 096, and 20261018–20261021; active current-main source lacks 096. Versions 088–095 are absent from production ledger.
- Confirmed migration 023 exists in current main and is recorded in production despite README claiming it is absent. README also omits migrations 029–087 and dated migrations, and incorrectly describes migration 015 as the high-risk permission migration (actual 015 is Guardian/Hedera; 041 is high-risk permissions).
- Verified `migrate.ts` and migration validator enumerate all numbered SQL files in the directory, not the stale README list. No ledger or migration source was modified.
- Read-only production function inspection found EPR/ESG authorization functions SECURITY INVOKER, owned by `rupaykg`, without function-level search_path configuration; live definitions include permission aliases absent from current migration 018. A DB-function body scan found no internal SQL/PLpgSQL callers; exhaustive application call-site proof remains outstanding.
- Updated P0 issue #214 with exact ledger, source tree and live function-definition evidence. Refreshed canonical resume point.
- PR #244 head `9081e98fec3e263fc95c8a377ebd2156d6ea4cb3` passed exact-head CI #5335 (`41785611740`) across all configured stages. PR remains draft/unmerged.
- Production remains READ-ONLY / HOLD. No SQL writes, DDL, migration, function change, role/grant/ownership/RLS change, branch operation, deployment, merge, worker activation or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 — CTO Run 18 (06:40 UTC onward)
- Confirmed PR #244 head `92b5215a56cba12a5880175e9b63e44c2aedb4b3` exact-head CI #5337 (`41785952488`) SUCCESS across all stages, including full tests/PostgreSQL acceptance and production-container build.
- Recovered exact historical migration 096 SQL from commit `ca8f4100782e13f8d72106187fafc8e1e446214f` / blob `258b1f4534efbf915688f78aa84d4ec24a47cbc0`; confirmed removal commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`. Preserved source and review-only findings in `docs/security/RECOVERED_MIGRATION_096_REVIEW_2026-11-04.md`; did not restore or replay it.
- Read-only production trigger inspection confirmed separate legacy `verification_independence_guard` still accepts role names VERIFIER/AUDITOR and strict `verifications_integrity_guard` matches recovered 096. The strict trigger overwrites the authorization snapshot on approved-row UPDATE; immutability and downgrade/re-approval semantics are not enforced.
- Confirmed current-main `apps/src/value-routes.ts` invokes `can_assess_epr` and `can_write_esg`; production definitions have role-name fallback and live aliases beyond migration 018. Added exact evidence and remediation requirements to issue #214.
- Added exact 91-file source inventory, recovered 096 evidence/review document, and corrected migration README on PR #244 branch. 096 remains absent from active source; no production data/schema/function/trigger/role change occurred.
- Updated canonical resume point with Run 18 findings and next work. Commits after CI #5337 are new docs-only heads and require their own exact-head CI validation.
- Production remains READ-ONLY / HOLD. No SQL writes, DDL, migration, trigger/function change, role/grant/ownership/RLS change, branch operation, deployment, merge, worker activation or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 — CTO Run 19 (staging migration recovery)
- Read-only Neon staging inspection confirmed four staging-only ledger entries 20261022–20261025. Exact original SQL remains unrecovered; catalog-level reconstruction was recorded in `docs/engineering/STAGING_ASYNC_MIRROR_AI_INTAKE_EVIDENCE_2026-11-04.md`.
- Staging tables: all four owned by `rupaykg`, all RLS/FORCE RLS off. Inbox is source/global (no organization_id); AI jobs/rate limits are tenant scoped. Inbox has 12 TEST-AUTH/TEST-MUNI rows and 29 append-only events. Eight PROCESSING leases expired; one RETRY is overdue; one quarantined after five attempts; one validated. AI jobs/rate limits empty.
- No matching current-main worker/application files or independent deployed worker/scheduler/queue consumer were proven. This is abandoned staging test state, not live authority feed evidence.
- Updated P0 issue #214, migration inventory, and canonical resume point. No staging or production writes, schema changes, worker activation or migrations performed.
- PR #244 latest documentation head requires exact-head CI check; prior #5337 success applies only to head `92b5215a56cba12a5880175e9b63e44c2aedb4b3`.
- Production remains READ-ONLY / HOLD; no DDL/DML, role/grant/RLS/function/trigger changes, deployment, merge or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 — CTO Run 20 (verification trigger clarification)
- PR #244 head `0a8b55f62065080163bec5db858e6f75c2b03ad6` passed exact-head CI #5346 (`41787820120`) across all configured stages.
- Clarified that the legacy `verification_independence_guard` role-name fallback is contradictory/redundant but not a demonstrated bypass while strict `verifications_integrity_guard` remains active; alphabetical trigger order runs the legacy BEFORE INSERT guard first, strict guard afterward.
- Confirmed separate snapshot-mutability defect: strict guard overwrites authorization snapshot on every APPROVED-row UPDATE. Updated issue #214 and recovered 096 review to separate confirmed defect from unproven bypass.
- Preserved staging-only async mirror/AI intake catalog evidence; 8 test inbox rows have expired leases, one retry overdue, no current-main worker source or independent worker deployment proven. No staging/production writes.
- Latest documentation head after clarification requires its own exact-head CI; #5346 does not cover subsequent commits. Production remains READ-ONLY / HOLD. TRL 9 NOT ACHIEVED.


## 2026-11-04 — CTO Run 21 (cross-org verification authorization)
- Traced evidence-vault review endpoint and confirmed cross-org REJECTED path: API helper previously accepted VERIFY_EVIDENCE from any verified org membership with matching geography; target org only required evidence:review; recovered 096 DB guard enforces same-org verifier permission only for APPROVED; legacy trigger globally accepts permission for both decisions.
- This is a cross-organization REJECTED decision/write defect, not an APPROVED verification bypass. Issue #215 updated.
- Opened focused draft PR #247 on `security/verification-authorization-tenant-binding-2026-11-04`: exact-org helper binding, route passes subject organization, unit/integration regressions, and forward-only migration replacing both triggers with one same-org explicit-permission/write-once snapshot guard. Migration not applied anywhere.
- PR #247 initial head `6a5fd9c5288e56d7243ab70f39f5a928f6235208`; CI #5350 (`41788676133`) in progress at this checkpoint.
- PR #244 latest documentation head `12d9664e3e4b62138a0f69d0588715b743d63ee8` passed CI #5349 end-to-end; remains draft/unmerged.
- Production remains READ-ONLY / HOLD. No production or staging writes, migrations, role/grant/RLS/function/trigger changes, worker activation, deployment, merge or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 — CTO Run 22 (verification tenant-binding CI accepted)
- PR #247 exact head `50b0391dab1f2564f1d8e7a48ec592466eaa79e3` passed CI #5354 (`41789024956`) end-to-end: audit, migration validation, disposable PostgreSQL migration, typecheck, build, browser smoke, full PostgreSQL tests, production container and cleanup.
- Corrected missed second `canVerifyEvidence` call in `workspace-routes.ts`; exact active organization now passed and enforced in both review/verification endpoints.
- First CI failure was the missed second callsite; second CI failure was an established self-approval error-text assertion. Both corrected. New evidence-vault tests passed: cross-org rejected insert blocked at API and DB, same-org approved/rejected valid, snapshot captured, update blocked.
- PR #247 remains draft/unmerged; candidate migration unapplied. Two-session race tests, geography fail-open remediation, non-owner runtime role and independent DBA/security review remain open.
- PR #244 exact head `76dfd7bbdc272bfbe98963005dd2727e177a46c5` passed CI #5351 (`41788775436`) end-to-end.
- Production remains READ-ONLY / HOLD. No production/staging writes, migrations, role/grant/RLS changes, deployments, worker activation or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 — CTO Run 23 (verification revocation race assurance)
- PR #247 latest head `39ecdb1e373a4ffcc80c1465cfc6d42bfd10482f` passed exact-head CI #5357 (`41789402772`) end-to-end, including new two-session role-permission revocation race test, full PostgreSQL acceptance and production container build.
- Race test proves verification insert waits behind an in-flight role permission update and re-evaluates after revocation commits; no cross-tenant decision proceeds, and prior approved snapshot remains unchanged.
- PR #247 remains draft/unmerged; migration unapplied. Identity suspension/membership revocation race tests, non-owner runtime role, production-like schema with recovered 096 columns/triggers, DELETE privilege/tamper controls and geography fail-closed remain open.
- PR #244 latest documentation head `c15536707d3326156286b89bcea2b84d3a228a51` passed CI #5356 (`41789332489`) end-to-end.
- Updated canonical resume point. Production remains READ-ONLY / HOLD; no production/staging writes, migrations, role/grant/RLS/function/trigger changes, deployment, worker activation or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 — CTO Run 24 (three verification revocation race tests green)
- PR #247 exact head `4fed4494bfada75f0cb4c1cfbb4e10a8108198fc` passed CI #5360 (`41789915766`) end-to-end, including three two-session PostgreSQL races: role permission revocation, membership status deactivation, and identity suspension. In each, the verification insert is observed waiting on the relevant row lock and fails after the revocation/suspension commits.
- Confirmed prior approved decision-time permission snapshot remains unchanged after role permission revocation/restoration.
- PR #247 remains draft/unmerged; candidate migration unapplied. Remaining: production-like schema rehearsal with 096 columns/triggers, non-owner runtime role grants, lock-order/deadlock review, geography fail-closed, deletion/tamper controls and independent DBA/security review.
- PR #244 exact latest head `ff6872c1f90c0964bd9c1e31cbeb1adbf96410a3` passed CI #5359 (`41789805891`) end-to-end.
- Updated canonical resume point. Production remains READ-ONLY / HOLD. No production/staging writes, migration, role/grant/RLS/function/trigger changes, deployment, worker activation or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 — CTO Run 25 (verification migration reapplication rehearsal)
- PR #247 head `c03e70b1f7a67f381479e4d63eed96b2d5c5f3c4` passed CI #5364 (`41790629910`) end-to-end, including disposable migration reapplication with pre-existing snapshot columns and both historical trigger names. Test asserts exactly one canonical verification trigger remains.
- Three two-session role-permission, membership-deactivation and identity-suspension races remain green.
- Documented critical least-privilege constraint: SECURITY INVOKER `SELECT ... FOR SHARE` requires UPDATE privilege on at least one column of each locked table. Do not grant broad UPDATE to API runtime. A narrow guard execution role or coordinated advisory-lock design must be reviewed/tested under FORCE RLS and non-owner runtime. Updated issues #196 and #215.
- PR #247 remains draft/unmerged; candidate migration unapplied. PR #244 exact head `91554b8cc62b194388fe4bd01b27e259a835e372` passed CI #5362.
- Production remains READ-ONLY / HOLD. No production/staging writes, migrations, role/grant/RLS/function/trigger changes, deployment, worker activation or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 — CTO Run 26 (07:28 UTC onward)
- Resumed from Run 25 and created a clean local worktree from PR #247 exact head `c03e70b1f7a67f381479e4d63eed96b2d5c5f3c4`.
- Code review found an additional role-tenant binding gap: a membership in organization A could reference a role owned by organization B. Bound both `hasOrganizationPermission` and `canVerifyEvidence` to `roles.organization_id = organization_memberships.organization_id`; added a unit assertion and a malformed cross-tenant membership in the PostgreSQL regression fixture.
- Found the candidate verification trigger omitted the non-null activity-geography check and existing organization geography-scope function that the application helper already enforced. Added both checks to the DB trigger and a direct-DB geography-less activity negative regression. The no-configured-scope permissive behavior in `organization_has_geography_scope` remains a separate open fail-closed issue.
- Committed and pushed code head `ff75e989fcdef02cbb0719b8aaeb993e506c3a56` to PR #247; exact-head CI #5367 (`41794095914`) started. Added PR comment #6625463871 with evidence and local validation limitations.
- Local typecheck, build, migration validation (92 migrations / 73 schema objects), diff check and focused auth tests (5/5) passed. Full local suite had 90 pass, 8 skip, 1 Windows CORS runtime spawn failure; PostgreSQL integration tests skipped because no local DATABASE_URL or Docker engine was available.
- Reviewed least-privilege constraint. No broad UPDATE grant or production change made. A dedicated NOLOGIN SECURITY DEFINER guard role with narrow column-level lock rights and explicit FORCE RLS policies is a candidate only; it requires disposable PostgreSQL proof and independent review.
- Added checkpoint `docs/engineering/checkpoints/2026-11-04-cto-run-26-verification-tenant-binding.md` and refreshed the canonical resume point. Production remains READ-ONLY / HOLD; PRs remain draft/unmerged; candidate migration unapplied; TRL 9 NOT ACHIEVED.

- Run-26 code head `ff75e989fcdef02cbb0719b8aaeb993e506c3a56` passed exact-head CI #5367 (`41794095914`) SUCCESS, including PostgreSQL acceptance for malformed cross-tenant role binding and geography-less verification denial.
- Run-26 documentation head `3926690892527584c0cc7e3397d4f2ae79000caf` passed exact-head CI #5368 (`41794335224`) SUCCESS across all stages. Added the exact-head CI closure to the canonical resume point and commented on PR #244.
- Added `docs/security/VERIFICATION_GUARD_NON_OWNER_EXECUTION_DESIGN_2026-11-04.md`, a design-only prototype proposal for a NOLOGIN/NOBYPASSRLS SECURITY DEFINER guard role, narrow lock privilege, GUC-scoped RLS policies and deterministic lock order. It remains unimplemented/unapproved and requires disposable FORCE RLS proof plus independent DBA/security review.
- PR #244 documentation head `1c39a399218584fc3ce8f143385e3e54adec754f` passed exact-head CI #5372 (`41794655157`) SUCCESS across all configured stages. The later-added guard-role design proposal will be validated on the next docs head.


## 2026-11-04 — CTO Run 27 (membership-role tenant integrity)
- Found that the schema's single-column `organization_memberships.role_id -> roles.id` FK did not require role and membership organizations to match; several application authorization joins also omitted the equality.
- Read-only Neon main check returned 0 mismatched membership-role pairs (0 VERIFIED, 0 PENDING). No production data was changed.
- Created stacked draft PR #252, exact head `2228100e0da0a1dc9321b11e48f6b2fa4ee6ba33`, based on PR #247. Added migration `2026110401_membership_role_tenant_binding.sql` with a validated composite FK and supporting indexes; hardened auth-routes, onboarding hierarchy and platform-admin role joins; added direct DB INSERT/UPDATE rejection tests and platform-admin SQL-shape assertion.
- Local validation passed: 93 migrations / 73 schema objects; typecheck; production build; focused platform-admin/auth tests 19/19; diff check.
- Temporary validation-only PR #254 targets main to run CI for the combined stack. Exact-head CI #5376 (`41796337375`) had passed dependency audit, migration validation, fresh PostgreSQL migration, typecheck, build, browser smoke and disposable PostgreSQL acceptance; production-container build was still running at checkpoint.
- Added Run-27 checkpoint and refreshed canonical resume point. Production remains READ-ONLY / HOLD; no production migration or release action; TRL 9 NOT ACHIEVED.


## 2026-11-04 — CTO Run 28 (non-owner verification guard prototype)
- Added isolated-schema disposable PostgreSQL prototype in PR #263, stacked on PR #252 and PR #247. Latest exact head `1ce986d3e5ceab339a77fd1d64d4911b0fbabad4`; PR remains open/draft/unmerged.
- Exact-head CI #5407 (`41804235750`) passed all stages, including disposable PostgreSQL integration and production-container build. Earlier head `178e7c77bb5c848fdef27281acdf6a404894d0d4` also passed CI #5402.
- Replaced simulated API identity with a real password-authenticated non-owner API login and separate non-login function-owner role. API cannot assume the function-owner role; spoofed context settings do not expose evidence; trigger restores caller settings.

The prototype confirmed that row locking under FORCE RLS needs both a narrow column-level lock privilege and exact-row policies. These policies allow locking but reject identifier changes; the function-owner role receives no table-level mutation or delete grant. Disposable tests passed for same-organization success, cross-organization/self/geography/suspended-identity denial, and concurrent role-permission revocation, membership deactivation and identity suspension.

Added Run-28 checkpoint and refreshed the canonical resume point and guard design. Temporary validation PR #264 closed unmerged. Production remains READ-ONLY / HOLD; no production changes; TRL 9 NOT ACHIEVED.
