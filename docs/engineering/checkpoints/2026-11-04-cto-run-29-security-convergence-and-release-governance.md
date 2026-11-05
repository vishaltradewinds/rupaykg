# RupayKg CTO checkpoint — Run 29: verification convergence and release governance

**Date:** 2026-11-04  
**Repository:** `vishaltradewinds/rupaykg`  
**Authoritative live database:** Neon project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`  
**Production posture:** READ-ONLY / HOLD  
**Governing standard:** Shakti Standards — full lifecycle, one controlled integration spine.

## 1. Verified engineering changes

### PR #272 — canonical verification-trigger baseline
- Latest head: `a8ce1c9bbb1d88a88dffe142967fec65d7ad77d9`.
- Exact-head CI #5516 / run `41874461093`: **SUCCESS**, all 18 configured steps passed, including disposable PostgreSQL migration/reapplication, non-superuser helper-owner transfer, typecheck, build, browser smoke, PostgreSQL acceptance and production-container build.
- Corrected a fail-open condition in the trigger: an organization with no VERIFIED geography roots previously returned `true`. It now requires an explicit VERIFIED root equal to or ancestral to the activity geography.
- Added a full-schema regression: the organization's only root is changed to PENDING and a verification for an otherwise valid non-null activity geography must be denied.
- PR remains OPEN / DRAFT / UNMERGED. Candidate migration not applied.

### PR #284 — signed bearer context and tenant-bound application checks
- Prior head `2b1ebc88237e9274e563b5605295ce925cabd234` passed exact-head CI #5518 / run `41874715707` SUCCESS.
- Removed PUBLIC EXECUTE grants from authenticated-context helper functions. The disposable API role receives only an explicit grant on the context-issuer function; it cannot directly call the private validator/identity/organization helpers.
- Follow-up head: `cbd743a8d2e17100cd1607ef19f90bef6a6ccc6d`. It ports exact activity-organization and role-organization binding into `hasOrganizationPermission` and `canVerifyEvidence`, checks active/non-suspended identity, and passes the resolved organization ID from both verification write routes.
- Exact-head CI #5521 / run `41875338287` was **IN PROGRESS** at checkpoint time. Migration validation, disposable context proof, typecheck, build, browser smoke and PostgreSQL acceptance had passed; production-container build/cleanup remained in progress. Do not claim full success until the run completes.
- PR remains OPEN / DRAFT / UNMERGED. No production API runtime identity or EXECUTE grant is established.

### Other validated dependency evidence
- PR #252 membership-to-role tenant binding: exact-head CI #5376 / run `41796337375` SUCCESS; draft/unmerged.
- PR #250 + #251 geography fail-closed migration/fixture combined rehearsal: temporary PR #287 exact-head CI #5506 / run `41871842788` SUCCESS; PR #287 closed unmerged. Unstacked #250 run #5504 failed on the expected fixture dependency; do not treat that as a defect in the combined stack.
- PR #268 migration/API-startup separation: exact-head CI #5406 / run `41804150174` SUCCESS; draft/unmerged. It requires a separate migrator URL, TLS/CA, orphan-ledger fail-closed check and API-only startup. No production migrator credential is provisioned.
- PR #263 isolated non-owner/FORCE RLS prototype: latest head `d785882c4befc3ecb360e7c73e2005bfdbfe3c13`, CI #5457 / run `41812353414` SUCCESS. This remains prototype evidence, not a production schema rehearsal.
- PR #282 signed-context proof CI #5474 and PR #277 actual-schema non-owner proof CI #5465 remain successful evidence branches; neither is a complete production tenant-isolation pass.
- Temporary validation PRs #286 and #287 are CLOSED / UNMERGED. No PR was merged.

## 2. Authoritative Neon production recheck — SELECT/catalog only

Fresh single-statement catalog audit returned:
- 67 public base tables; RLS enabled: 0; FORCE RLS: 0; public policies: 0.
- All 67 public tables owned by `rupaykg`.
- `schema_migrations`: 92 rows; latest version `20261021`.
- Observed `rupaykg` role: LOGIN, CREATEROLE, CREATEDB, REPLICATION and BYPASSRLS; not SUPERUSER; member of `neon_superuser`.
- Audit connection itself reports `current_user=session_user='rupaykg'`. This is not evidence of the Render API's actual database identity.

No production DDL/DML, migration, role/grant/ownership change, RLS change, branch operation or data write occurred.

## 3. Release governance and connected systems

### Render
- Live service `srv-daki4d7qj5pc73b8qksg`, branch `main`, repository `vishaltradewinds/rupaykg`.
- Live configuration: `autoDeploy=yes`, `autoDeployTrigger=commit`, Docker, Free plan, Singapore, one instance, `/health`.
- Latest live deploy remains `934062ef8af2ca47bbcbf5e37c12de12a4f9f743`.
- Checked-in `render.yaml` at that commit declares service name `rupaykg-production` and `autoDeployTrigger: checksPass`. Live configuration therefore drifts from the manifest and deploys on commit.
- No Render setting, secret, environment variable or deployment was changed. A Render log query in this run was blocked because no workspace was selected; no workspace was selected on the user's behalf.

### GitHub
- `main.protected=false`; repository rulesets query returned an empty list.
- Branch-protection endpoint returned 403 to the connected integration, but the branch object itself reports `protected=false`.
- No branch protection or ruleset was changed.

## 4. Critical convergence blockers

1. **One canonical trigger only.** PR #272 and PR #284 both define `public.enforce_verification_authorization()` and `verification_authorization_guard`. If combined naively, migration ordering lets the later #272 migration replace the signed-context trigger. The final function must combine DB-issued bearer context, exact activity-organization membership, role-organization consistency, verified identity/organization/geography, immutable decision-time provenance and the reviewed lock order.
2. **One shared guard owner.** #272 uses `rupaykg_verification_guard`; #284 uses `rupaykg_auth_context_owner`. The integrated design must use one NOLOGIN/NOSUPERUSER/NOBYPASSRLS guard owner with narrow SELECT/column-lock privileges and safe search_path. The API role must not SET ROLE or read the signing key.
3. **Two context layers.** Keep `app.request_context` / `withRlsRequestTransaction` as the general RLS context and the DB-issued bearer context as the verification-write guard. Both must be set on the same checked-out client and top-level transaction, identify the same actor and exact active organization, and be compared by the final trigger. COMMIT/ROLLBACK/savepoint rollback/pool reuse must not leak either context.
4. **Runtime identity and grants.** The actual Render API database username/role remains unverified. No production API EXECUTE grant exists for the context issuer. Do not infer the API identity from the Neon audit connection.
5. **Migration lineage.** Production has 92 ledger rows while active main has 91 migration source files; version 096 remains an orphaned applied ledger record with its source preserved as archival evidence only. Do not replay 096 or rewrite the ledger. PR #268 is still a draft.
6. **Tenant isolation.** 0/67 production tables have RLS/FORCE RLS; the current owner/runtime role has BYPASSRLS and broad role attributes. The 67-table policy matrix, function/trigger/search_path/grant audit and actual non-owner FORCE RLS rehearsal remain open.
7. **Release controls.** Main is unprotected and Render deploys on commits, not checks-pass. Any settings/ruleset change requires a controlled, explicitly approved release-governance change.

## 5. Evidence-based readiness

- National platform: provisional TRL 3; individually tested software components at most TRL 4.
- SITE-JBP-01 Kathonda remains PRE-VALIDATION; field evidence, calibrated instrument acceptance, live chain-of-custody and independent site operation are not established.
- Live Guardian/Hedera/Mirror Node round-trip, independent statutory/methodology acceptance, disaster-recovery acceptance and production security review remain unproven.
- Production certification and TRL 9: **NOT ACHIEVED**.

## 6. Next controlled batch

1. Close exact-head CI #5521 for PR #284; repair any failure without relaxing negative assertions.
2. Create one integration branch based on the selected #272 trigger plus #252 membership-role tenant integrity, #250/#251 geography fail-closed, and #284 signed context. Consolidate both trigger migrations and guard roles before any combined rehearsal.
3. Integrate both context layers on the same client/transaction and add adversarial tests for forged app/DB context, cross-tenant membership/role, session replay/revocation, identity suspension, organization status, geography removal/reassignment, self-verification, snapshot immutability, pool reuse and lock-order races.
4. Rehearse on disposable PostgreSQL with recovered migration-096 columns and exact legacy trigger/function composition; verify idempotency and one canonical trigger.
5. Prove exact API/migrator identities and grants in a Neon-like disposable environment; keep the live Render role unknown until safe diagnostic evidence is obtained through an approved connection/workspace.
6. Complete 67-table RLS/FORCE RLS policy matrix and independent DBA/security review.
7. Keep production READ-ONLY / HOLD. Do not merge, migrate, alter roles/grants/RLS, change branches, deploy, activate workers or certify without independent gates and explicit founder approval.
