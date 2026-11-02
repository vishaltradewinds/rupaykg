# RupayKg engineering execution log

Append-only record. Do not rewrite earlier entries.

## 2026-11-02 17:23 UTC — CTO automation run 2

- Re-established canonical repository `vishaltradewinds/rupaykg` and inspected GitHub main, open PRs/issues, latest CI runs, exact-head job steps/logs, and Neon production project/branches/catalog.
- Confirmed production Neon: project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`; 67 public tables, 0 RLS, 0 FORCE RLS, 92 migration-ledger rows/latest `20261021`, only inspected `rupaykg` role with BYPASSRLS/CREATEROLE/CREATEDB.
- Reviewed PR #211 EPR read-only RLS route and exact-head CI. Added negative integration assertions for EPR INSERT/UPDATE/DELETE and signing-key table SELECT; used savepoints to ensure each expected permission error is independently tested.
- Commit: `0d4ea374d13cec45b7cb4855fce1e4725225fd40`.
- Exact-head CI [41490199189](https://github.com/vishaltradewinds/rupaykg/actions/runs/41490199189) SUCCESS: migrations, restricted roles in disposable CI PostgreSQL, typecheck, build, two-custodian bootstrap test, browser smoke, full tests and container build.
- Diagnosed preceding CI failure [41490061149](https://github.com/vishaltradewinds/rupaykg/actions/runs/41490061149): failed expected-denial assertion due aborted transaction; fixed with savepoints and verified on new exact head.
- Updated PR #211 body with exact-head evidence.
- Closed PR #207 unmerged as superseded by the stronger #211 EPR read-only RLS implementation; preserved its branch.
- Updated P0 issue #195 with current PR #192 CI pass and the still-missing founder/DBA/security approvals.
- Render service inspection remains blocked pending explicit workspace selection. No workspace was selected.
- No production database, role, grant, migration, secret, deployment, worker, scheduler or certification change was made.
- Next: reconcile #192 → #205 → #211; complete endpoint/table/transaction/tenant matrix; obtain founder and independent security/DBA gates; keep production HOLD.


## 2026-11-02 17:53 UTC — auth/MRV convergence and branch hygiene

- Reconfirmed canonical repository, latest PR heads, exact-head CI jobs and the authoritative Neon production branch. Read-only production query: 67 public tables, 0 RLS, 0 FORCE RLS, 92 migration rows/latest 20261021, zero organizations/identities/roles/memberships/platform access requests, and elevated rupaykg login role.
- Reverified the MRV source-snapshot typecheck correction: commit b028755 uses a separate SHA-256 digest rather than passing non-anchor fields to the strict Hedera AnchorPayload hash. Exact-head CI 41494418403 passed the complete workflow. Documentation-only head c68c023 passed 41494550889. Current PR #192 head 8f28e4f is a test-deduplication commit; CI 41495054442 had passed full tests and was at production-container build at 17:53 UTC.
- Reverified PR #213 EPR read-only candidate CI 41493275165 SUCCESS. It uses one signed tenant transaction client for permission and protected reads, defaults OFF, and registers no EPR write routes. Rebase/reconciliation against the newer #192 head and independent review remain required.
- Closed PRs #205, #211 and #212 unmerged with explicit supersession comments; preserved their branches. PR #213 remains the only EPR read-only candidate in this integration stack.
- Inspected current MRV worker source: 30-second heartbeat wraps Guardian, HCS and Mirror Node calls and renews a 120-second lease. Prior “no heartbeat” note is stale. Worker still lacks the signed-tenant/system-actor RLS access model; lease-loss cancellation/race tests remain open; worker stays OFF.
- Main is two commits ahead of PR #192's merge base. Main commit 14b735 added AUTH_DATABASE_URL and a3fecc0 reverted it; PR #192 requires a separate auth runtime pool. This contract must be reconciled before merge; no blind rebase/merge.
- Neon metadata also reports an unprotected primary branch, no IP allowlist entries and public connections not blocked. This is an additional hardening item; no setting was changed.
- Added immutable checkpoint: docs/engineering/checkpoints/2026-11-02-auth-mrv-convergence-and-release-gates.md. Added session log: docs/engineering/session-logs/2026-11-02-cto-auth-mrv-convergence.md. Updated the latest resume pointer in this documentation branch.
- No production DDL/DML, migrations, role/grant/RLS changes, Neon branch operations, secrets, deployments, provider writes, worker/scheduler activation or certification occurred. Production HOLD; certification OFF; TRL 9 NOT ESTABLISHED.


## 2026-11-02 17:56 UTC — MRV single-path enforcement and worker contract

- Verified code commit 248e997 adds a 30-second heartbeat around Guardian, HCS and Mirror Node calls with 120-second lease renewal. Lease-loss results are discarded; in-flight provider calls are not cancelled, so bounded timeouts and adapter cancellation remain open.
- Verified commit beef362 fails closed on the legacy synchronous MRV submit route unless explicitly enabled and refuses direct submission whenever the durable worker is enabled. This prevents concurrent direct/worker provider execution.
- Added apps/src/mrv-routes.test.ts at commit ffab45c64c301f6e38d9678972071546c323d54e. It asserts default-off and worker/direct mutual exclusion before auth/database access. Exact-head CI for ffab45c is pending; no test pass is claimed.
- Verified commit 739d11 adds a disposable PostgreSQL assertion that NEEDS_RECONCILIATION jobs are not automatically claimed. Run 41495699292 was in progress at browser smoke. Run 41495765539 for the worker contract documentation was in progress at build.
- Verified exact-head CI 41495348937 SUCCESS on head 461aa5367eed48bfb02524bbf7ca9ea4e56878db, including migration validation, disposable migration/bootstrap, typecheck/build, browser smoke, full tests and container build.
- Closed PRs #205/#211/#212 unmerged as superseded; branches preserved. PR #213 remains the only EPR read-only candidate pending rebase to current #192 and fresh CI.
- Production Neon remains 0/67 RLS and the elevated rupaykg login is unchanged. Main is two commits ahead of PR #192's merge base; AUTH_DATABASE_URL/auth-pool contract must be reconciled before merge.
- Added immutable checkpoint docs/engineering/checkpoints/2026-11-02-mrv-single-path-and-worker-contract.md and session log docs/engineering/session-logs/2026-11-02-cto-mrv-single-path.md; refreshed the resume pointer.
- No production DDL/DML, migrations, roles/grants/RLS changes, branch operations, secrets, deployments, provider writes, worker/scheduler activation or certification. Production HOLD; worker OFF; certification OFF; TRL 9 NOT ESTABLISHED.


## 2026-11-02 18:01 UTC — MRV source snapshot revalidation and CI fixture repair

- Worker authorization now re-reads observations, evidence and latest measurement quantity/unit before provider stages. The immutable enqueue snapshot comparison rejects changed source data.
- Disposable tests cover measurement quantity and evidence content-hash mutation and exact restoration. Deterministic timestamp + row-ID ordering was aligned across worker revalidation, API enqueue, direct preflight/re-read and the test fixture.
- Exact CI 41496015060 failed because the synthetic fixture omitted live evidence and quantity/unit while the database contained them. The fail-closed comparison was correct; the fixture was repaired to query the same source rows as the API. Runs 41496118629 and 41496146332 also failed at this same fixture assertion.
- Exact CI 41495848722 passed the direct-submit default-off/mutual-exclusion tests; 41495699292 passed NEEDS_RECONCILIATION claim exclusion; 41495765539 passed the worker contract docs. Current exact-head CI 41496454924 for 4781bfe was at TypeScript typecheck at 18:01 UTC; no source-snapshot pass is claimed until it completes.
- Added immutable checkpoint docs/engineering/checkpoints/2026-11-02-mrv-source-snapshot-revalidation.md and session log docs/engineering/session-logs/2026-11-02-cto-mrv-snapshot-revalidation.md; refreshed the latest resume pointer.
- Production Neon remains 0/67 RLS with the elevated rupaykg login. PR #192 remains draft/unmerged and two commits behind main; PR #213 needs rebase/fresh CI. PRs #205/#211/#212 remain closed unmerged as superseded.
- No production DDL/DML, migration, role/grant/RLS change, branch operation, secret, deployment, provider write, worker/scheduler activation or certification. Production HOLD; worker OFF; certification OFF; TRL 9 NOT ESTABLISHED.


## 2026-11-02 18:02 UTC — exact-head MRV snapshot CI progress

- Exact-head CI 41496454924 for PR #192 head 4781bfe03ac68bf61031b9c2e8924dcd498d259e passed migration validation, restricted verifier-owner provisioning, disposable migrations, bootstrap privilege teardown, typecheck, build, synthetic two-custodian bootstrap, browser smoke and the full disposable PostgreSQL acceptance suite, including source quantity/evidence-hash mutation and restoration assertions.
- Production-container build remains in progress; the workflow is not yet fully green. Do not claim full CI success until the container job and cleanup complete.
- The direct-submit gate tests passed in CI 41495848722; the NEEDS_RECONCILIATION claim-exclusion test passed in 41495699292; worker contract docs passed in 41495765539.
- PR #192 remains draft/unmerged and two commits behind main. PR #213 remains the only EPR read-only candidate pending rebase and fresh CI. PRs #205/#211/#212 remain closed unmerged as superseded.
- Production Neon remains 0/67 RLS and the elevated rupaykg login is unchanged. No production mutation, secret, deployment, worker activation or certification occurred.


## 2026-11-02 18:03 UTC — MRV snapshot exact-head CI PASS

- Exact-head CI 41496454924 completed SUCCESS on PR #192 head 4781bfe03ac68bf61031b9c2e8924dcd498d259e, including migration validation, restricted verifier provisioning, disposable migrations, bootstrap privilege teardown, typecheck/build, synthetic two-custodian bootstrap, browser smoke, full PostgreSQL tests with source-snapshot mutation/restoration and production-container build/cleanup.
- Follow-up test-only commit 59c5dc1 aligns the initial worker-ledger fixture with the same complete source snapshot. Exact-head CI 41496873635 is running; latest head remains pending.
- Added immutable checkpoint docs/engineering/checkpoints/2026-11-02-mrv-snapshot-ci-green.md and session log docs/engineering/session-logs/2026-11-02-cto-mrv-snapshot-ci.md; refreshed resume pointer.
- Production Neon remains 0/67 RLS and elevated rupaykg login unchanged. PR #192 remains draft/unmerged and two commits behind main; PR #213 requires rebase/fresh CI. No production mutation, deployment, worker activation or certification.


## 2026-11-02 18:04 UTC — MRV source snapshot final CI acceptance

- Exact-head CI 41496873635 completed SUCCESS on code/test head 59c5dc1d0976dbd7b92e2d9194c3d3f07f40e431 with all 22 steps successful. Exact-head CI 41496954424 completed SUCCESS on documentation-only head 250395f4914fe74bb4fdbb19e3beff2867fa5aa8, also all 22 steps successful.
- The passing workflow covers migration validation, restricted verifier provisioning, disposable migrations, bootstrap privilege teardown, synthetic two-custodian bootstrap, typecheck/build, browser smoke, full tests including source quantity/evidence-hash mutation/restoration, container build and cleanup.
- Direct-submit gate tests passed in 41495848722; NEEDS_RECONCILIATION claim exclusion passed in 41495699292.
- Added immutable checkpoint docs/engineering/checkpoints/2026-11-02-mrv-snapshot-final-ci-acceptance.md and session log docs/engineering/session-logs/2026-11-02-cto-mrv-final-ci.md; refreshed latest resume pointer.
- Production Neon remains 0/67 RLS with elevated rupaykg login; dedicated app/auth runtime roles are absent. PR #192 remains draft/unmerged and two commits behind main; PR #213 requires rebase/fresh CI. PRs #205/#211/#212 remain closed unmerged as superseded.
- No production mutation, migration, role/grant/RLS change, secret, deployment, provider write, worker activation or certification. Production HOLD; worker OFF; certification OFF; TRL 9 NOT ESTABLISHED.


## 2026-11-02 18:30 UTC — parallel execution resume and live Neon assurance refresh

- Reconnected to canonical `vishaltradewinds/rupaykg`; verified PR #192 exact head `51b673d...` CI [41498504841](https://github.com/vishaltradewinds/rupaykg/actions/runs/41498504841) SUCCESS.
- Verified PR #213 EPR candidate exact head `cd96ec5...` CI [41499847180](https://github.com/vishaltradewinds/rupaykg/actions/runs/41499847180) SUCCESS; all 22 steps completed, including disposable PostgreSQL migration/role tests, full tests and production-container build. Candidate remains DRAFT, feature flag OFF, no write route, no production activation.
- Compared PR #213 to current PR #192 head: 30 commits ahead, 0 behind; current #192 head is merge-base. PR #213's recorded target-base SHA remains older (`ae41ed7...`); keep draft until base metadata is reconciled and independent security/DBA review passes.
- Verified PR #203 UI head exact-head CI [41454665904](https://github.com/vishaltradewinds/rupaykg/actions/runs/41454665904) SUCCESS. Accessibility/localization/field usability still open.
- Verified BWG PR #193 exact-head CI [41332732530](https://github.com/vishaltradewinds/rupaykg/actions/runs/41332732530) SUCCESS and PR #194 exact-head CI [41332741365](https://github.com/vishaltradewinds/rupaykg/actions/runs/41332741365) SUCCESS. Independent review remains open.
- Re-ran read-only Neon catalog checks against production project `steep-mud-79906940`, primary branch `br-restless-base-b44cip2h`, database `rupaykg`: 67 public base tables; 0 RLS; 0 FORCE RLS; 70 public non-internal triggers; 92 migration rows/latest `20261021_evidence_artifact_vault.sql`.
- Function inventory: 115 PUBLIC-EXECUTE functions total in public schema, of which 78 are owned by `rupaykg` and 37 by `cloud_admin` (extension functions). All 78 app-owned functions have PUBLIC EXECUTE; none is SECURITY DEFINER. Classify application and extension functions separately before any privilege changes.
- Only `rupaykg` app-named role was observed; it is LOGIN/BYPASSRLS/CREATEDB/CREATEROLE/INHERIT/REPLICATION. No dedicated `rupaykg_app_runtime` role observed. Neon project settings still show public connections unblocked, empty IP allowlist and unprotected primary branch. Existing lab/rehearsal branches preserved.
- Added immutable checkpoint `docs/engineering/checkpoints/2026-11-02-parallel-execution-live-assurance-refresh.md`; refreshed this resume pointer. No production DDL/DML, migrations, role/grant/RLS changes, secret writes, branch operations, deployments, provider writes, worker/scheduler activation or certification.
- Next parallel batch: classify 78 app-owned functions; map 70 triggers; finish 67-table and endpoint-to-data authorization matrices; implement worker system-actor/RLS acceptance on disposable PostgreSQL; reconcile PR #192 auth-pool/main ancestry and PR #213 target-base metadata; continue BWG and UI accessibility gates. Production HOLD; worker OFF; certification OFF; TRL 9 NOT ESTABLISHED.


## 2026-11-02 18:36 UTC — production function exposure first-pass audit

- Read-only production catalog/source review separated 78 `rupaykg`-owned public functions from 37 `cloud_admin` extension functions. All 78 app-owned functions have PUBLIC EXECUTE; none is SECURITY DEFINER; no function-level pinned search_path was observed.
- Of the 78 application functions, 67 distinct functions are referenced by the 70 public non-internal triggers; 11 are non-trigger functions.
- Reviewed all 11 non-trigger function bodies. Flagged three mutating routines (`allocate_environmental_attribute_claim`, `allocate_epr_credit`, `release_epr_credit_allocation`) with no explicit actor/organization/signed-tenant authorization in their bodies; PUBLIC EXECUTE is present, though SECURITY INVOKER still requires underlying table privileges. Do not blanket-revoke or grant before call-site/dependency analysis.
- Flagged `identity_has_permission` and `has_verification_permission` as global-across-membership helpers without an organization argument; call sites must not use them as tenant-scoped proof.
- Flagged `organization_has_geography_scope` returning TRUE when no VERIFIED scope exists; this is fail-open for unconfigured geography and requires a founder/authority-approved default plus tests before any change.
- All 67 distinct trigger functions are SECURITY INVOKER with no pinned function search_path. Trigger-to-table/event/function/owner/role mapping remains a required next batch.
- Added immutable checkpoint `docs/engineering/checkpoints/2026-11-02-production-function-exposure-review.md`. No production privilege, role, grant, schema, data, migration, deployment, worker, external registry or certification state changed.


## CI freshness correction — 2026-11-02 18:38 UTC

A subsequent PR-head refresh found PR #193 and #194 each advanced after their earlier successful exact-head runs. Their current heads are #193 `29e1c29254ff81db341bc55da5f2031e68928846` and #194 `5008a04038f2002a48949044c7389acc9eabe66f`; new exact-head CI runs [41500716186](https://github.com/vishaltradewinds/rupaykg/actions/runs/41500716186) and [41500726098](https://github.com/vishaltradewinds/rupaykg/actions/runs/41500726098) are IN PROGRESS. Earlier CI successes apply only to prior heads and do not certify these current heads. Documentation PR #204 current head `69696922911d84f65119e3e440f01ddb3cc010c6` also has exact-head CI [41500770887](https://github.com/vishaltradewinds/rupaykg/actions/runs/41500770887) IN PROGRESS. PR #213 exact-head CI 41499847180 and PR #192 exact-head CI 41498504841 remain SUCCESS. Keep all PRs unmerged pending current exact-head CI and required independent review.


## 2026-11-02 — production trigger/tenant-boundary audit continuation

- Read-only Neon inspection enumerated 70 public non-internal trigger instances across the production schema, mapped to 67 distinct application-owned trigger functions and their tables/events. All app trigger functions are SECURITY INVOKER; no function-level pinned search_path observed.
- Flagged `enforce_verification_independence` global membership lookup; cross-checked `prevent_invalid_verification` second trigger which requires same-activity-organization VERIFIED membership, VERIFIED identity, not suspended and snapshots authorization for APPROVED decisions. This is a defense-in-depth inconsistency requiring a scoped first trigger and tests, not evidence that the approved path is unguarded.
- Flagged `prevent_unauthorized_stakeholder_approval` global platform role lookup; reserved platform-admin model may be intended but requires explicit governance boundary and active/non-suspended identity checks.
- Confirmed `organization_has_geography_scope` returns TRUE when no VERIFIED scope exists. Pan-India authority must be explicit verified national scope; missing rows must not silently grant national reach. Founder/authority policy decision and negative tests required.
- Reaffirmed PR #198 as controlling 67-table RLS design. Trigger audit adds concrete database-side paths, while all 67 table route/worker/trigger call graphs remain not fully closed. No source code change made to production trigger functions.
- Created immutable report `docs/engineering/checkpoints/2026-11-02-production-trigger-tenant-boundary-audit.md`.
- Fresh exact-head CI: PR #193 run 41500716186 SUCCESS; PR #194 run 41500726098 SUCCESS; PR #204 run 41500882768 IN PROGRESS. PR #213 remains draft; exact-head CI passed earlier. No merge or production changes.
