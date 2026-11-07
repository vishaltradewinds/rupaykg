# RupayKg CTO Resume Point — 2026-11-07

## Authority
- Primary working/release repository: vishaltradewinds/rupaykg
- Authoritative branch: main
- Secondary evidence repository: rupaykg-aistudio
- Production Neon remains READ-ONLY / HOLD.

## Exact current engineering heads
- PR #331: 50e463df30f18a30e6a192da447a451d1816ea55
- PR #332: a636a26e81cdaac88c69247e333b88c64a7ececa

## Verified work in this batch
- Added fail-closed protection to the migration runner for the four 20261107 protected Shakti migrations. They require explicit RUPAYKG_ALLOW_PROTECTED_SHAKTI_MIGRATIONS=1.
- CI provisions a disposable runtime role with NOBYPASSRLS and NOLOGIN, then enables LOGIN only for the disposable CI test environment.
- CI runs the protected migration gate explicitly.
- CI now executes runtime-identity/tenant-isolation integration tests using the disposable non-BYPASSRLS runtime role while retaining a separate owner connection for fixture setup/cleanup.
- Exact PR #332 head re-read and diff inspected after the changes.

## Validation status
- Exact-head GitHub Actions workflow runs for PR #331/#332 are still not visible through the available GitHub evidence surface.
- Therefore CI PASS is NOT VERIFIED.
- The new runtime integration test is configured to prove current_user is not SUPERUSER/CREATEROLE/CREATEDB/BYPASSRLS, tenant-A visibility excludes tenant-B, and cross-tenant insert is rejected by RLS when the test gate is enabled.
- This is test configuration/code, not proof that the test has executed successfully.

## Production gate
- No production DDL/DML.
- No production migration.
- No production role/grant/RLS change.
- No deployment, worker activation or certification.
- Production RLS activation remains blocked pending independent review, runtime identity proof, representative negative tests, rollback/restore evidence and explicit release authorization.
- TRL 9 remains NOT ACHIEVED / NOT CLAIMED.

## Residual tenant-isolation audit and Evidence Vault remediation
- Added `docs/engineering/SHAKTI_TENANT_ISOLATION_RESIDUAL_AUDIT_20261107.md`.
- Refactored Evidence Vault upload/list/download/review database access to execute under `withTenantTransaction` and the active organization request context.
- Refactored MRV submission, provenance read, and Hedera provenance verification database operations to execute under `withTenantTransaction`.
- MRV helper functions now accept the transaction client so geography, permission and acceptance-fixture checks remain on the same tenant-bound transaction.
- Exact-head workflow lookup for the latest MRV head returns no runs; CI/runtime execution and production RLS safety remain unverified.

## Next autonomous action
1. Obtain exact-head CI evidence for PR #332; diagnose only safe CI failures.
2. Continue Issue #326 Batch E with the highest-risk residual tenant paths, starting with evidence vault and MRV.
3. Reconcile every changed table against the 67-table policy matrix.
4. Prepare, but do not execute, a disposable full-RLS rehearsal before any production activation proposal.


### 2026-11-07 — CPCB SWM tenant-isolation batch
- Refactored `apps/src/cpcb-swm-routes.ts` so workspace list/read, create and update permission/geography checks and tenant-sensitive database operations execute through `withTenantTransaction`.
- Removed direct `pool.query`/`pool.connect` tenant-sensitive access from CPCB SWM routes; the route now uses the active organization request context for database work.
- Fixed the not-found update path so it returns from the tenant transaction without issuing a manual rollback that would invalidate the transaction helper.
- Latest PR #332 code head: `ff29013085d78d55800f4fe6edf0c2905aae79ee`.
- Exact-head workflow lookup returned no runs; CI/runtime validation remains **NOT VERIFIED**.
- Production database/RLS/deployment remains **HOLD**; no production changes made.


### 2026-11-07 — Value/BWG tenant-isolation remediation
- Refactored `apps/src/value-routes.ts` across carbon calculations, EPR assessment, ESG metric recording, BWG workspace reads and BWG profile/reporting-period/waste/EPR/ESG writes to use `withTenantTransaction` for tenant-sensitive database operations.
- Permission and geography checks for BWG profile/reporting-period writes are now executed inside the same tenant transaction as the mutation.
- Body-specified BWG writes require the requested organization to be the active organization, preventing a request from selecting a different membership while the database context remains another tenant.
- Removed the BWG workspace fallback to an arbitrary first membership; tenant workspace access now requires an explicit active organization.
- Latest code head: `40c6d5f50e9f8b3b0e211391c2c46b3153422e3a`.
- Static route audit: 2 remaining `pool.query` references are helper internals accepting `Pool | PoolClient`; no direct tenant-route `pool.connect` remains. Ten tenant transaction wrappers are present across the route surface.
- Exact-head GitHub workflow lookup and combined status returned no runs/statuses; CI remains **NOT VERIFIED**.
- Production Neon/RLS/deployment remains **HOLD**; no production changes made.


### 2026-11-07 — Onboarding authority transaction hardening
- Refactored `apps/src/onboarding-hierarchy-routes.ts` to use the existing `withPlatformTransaction` and `withAuthorityTransaction` helpers for legal-verification and onboarding-decision mutations.
- Removed manual `pool.connect`/begin/commit/rollback/release handling from these mutation paths; explicit platform/authority context is now established by the transaction helpers.
- This surface is intentionally treated as authority/platform workflow, not ordinary tenant workspace access; no tenant transaction was imposed on platform/regulator approval operations.
- Latest code head: `e3b09b6956bdcce35cc6b492f41357e5d9c878d7`.
- Exact-head GitHub workflow lookup returned no runs and combined status returned no statuses; CI remains **NOT VERIFIED**.
- Production Neon/RLS/deployment remains **HOLD**; no production changes made.


### 2026-11-07 — MRV idempotency/tenant-context hardening
- Removed the remaining MRV route-level `pool.connect` session advisory lock from `apps/src/mrv-routes.ts`.
- Replaced it with `pg_advisory_xact_lock` executed on the same `withTenantTransaction` client, so the idempotency lock is scoped to the transaction and cannot outlive/rely on a separate session connection.
- MRV status now requires an explicit active organization rather than falling back to the first membership.
- Latest code head: `482e77c42a2b46cfb8e0696405e5593d966e23c5`.
- Static MRV audit: no remaining `pool.connect`; tenant-sensitive route work remains transaction-bound. CI/runtime validation remains **NOT VERIFIED**.
- Production Neon/RLS/deployment remains **HOLD**; no production changes made.


### 2026-11-07 — Residual authority/context batch
- Evidence Vault `activityContext` now uses its supplied tenant `client` for activity and geography-scope reads; no remaining direct `pool.query` in the route.
- Onboarding review queue now executes its pending-application/approval/authority checks inside `withPlatformTransaction`; no remaining direct `pool.query` in the route.
- Latest commits: Evidence Vault `1e6e669dedd6adb383d86eeced0a2c4b880fad1d`; onboarding `b528267070f6ff587ca0bb1dd393ae5053f58dc6`.
- Static audit result: Evidence Vault and onboarding route files have zero direct `pool.query`/route-level `pool.connect` references. CI/runtime validation remains **NOT VERIFIED**.
- Production Neon/RLS/deployment remains **HOLD**; no production changes made.


### 2026-11-07 — Field-device tenant-context hardening
- `apps/src/sync-routes.ts` now binds field-device enrollment and verification to explicit `auth.activeOrganizationId` and executes their DB mutations through `withTenantTransaction`.
- Enrollment rejects an organization different from the active tenant. Verification rejects devices outside the active tenant.
- `requireFieldDevice` was prepared to operate against the tenant transaction client and return organization binding.
- Commits: `cd2c33e383f89edcb65f5c4b7a7dcf1757f7deda`, `ccc867a7004712d8d9f9806d641690d93887daa3`, `19c6447f6151cf9d4e34ac3e2e9384c808fc0183`.
- Exact-head GitHub Actions lookup for `19c6447f6151cf9d4e34ac3e2e9384c808fc0183` returned no workflow runs; CI remains NOT VERIFIED.
- Production remains HOLD/READ-ONLY; no production DDL/DML, role/grant, RLS activation, deployment, worker activation, or certification was performed.

### 2026-11-07 — Workspace tenant-context hardening
- Removed the multi-membership fallback in `apps/src/workspace-routes.ts`; workspace access now returns no organizations when `auth.activeOrganizationId` is absent instead of iterating every membership.
- This is an incremental fail-closed improvement. Workspace DB reads still require a subsequent transaction-local tenant-context reconciliation pass; no production changes made.
- Commit: `2e2b21f843fd93aec9f35388a1deed43f844be42`.

### 2026-11-07 — Residual server tenant-fallback removal
- Removed the final two single-membership tenant fallbacks from `apps/src/server.ts` for resource-flow and measurement routes.
- Both routes now require an explicit `auth.activeOrganizationId`; they no longer infer tenant context from the first/only membership.
- Commit: `1f28690eb89643a3da44443493ddf936a0f340ae`.
- Exact-head CI remains NOT VERIFIED because the available GitHub evidence surface returns no workflow runs/statuses for the current head.
- Production Neon/RLS/deployment remains HOLD; no production changes made.


### 2026-11-07 — Core tenant-context and platform-admin batch
- Core `apps/src/server.ts` tenant-sensitive overview/geography/resource-flow/measurement routes now require an explicit `auth.activeOrganizationId`; the previous single-membership fallback was removed.
- Platform-admin authorization now runs through `platformQuery` / `withPlatformTransaction`, rather than a direct pool query, so platform authority evaluation is transaction-context bound.
- Commits: server `2059399aea4a68d5117c94469f91a6c7e4d7d732`; platform admin `88aa2eb400f872b0e384f67f3697cf281419882f`.
- CI/runtime validation remains **NOT VERIFIED**. Production Neon/RLS/deployment remains **HOLD**; no production changes made.


### 2026-11-07 — Field-sync tenant-isolation completion batch
- Extended explicit active-organization tenant context across the remaining field-device/sync surfaces in `apps/src/sync-routes.ts`.
- Field-device inventory now requires an explicit active organization and executes through `withTenantTransaction`.
- Field-sync envelope intake now requires active organization, resolves the verified device through the tenant-bound client, and performs idempotency, sequence-conflict, cursor, envelope and last-seen mutations in the same tenant transaction.
- Field-sync envelope application now resolves the envelope through its bound field-device organization and requires that organization to equal the active tenant before applying the operation.
- Field-sync conflict inventory and conflict resolution now execute through `withTenantTransaction` and constrain access to the active organization.
- Removed route-level manual `pool.connect()/BEGIN/COMMIT/ROLLBACK` from these sync flows.
- Commit: `6b182383ad46cc459068d350f1f2ee49e5ac8bb2`.
- Exact-head GitHub Actions lookup for this commit returned no workflow runs; CI remains **NOT VERIFIED**.
- Production Neon/RLS/deployment remains **HOLD**; no production changes made.
- Next autonomous action: reconcile the remaining `workspace-routes.ts` tenant-sensitive reads/verification mutation against the transaction-local tenant context, then continue the 67-table policy-matrix reconciliation.


### 2026-11-07 — Workspace tenant-context hardening batch
- Hardened `apps/src/workspace-routes.ts` against tenant-context bypasses.
- Workspace pre-handler now requires an explicit active organization and evaluates workspace permissions inside `withTenantTransaction`.
- Geography authorization now runs through tenant-bound transaction context.
- Resource-flow, MRV, compliance, carbon, registry, settlement and ESG workspace reads now use tenant-bound query transactions instead of direct pool queries.
- Evidence verification mutation now uses one `withTenantTransaction` covering evidence lookup, organization scope check, verifier authorization, verification insert and evidence status mutation.
- Removed route-level `pool.connect()` transaction handling from evidence verification.
- Static inspection: `pool.query` in workspace route file = 0; `pool.connect` = 0; tenant-query wrappers = 14; tenant-context guards = 9.
- Commit: `0163e686e04c1580ee420ef1dcbc4ebed88d4d76`.
- Exact-head GitHub Actions lookup returned no workflow runs; CI remains **NOT VERIFIED**.
- Production Neon/RLS/deployment remains **HOLD**; no production changes made.
- Next autonomous action: continue residual access-surface reconciliation and map remaining application queries against the authoritative 67-table tenant/policy matrix.


### 2026-11-07 — Workspace active-tenant query reconciliation
- Corrected residual multi-membership query scope in `apps/src/workspace-routes.ts`.
- Although routes required an active organization, several queries still constructed `ids` from all verified memberships. Those queries now use only `[auth.activeOrganizationId]`.
- Static inspection after commit: `pool.query=0`, `pool.connect=0`, `orgIds(auth)=0`, active-tenant arrays=8.
- Commit: `71b9102b5223b5386921268e71488b1e060e0f3a`.
- This closes the identified workspace multi-membership fallback/query-scope residual; CI remains **NOT VERIFIED** until an exact-head workflow run is observed.
- Production remains unchanged and all production RLS/migration/deployment gates remain HOLD.


### 2026-11-07 — Batch E authorization/audit/multi-party contract
- Advanced Issue #326 Batch E on the controlled PR #332 branch.
- Added `docs/engineering/SHAKTI_BATCH_E_POLICY_CONTRACT_20261107.md` defining operation-specific boundaries for the remaining 3 authorization, 2 audit and 9 multi-party surfaces.
- Added `scripts/test-shakti-batch-e-policy-contract.sql` as a disposable PostgreSQL schema/contract gate. It asserts the 14 surfaces and required authorization columns, rejects unsafe blanket organization policies on multi-party surfaces, and rejects role/session-name authorization on audit controls.
- Commits: `aefdf1d3cedaf073381b45da6035c5b1e8fa1a6a`, `5538ca469fb014f9a3c41b40cf8cf6ef6e611429`.
- This is contract/schema validation only; it does not implement or enable production RLS.
- Next execution: wire the Batch E disposable contract gate into CI, then build executable positive/negative authorization and multi-party tests against the actual domain rows and route/worker access map.
- CI exact-head evidence remains NOT VERIFIED.
- Production remains READ-ONLY/HOLD; no production DDL/DML/RLS/role/grant/deployment/worker/certification action.


### 2026-11-07 — Batch E CI contract wiring
- Wired `scripts/test-shakti-batch-e-policy-contract.sql` into `.github/workflows/ci.yml` immediately after disposable migrations.
- The gate runs against the disposable PostgreSQL service only and does not touch production Neon.
- Commit: `e64f2c54d8bfb144ce80bb28eed8340adfa5d3ad`.
- Exact-head CI evidence is still pending/not verified.
- Next: use the disposable CI database to execute the deeper Batch E behavioral authorization tests, including positive/negative multi-party participant boundaries and append-only audit controls.


### 2026-11-07 — Due-diligence finding: date-stamped migration version collision
- Deliberate review of PR #332 exposed a real CI/migration correctness defect: all four protected Shakti migrations use the filename prefix `20261107`, while the migration validator and runner previously treated the numeric prefix before the first underscore as the migration version.
- That would classify all four files as the same migration version and cause duplicate-version validation / schema_migrations conflicts.
- Corrected both `scripts/validate-migrations.mjs` and `apps/src/migrate.ts` to use the complete filename without `.sql` as the migration version identity. Existing legacy numeric versions remain stable; date-stamped migrations become uniquely identifiable.
- Commits: `7258d0e25cf01b6e79fb76bc30566fcdbc9c9887`, `8136c0e10b07db3500ed4ba5e0e39f48670a3427`.
- This is a high-value due-diligence correction and must be validated by disposable CI before being considered complete.
- Exact-head CI remains NOT VERIFIED.


### 2026-11-07 — Due-diligence correction: preserve legacy migration identities
- Follow-up review found the first migration-version correction was too broad: using the full filename for every migration would make the runner fail to recognize previously recorded legacy numeric versions and could cause historical migrations to be replayed.
- Corrected the design: legacy migration prefixes retain their existing numeric version identity; only duplicate numeric prefixes are disambiguated by full filename.
- Updated both `scripts/validate-migrations.mjs` and `apps/src/migrate.ts` to precompute prefix counts and apply this rule consistently.
- Latest corrective commit: `235ef048ce7126dd1e44150831b9e157f406f82f`.
- This correction is NOT considered validated until disposable CI executes migration validation and the full migration runner successfully.


### 2026-11-07 — Due-diligence batch: migration compatibility invariant
- Rechecked the corrected migration-version algorithm against the legacy compatibility requirement.
- The intended invariant is now explicit: unique legacy numeric prefixes preserve their historical numeric `schema_migrations.version`; only duplicate prefixes are promoted to filename-based version identity.
- Added explicit version bookkeeping in `scripts/validate-migrations.mjs` for the validator's uniqueness inventory.
- Latest code checkpoint: `87732b402fdd99dc3d044a5e972abdac2e015e4b`.
- Disposable CI execution is still unavailable for this exact head; no validation claim is made.


### 2026-11-07 — Batch E CI contract gap closed
- Rechecked PR #332 CI against its referenced Batch E contract.
- The workflow referenced `scripts/test-shakti-batch-e-policy-contract.sql`, but that file was absent on the controlled branch and absent on `main`; this would have caused CI to fail immediately if the workflow executed.
- Added the missing disposable structural contract at commit `420f7e1851ef8c720e6876942c5d5d05338e9ded`.
- Contract checks required Batch E surfaces, authoritative membership/audit provenance columns, rejects blanket organization-only policies on multi-party surfaces, rejects UPDATE/DELETE privilege on append-only audit surfaces, and verifies the disposable runtime role is non-superuser/non-BYPASSRLS.
- This is a structural disposable-DB gate, not production certification.
- Exact-head CI still requires verification.


### 2026-11-07 — CI trigger diagnosis
- Main CI currently supports push-to-main and pull_request-to-main only; the controlled branch had no manual dispatch trigger.
- Added `workflow_dispatch` to the controlled CI workflow so the validation pipeline can be deliberately invoked without merging the controlled security work into main.
- Commit: `19535ef952bd4c7606f5783583086ef8b227880a`.
- This does not itself prove execution; GitHub Actions run evidence remains required.


### 2026-11-07 — Batch E contract due-diligence correction
- Re-inspected the newly restored Batch E SQL contract before execution.
- Found an escaping defect in the PostgreSQL regex used to detect blanket organization-only policies: the pattern had double backslashes and therefore did not express the intended whitespace matcher.
- Corrected the regex to the intended PostgreSQL pattern and committed `8b76770df8cfa8553052418c7b84b57928cc9f3f`.
- This is a test-contract correctness fix; it does not alter production.


### 2026-11-07 — Exact-head CI trigger revalidation
- Re-inspected `.github/workflows/ci.yml` at the live controlled branch head.
- The previously expected `workflow_dispatch` trigger was absent from the exact file despite earlier checkpoint notes.
- Restored the manual `workflow_dispatch` trigger and committed `f03bce40ed66d0cc011b4507750c0cb6f01ced98`.
- Revalidated PR #332 changed files: `scripts/test-shakti-batch-e-policy-contract.sql` is present in the PR.
- CI execution remains unverified until an actual workflow run exists for the exact head.


### 2026-11-07 — Integration test privilege-boundary correction
- Re-audited the disposable CI test path against the actual CI environment variables.
- Found a concrete defect: `tenant-isolation.integration.test.ts` was using `DATABASE_URL` for fixture creation while CI intentionally points `DATABASE_URL` at the non-BYPASSRLS runtime role. Fixture operations require owner privileges.
- Corrected the test to use `RUPAYKG_TEST_OWNER_DATABASE_URL` for fixture setup/cleanup and `DATABASE_URL` only for runtime/context assertions.
- Corrected all four test cases consistently; no production database was touched.
- Fix commits: `0f35da7fab7b9a41ca1f9ab9b262d22017859369`, `dc77a9b2331723f0b715fdea90aaff2bcbd08427`.


### 2026-11-07 — Batch E regex re-audit
- Re-audited the policy-contract SQL at the controlled head.
- Found a remaining escaping mismatch in the `with_check` branch of the multi-party blanket-policy detector.
- Corrected it so both `qual` and `with_check` use the same intended PostgreSQL regex semantics.
- Commit: `8a7c5289226e66d68cc1dc26dea744501b9707a8`.


### 2026-11-07 — Batch E regex final correction + exact-head recheck
- Re-audited `scripts/test-shakti-batch-e-policy-contract.sql` after the prior escaping correction.
- Found the `with_check` branch still used a different escaping level from the `qual` branch, which could make the detector fail to match the intended PostgreSQL whitespace regex.
- Corrected the `with_check` expression to use the same regex semantics as `qual`.
- Commit: `a636a26e81cdaac88c69247e333b88c64a7ececa`.
- Exact-head workflow lookup for this commit returned no workflow runs. CI execution remains **NOT VERIFIED**.
- Migration order review: the four 20261107 migrations sort as authority context → core RLS gate → platform context → runtime grant reconciliation. The runtime grants therefore follow the protected context-function definitions; the core gate still remains a deployment gate and is not executed in production.
- Production Neon/RLS/deployment remains **HOLD**; no production changes made.
- Current controlled PR #332 head: `a636a26e81cdaac88c69247e333b88c64a7ececa`.
