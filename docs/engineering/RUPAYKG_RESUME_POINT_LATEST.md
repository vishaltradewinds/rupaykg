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


### 2026-11-07 — Registry/statutory tenant-boundary hardening batch
- Hardened registry credential and settlement routes to require explicit active-organization context and execute tenant-sensitive reads/writes inside `withTenantTransaction`; removed the raw registry transaction helper from these routes.
- Credential issuance now binds the active organization to the issuer and performs high-risk authorization inside the tenant transaction.
- Credential activation/transfer/retirement and settlement lifecycle routes now fail closed without an active organization and bind execution to the authoritative owner/payer organization.
- Settlement creation now performs payer/payee authorization checks through tenant-scoped transactions rather than an unscoped pool authorization query.
- Removed the intelligence workspace's implicit single-membership tenant fallback.
- Workspace geography authorization now fails closed when active organization context is absent.
- Statutory EPR applicability no longer falls back to the first membership and no longer performs unscoped EPR scheme/permission queries.
- MRV status authorization now uses a tenant transaction rather than direct pool authorization.
- Static residual audit of the hardened route set: no raw `pool.connect` in the reviewed route files; no remaining first-membership fallback in the reviewed surfaces. Remaining `pool.query` occurrences are limited to server health/catalog helpers and MRV helper functions that are passed a transaction client at tenant-sensitive call sites; these require final context review before closure.
- Commits: `fc91c539221eea3ded1bf40fdedc62c7eee20eb4`, `3a0fa03eb6044e42212002eb90e8a8ea08129b7b`, `00dd73ba7ae0f02d40df762e6628941c1f4ae8fa`, `c4cf596bffe8b442a6970725044da420dd8f68c4`, `84238de51e0292f0afacb58f59feb639dd9de2a9`, `47f53eba91f2ad1e91fb16cb993f928b6ecacf27`.
- Exact-head GitHub Actions lookup for current head `47f53eba91f2ad1e91fb16cb993f928b6ecacf27` returns no workflow runs. CI/runtime validation therefore remains **NOT VERIFIED**.
- Production Neon/RLS/deployment remains **HOLD**; no production changes made.


### 2026-11-07 — Registry fail-closed residual closure
- Re-audited registry transfer and settlement authorization entry points after the previous tenant-context batch.
- Added explicit active-organization requirements to credential transfer and settlement authorization routes; previously these routes relied on the transaction helper to fail later with an internal context error.
- Current controlled head: `2369af42288fc294c28e25a3045c339ad59e270f`.
- Exact-head GitHub Actions lookup returns no workflow runs; CI/runtime validation remains **NOT VERIFIED**.
- Production Neon/RLS/deployment remains **HOLD**; no production changes made.


### 2026-11-07 — Controlled validation continuation: CI reproducibility + registry syntax + static residual check
- Fixed a concrete registry route syntax defect introduced during tenant-transaction hardening: a literal escaped newline sequence in the credential issuance callback. Commit: `ccbbfad5271bf5356ffb0f119efa714ebbb60488`.
- Re-audited the hardened route set at the controlled head: zero direct `pool.query`/`pool.connect` calls in BWG, CPCB SWM, EPR returns, Evidence Vault, Intelligence, MRV, Statutory, Sync, Value, Workspace and Registry route files. The remaining server `pool.query` is a global health/catalog helper, not a tenant-route transaction; MRV/Value helper calls require transaction-client context at sensitive call sites.
- Removed an unused `orgIds` helper from Workspace routes; it no longer had callers after tenant fallback removal.
- Changed CI dependency installation from `npm install` to lockfile-reproducible `npm ci`.
- Latest controlled head: `35ec1f46bc11453cf2b11c09df23bcf6e14a2663`.
- Exact-head GitHub Actions lookup: no workflow run. CI/runtime execution remains **NOT VERIFIED**.
- Production Neon remains **READ-ONLY/HOLD**. No production DDL/DML/RLS/role/grant/deployment/certification action performed.
- Next required gate: obtain disposable CI execution evidence, then close remaining auth/onboarding boundary classification and actual multi-party behavioral acceptance before any production cutover proposal.


### 2026-11-08 — Active-tenant authority residual closure batch
- Re-audited the controlled route set for request-body/header organization authority after the registry/EPR hardening batches.
- Found two concrete residuals:
  - `apps/src/statutory-routes.ts` EPR mutation still accepted `body.organizationId` as a candidate tenant before equality-checking against the active organization.
  - `apps/src/sync-routes.ts` field-sync activity/resource-flow mutations derived tenant organization directly from the sync payload, even though the authenticated field-sync transaction already carried an authoritative active organization.
- Corrected statutory tenant selection to derive only from `auth.activeOrganizationId`; the shared statutory organization helper now also derives only from active auth context.
- Corrected field-sync activity/resource-flow mutations to derive organization from `auth.activeOrganizationId`; payload `organizationId` is now only a consistency assertion and a mismatched payload fails closed.
- Added `scripts/test-shakti-active-tenant-authority-contract.mjs` and wired it into `.github/workflows/ci.yml`.
- This closes a concrete request-body tenant-authority residual without changing production Neon.
- Latest controlled head after this batch: `3c546ed144e2cdda74cd9d49286ee709586894d0`.
- Exact-head GitHub Actions execution remains **NOT VERIFIED**; no workflow run exists for the controlled branch head.
- Production Neon/RLS/deployment remains **READ-ONLY/HOLD**.
- Next: continue route-wide residual authority review, then deepen disposable runtime behavioral coverage for all five protected core RLS tables before any production activation proposal.


### 2026-11-08 — Protected-core RLS runtime coverage deepening
- Expanded `apps/src/tenant-isolation.integration.test.ts` with executable disposable-runtime RLS tests for `evidence` and `carbon_calculations`, including tenant-scoped visibility and cross-tenant insert rejection.
- Carbon calculation coverage uses an authoritative `methodology_versions` fixture and follows the same parent-activity tenant boundary used by production policy.
- Strengthened `scripts/test-shakti-rls-write-contract.mjs` so the CI contract explicitly requires the new evidence/carbon runtime tests and EPR obligation mutation coverage.
- Runtime RLS coverage now has concrete behavioral tests for activities, measurements, evidence, and carbon calculations; EPR obligation mutation remains represented by the production-path contract and grant/policy checks pending a disposable fixture that can create the obligation dependency graph without privileged shortcuts.
- Production Neon remains READ-ONLY/HOLD. No production migration or RLS activation was performed.
- Exact-head GitHub Actions execution remains NOT VERIFIED because the controlled branch has not produced a workflow run.


### 2026-11-08 — EPR obligation RLS behavioral coverage deepening
- Added a same-tenant `epr_obligations` INSERT assertion to `apps/src/tenant-isolation.integration.test.ts`.
- The test now proves the protected runtime role can perform an authorized same-tenant EPR-obligation insert while retaining cross-tenant read/insert/update rejection coverage.
- Commit: `dd9b62f37669575024b2b2860106cf693b98b95d`.
- This remains disposable CI validation only; no production Neon mutation or RLS activation was performed.
- Exact-head workflow evidence for the new commit is currently not visible; CI remains NOT VERIFIED.
- Production Neon/RLS/deployment remains READ-ONLY/HOLD.
- Next autonomous action: continue the protected-core/multi-party behavioral acceptance matrix and resolve any CI failures once an exact-head workflow execution becomes available.


### 2026-11-08 — Parallel software + hardware stack baseline
- Began parallel hardware/software engineering rather than treating hardware as a later phase.
- Added `docs/hardware/RUPAYKG_FIELD_EDGE_STACK.md` defining the controlled field-edge architecture, minimum hardware layers, canonical measurement envelope, security baseline, hardware acceptance sequence, and explicit readiness boundaries.
- Added `scripts/test-shakti-field-hardware-stack-contract.mjs` to assert that the software field-device boundary and hardware baseline remain present together.
- Wired the contract into `.github/workflows/ci.yml`.
- Hardware baseline explicitly avoids unsupported claims: exact SKU approval, calibration, EMC/environmental qualification, Indian-manufacturing status, field acceptance and TRL 9 require separate evidence.
- Software boundary remains tied to the existing field-device enrollment/sync path: active-organization authority, verified identity, tenant transaction, device uniqueness and audit event.
- Latest software/hardware baseline CI commit: `6caf31493fd9ea70ef4a70b6e2e96b8decbbc0e9`.
- Exact-head GitHub Actions execution remains NOT VERIFIED until a workflow run is observed for the controlled head.
- Production Neon/RLS/deployment remains READ-ONLY/HOLD; no production hardware or software deployment was performed.
- Next autonomous action: deepen the hardware-to-measurement software contract (device identity, calibration reference, sequence/replay, raw evidence linkage) while continuing protected-core and multi-party runtime acceptance.


### 2026-11-08 — Open-source ecosystem + Shakti Standards control layer
- Added `docs/standards/SHAKTI_OPEN_SOURCE_ECOSYSTEM_CONTROL.md` as a mandatory lifecycle control for open-source software, open standards, open data, open AI, open hardware and reference ecosystems.
- The control explicitly incorporates DPGA/DPG Standard, UNIN, FAIR Forward/BMZ, Global DPI Repository, relevant Indian DPI/open-source ecosystems and SHAKTI/RISC-V as reference inputs; these do not override Indian statutory/regulatory requirements and do not make RupayKg a DPG/DPI.
- Added component provenance, license, security, interoperability, responsible-AI, hardware and evidence-lineage gates.
- Added `scripts/test-shakti-open-source-ecosystem-contract.mjs` and wired it into CI.
- Latest controlled CI-head commit: `4c5e7d6b6031915e788afd60e0e79136c2e43ede`.
- Exact-head GitHub Actions execution remains NOT VERIFIED until a workflow run is observed.
- Production remains READ-ONLY/HOLD.


### 2026-11-08 — Authoritative architecture + multi-party settlement acceptance
- Established `docs/standards/RUPAYKG_AUTHORITATIVE_STANDARDS.md` as the single authoritative standards/governance index and `docs/architecture/RUPAYKG_FULL_STACK_ARCHITECTURE.md` as the controlling full-stack technical baseline.
- Architecture now explicitly governs execution across field/edge, connectivity, API, domain, PostgreSQL authority, security/RLS, evidence, MRV, regulatory controls, verification, external trust/registry boundaries, value/settlement, AI, UI, CI/CD and continuous assurance.
- Updated the full-stack architecture with an explicit no-drift rule and definition-of-done: architecture mapping → implementation → security → deterministic tests → integration evidence → field/operational evidence where applicable → lifecycle-state update → production gate.
- Added disposable runtime behavioral coverage in `apps/src/registry-settlement-runtime.test.ts` for a payee-only identity attempting settlement authorization, execution and confirmation while the settlement payer remains the authoritative active tenant. Each counterpart attempt must fail closed with `ORG_CONTEXT_MISMATCH`.
- This strengthens the four settlement mutation paths: create, authorize, execute and confirm, without granting the payee-only actor payer authority.
- Settlement work remains test-only/disposable. No production Neon mutation, RLS activation, deployment or certification was performed.
- Latest controlled head: `fc09f0572bd5070d3f822269c268dae73ebba95e`.
- Exact-head GitHub Actions execution is **NOT VERIFIED** until a workflow run is observed for this controlled head.
- Production Neon/RLS/deployment remains **READ-ONLY/HOLD**.
- Next autonomous action: continue the multi-party protected-core acceptance matrix and close any remaining cross-tenant authority gaps, then obtain exact-head CI evidence before proposing any production cutover action.


### 2026-11-08 — Settlement counterpart fixture correction
- Corrected the disposable settlement runtime acceptance fixture so the payee-only identity/token used by the multi-party authority tests are explicitly declared and available to the test lifecycle.
- No production database, RLS activation, deployment or certification action performed.
- Latest controlled head: `cb52897b97ec55e80016c2159a7acfe10c2f6d8c`.
- Exact-head GitHub Actions lookup returned no workflow runs; CI remains **NOT VERIFIED**.
- Production Neon/RLS/deployment remains **READ-ONLY/HOLD**.
- Next autonomous action: continue the multi-party/protected-core acceptance matrix and use exact-head CI evidence as the execution gate before any production cutover proposal.


### 2026-11-08 — Settlement payer-spoofing acceptance
- Added disposable runtime coverage proving an authenticated payer-side actor cannot create a settlement by changing the request `payerId` to the counterpart organization while retaining the original active tenant context.
- Expected failure is fail-closed `ORG_CONTEXT_MISMATCH`; the request must not reach settlement creation.
- Corrected the settlement runtime fixture declarations before extending the behavioral matrix.
- Latest controlled head: `700f5400fcf869e06557f05421bafe53a1fc3760`.
- Exact-head GitHub Actions execution remains **NOT VERIFIED**.
- Production Neon/RLS/deployment remains **READ-ONLY/HOLD**.
- Next autonomous action: continue multi-party settlement and protected-core behavioral acceptance, including cross-tenant read/write denial and lifecycle transition invariants, then obtain exact-head CI evidence.


### 2026-11-08 — Settlement runtime test integrity correction
- Corrected escaped newline literals introduced in the settlement runtime acceptance test so the TypeScript source is syntactically normal text rather than containing literal `\\n` sequences.
- Preserved payer-spoofing and counterpart-side authorization/execution/confirmation denial coverage.
- Latest controlled head: `bbf51840e0a1823578369394e609be51e2fcefaa`.
- Exact-head CI remains **NOT VERIFIED** until a GitHub Actions run is observed for this head.
- Production Neon/RLS/deployment remains **READ-ONLY/HOLD**.
- Next action: continue protected-core/multi-party behavioral acceptance and verify the resulting exact-head CI evidence before any production-state change.


### 2026-11-08 — Settlement tenant-boundary RLS hardening
- Added protected migration `091_settlement_tenant_rls.sql`.
- Settlement rows: bilateral SELECT for payer/payee; INSERT/UPDATE restricted to payer tenant.
- Settlement events: bilateral SELECT; INSERT restricted to payer tenant; no runtime UPDATE/DELETE grants.
- Added deterministic settlement tenant-RLS contract and wired it into CI.
- Added disposable PostgreSQL behavioral acceptance covering bilateral settlement visibility, payer-only mutation, cross-tenant event rejection, and append-only event protection.
- Protected migration gate and CI RLS assertions now include `settlements` and `settlement_events`.
- Latest code head: `37109b07d45c2f421c5bfe5b8ff6e66e3ac42d8c`.
- CI exact-head verification: pending; production remains READ-ONLY/HOLD.


### 2026-11-08 — Settlement RLS behavioral fixture correction
- Corrected the disposable settlement-event hash fixtures so the test supplies the intended suffix parameter rather than a literal placeholder.
- Settlement tenant RLS migration, deterministic contract, CI wiring, and behavioral coverage remain intact.
- Latest code head: `18cf22feb66cea2e1dd2a9b0b50d22d59ef84b7c`.
- Exact-head CI: **NOT VERIFIED**; GitHub reports no workflow run for the checkpoint yet.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Settlement runtime privilege hardening
- Strengthened settlement tenant-RLS migration with explicit runtime-role revocation of destructive privileges:
  - `settlements`: DELETE revoked.
  - `settlement_events`: UPDATE and DELETE revoked.
- Strengthened the deterministic Shakti contract to require those explicit revocations.
- This closes the gap where absence of a GRANT alone would not prove that inherited/default privileges were removed.
- Latest code head: `81826e42e86922704f9d35d2182c6dbda762e7ca`.
- Exact-head CI remains **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Settlement destructive-write acceptance
- Fixed the settlement tenant-RLS deterministic contract syntax after the privilege-hardening update.
- Extended disposable RLS behavioral acceptance to prove runtime denial of:
  - settlement event UPDATE/DELETE;
  - settlement DELETE.
- This now tests the intended bilateral-read / payer-mutation / append-only boundary at runtime, not only by static migration inspection.
- Latest checkpoint commit: `b4eaf1d2e72411da259f5da3102bbae4775eacdd`.
- Exact-head CI: **NOT VERIFIED** until a workflow run for this exact SHA is observed.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Bilateral settlement RLS acceptance completed
- Extended disposable protected-core acceptance with a separately verified payee identity/membership.
- The payee tenant now proves:
  - legitimate read access to the bilateral settlement;
  - no mutation authority over the payer-owned settlement;
  - legitimate read access to the associated settlement event.
- This closes the remaining gap between static bilateral policy definition and behavioral proof for the payee side.
- Latest checkpoint commit: `097ad63f27b0509ba19fb8874fd56f3689789aa7`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Database settlement lifecycle integrity
- Added protected migration `092_settlement_lifecycle_transition_integrity.sql`.
- Settlement status transitions are now guarded at the database boundary:
  `CREATED → AUTHORIZED → EXECUTING → RECONCILING → SETTLED`, with controlled cancellation from non-final states.
- Added deterministic Shakti lifecycle contract coverage.
- Added disposable runtime acceptance proving a direct invalid `CREATED → SETTLED` mutation is rejected.
- Added migration protection and CI protected-migration gate coverage for migration 092.
- Latest checkpoint commit: `6ce9c1f25241cc3f0422b29b77817b215d164a0d`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Registry provenance tenant boundary
- Added protected migration `093_registry_event_tenant_rls.sql`.
- `registry_events` now has tenant-scoped historical SELECT: an organization can read events in which it is the recorded source or destination owner.
- Runtime INSERT is restricted to an organization represented in the event; runtime UPDATE/DELETE are explicitly revoked, preserving append-only provenance.
- Added deterministic Shakti registry-event RLS contract and CI protected-migration gate.
- Latest checkpoint commit: `a3821f7499dee2f56b2a1d10b266d0c6dcad3d8c`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Registry provenance identity authority
- Added protected migration `094_registry_event_identity_write_authority.sql`.
- Registry-event INSERT now requires `recorded_by_identity_id = app.current_identity_id()` in addition to tenant ownership scope.
- This closes the remaining gap where tenant RLS could authorize a forged provenance actor within an otherwise valid organization context.
- Added deterministic Shakti identity-authority contract and CI protected-migration gate.
- Latest checkpoint commit: `90a5d3e25fb2eab03efb71a145b258238d04a03a`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Credential tenant boundary
- Added protected migration `095_credentials_tenant_rls.sql`.
- Credential reads are now scoped to the issuer/current authoritative registry owner; issuance is scoped to the active issuer organization; updates require current authoritative owner context.
- Runtime credential DELETE is explicitly revoked.
- Added deterministic Shakti credential RLS contract and CI protected-migration gate.
- Latest checkpoint commit: `719f5908d1f9476d9566b8b7711095a433ed7cf6`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Credential + registry provenance behavioral acceptance
- Extended `apps/src/tenant-isolation.integration.test.ts` with credential RLS acceptance:
  - current owner can read/update
  - unrelated organization cannot read
  - runtime DELETE is denied
  - registry event with mismatched recorded identity is denied
  - cross-tenant registry event write is denied
- This provides behavioral proof for protected migrations 094 and 095 in addition to their deterministic contracts.
- Latest checkpoint commit: `cc1431f9670e80f58f2b08446c0fe8d5dfc3bd1c`.
- Exact-head CI: **NOT VERIFIED** until a workflow run is attached to this exact commit.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Credential authority-field hardening
- Added protected migration `096_credential_authority_field_immutability.sql`.
- Value-bearing credentials can no longer rewrite activity, issuer, trust root, verification, quantity, unit, credential URI, or issued-at fields through the runtime UPDATE path.
- Lifecycle status changes remain available to the governed lifecycle routes.
- Added deterministic contract, protected migration classification, CI gate, and behavioral acceptance.
- Latest checkpoint commit: `a78fb438557143f0fce15b47f2a1056650737136`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Field-sync tenant/identity boundary
- Added protected migration `097_field_sync_tenant_rls.sql`.
- Field-sync envelopes are scoped to authenticated identity + verified field device + active organization.
- Field-sync conflicts inherit the same identity/organization boundary.
- Field-sync cursors are scoped to the authenticated device identity/organization.
- Runtime DELETE is revoked for envelopes, conflicts and cursors.
- Added deterministic contract, protected migration CI gate, and behavioral acceptance.
- Latest checkpoint commit: `4df80ded52f8b95492a9e04be8409586eafb3711`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Credential ↔ registry lifecycle atomicity
- Added protected migration `098_credential_registry_event_atomicity.sql`.
- Value-bearing credential states now require the corresponding registry provenance event at transaction commit:
  - ISSUED → ISSUED
  - ACTIVE → ACTIVATED
  - TRANSFERRED → TRANSFERRED
  - RETIRED → RETIRED
- Implemented as a deferred database constraint trigger so existing route ordering (state mutation followed by event append) remains valid while a missing event cannot commit.
- Added deterministic contract and behavioral acceptance proving mutation-without-event rolls back and state+event commits.
- Latest checkpoint commit: `3d21f5c20a67c1a98e46a09d0c030442bc0025a7`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Controlled verifier registry read boundary
- Added protected migration `099_registry_event_assigned_verifier_read.sql`.
- An approved verifier recorded on a credential's verification can read the credential's complete registry lifecycle.
- Ownership-based bilateral registry access remains unchanged.
- No verifier write authority is granted.
- Added deterministic Shakti contract and protected CI gate.
- This closes the previously identified verifier/auditor access-model gap without granting broad registry visibility.
- Latest checkpoint commit: `79db7ffd4201f4d68d1b7198babc5f6ebc52e2e9`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Verifier registry RLS recursion hardening
- Hardened migration `099_registry_event_assigned_verifier_read.sql`.
- The assigned-verifier lookup now uses a narrowly scoped SECURITY DEFINER boolean helper because the registry-event policy may evaluate a credential that the verifier does not own; direct credential RLS evaluation would otherwise make the intended verifier policy ineffective.
- Public execution is revoked; only the protected runtime role can execute the helper.
- Updated the deterministic contract accordingly.
- Latest checkpoint commit: `1d7d0d78d4857d411bb4def23f54b196fd5f0bc5`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Active verifier authority hardening
- Hardened migration `099_registry_event_assigned_verifier_read.sql` again.
- Assigned-verifier registry read access now requires all of:
  - current identity matches `verifier_identity_id`
  - verification decision is `APPROVED`
  - verifier identity is currently `VERIFIED`
  - current identity still has the authoritative verification permission
- This prevents a previously approved verifier from retaining registry read access after identity suspension or verifier authorization removal.
- Deterministic contract updated.
- Latest checkpoint commit: `e3975ecb2209c7a8c1be575d450c4647b018d780`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Credential runtime least-privilege hardening
- Added protected migration `100_credential_runtime_update_column_scope.sql`.
- Runtime role no longer has generic UPDATE on `credentials`; it can update only lifecycle `status`.
- This matches the actual application mutation surface: ACTIVE, TRANSFERRED, and RETIRED lifecycle changes.
- Authority/value fields remain protected by the existing immutability trigger and are now additionally blocked at the database privilege layer.
- Updated protected migration classification and deterministic contract.
- Latest checkpoint commit: `6ee4c6f506d2fecef339b134d7cd395421e469d0`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Credential/registry atomicity strengthened
- Hardened migration `098_credential_registry_event_atomicity.sql`.
- The deferred lifecycle gate now requires the matching provenance event to be the **latest registry lifecycle event** for the credential at commit.
- This closes the prior weakness where an older matching event could satisfy a later credential status mutation without a new corresponding registry event.
- Updated deterministic contract.
- Latest checkpoint commit: `26d4e748be0a7806a9787fde6b4807c430b39e0d`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Verifier registry read boundary hardened
- Tightened the deterministic verifier-access contract for migration `099_registry_event_assigned_verifier_read.sql`.
- The assigned-verifier policy is explicitly required to be **SELECT-only**; the contract also preserves the existing no-write-authority boundary.
- Current authority requirements remain: assigned identity, APPROVED verification, VERIFIED identity, and active verification permission.
- Latest checkpoint commit: `b78442dc50b395e1be3b4987f3ce0d8329cc92d6`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Assigned-verifier behavioral acceptance added
- Added DB integration coverage for migration `099_registry_event_assigned_verifier_read.sql`.
- Acceptance now proves an assigned APPROVED verifier can read the credential's registry provenance.
- The same test proves verifier write attempts are denied, suspended verifier context is rejected, and an unrelated verified verifier cannot read the event.
- Latest checkpoint commit: `5c147a3242bd9d2c247bd9659184c941717cb14a`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Credential runtime privilege contract tightened
- Extended the credential authority immutability deterministic contract to assert the complete intended runtime privilege baseline alongside the column-scoped UPDATE grant.
- This prevents the least-privilege migration from being validated only for the revoke/grant delta while silently losing required SELECT/INSERT/UPDATE runtime access.
- Latest checkpoint commit: `cc5bf45280623678cd29589e40f467b3cb1dea56`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Credential privilege scope reconciled with live mutation surface
- Verified the authoritative `apps/src/registry-routes.ts` mutation surface: credential runtime updates are limited to lifecycle `status` transitions ACTIVE, TRANSFERRED, and RETIRED.
- Extended the deterministic contract to bind migration `100` least-privilege scope to those actual runtime mutations.
- No generic authority/value-field UPDATE path was found in the inspected credential route surface.
- Latest checkpoint commit: `d1f35d90e4d1a69d68dc0443b34429e6c98de026`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Credential runtime delete boundary made explicit
- Strengthened migration `100_credential_runtime_update_column_scope.sql` with an explicit runtime `DELETE` revoke.
- Updated the deterministic credential privilege contract to require that delete denial.
- This makes the credential lifecycle boundary explicit at the DB privilege layer: runtime may mutate lifecycle status only and cannot delete credential authority records.
- Latest checkpoint commit: `2308eec889568de5c74ee91167a85a9fe89f05c3`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.


### 2026-11-08 — Credential privilege contract bound to migration 100
- Tightened the deterministic credential authority contract so it directly inspects migration 100 for the runtime privilege controls.
- The contract now independently verifies the migration contains status-only UPDATE scope and explicit DELETE denial, rather than relying only on route/migration text from separate files.
- Runtime mutation surface remains verified against the three actual credential lifecycle status updates in `apps/src/registry-routes.ts`.
- Latest engineering checkpoint commit: `083946d41e4bbe38586f11ba36656b029642aecd`.
- Exact-head CI: **NOT VERIFIED**.
- Production remains **READ-ONLY/HOLD**.
