# RUPAYKG RESUME POINT — 2026-11-05

## Controlled integration spine
Authoritative repository: vishaltradewinds/rupaykg.
Current main: 5bdb3875f947aa53adad1768ab13657749d71a3f.
Production remains READ-ONLY / HOLD.

## Current critical path
1. P0 web startup isolation: remove implicit production migrations/fixtures from long-lived web startup.
2. Protected migrator remains separate and unmerged (#291).
3. Migration lineage is fail-closed in the protected migrator: every applied ledger version must map to an active source migration with the expected filename. Authoritative production lineage still requires read-only verification.
4. Tenant isolation/RLS and runtime DB identity remain release gates.
5. Recovery/restore evidence must be disposable and bounded; never use production for rehearsal.

## Latest engineering batch — VERIFIED
Branch: shakti/2026-11-05-bounded-recovery-rehearsal.
PR #303.
Verified branch head: 27ab49e775775f6bebc39d5a51466ed67a5c06f0.
CI #5628 / run 42067352947: SUCCESS.
All validation job steps 1–15 completed successfully, including migration validation, API migration execution in CI, typecheck/build, browser smoke test, disposable PostgreSQL acceptance tests, production container build, bounded disposable pg_dump/pg_restore rehearsal, and explicit startup-isolation assertion.

This validates the branch-level engineering gate in CI. It does not validate production deployment, production database state, field acceptance, statutory/regulatory approval, certification, or TRL 9.

## Current reconciliation batch — VERIFIED
Branch: shakti/2026-11-05-protected-migrator-startup-reconciliation.
PR #304 is OPEN / DRAFT / UNMERGED / validation-only.
CI #5634 / run 42073823692: SUCCESS on validated code head a96cc533aea3be23bf5a302c398c4a19d5f3deae.

CI evidence on that validated code head completed successfully through the full validation path:
- migration validation
- migration manifest generation and validation
- protected-migrator configuration contract validation
- API migration execution in CI
- typecheck
- build
- browser smoke
- disposable PostgreSQL acceptance tests
- production container build
- bounded disposable backup/restore rehearsal
- startup-isolation assertion

A subsequent documentation-only commit 2bc4cb3ff34eec6812aa83b74dc0eafce6cf05db updated this resume point. That commit itself is documentation-only and is not being represented as a new application validation result.

The reconciliation also adds fail-closed migration lineage validation to apps/src/migrate.ts. If schema_migrations contains a version with no active source migration, or a filename that differs from the active source filename, migration execution aborts instead of silently accepting the mismatch.

## Database control-plane evidence — READ-ONLY
Neon control-plane inspection of the authoritative project steep-mud-79906940, branch br-restless-base-b44cip2h, database rupaykg succeeded for metadata inspection.
- Database-scoped table inventory reports 67 public tables.
- The application database inspected is rupaykg.
- The branch's visible PostgreSQL role inventory currently exposes the rupaykg role.
- public.organizations currently has no organization_id/tenant_id column; this is expected for the organization root table and is not, by itself, a tenant-isolation failure.
- The metadata inspection interface does not expose table RLS state, so RLS enablement is NOT VERIFIED from this inspection.
- No production SQL mutation, DDL/DML, role/grant change, deployment, or branch mutation was performed.

## Production evidence / unresolved verification
Prior repository/production evidence recorded a production ledger entry for migration 096 while the corresponding active source migration was absent, with staging-only 20261022–20261025 migrations not production-applied. This remains a release-critical evidence item.

A fresh direct read-only Neon SQL verification of production migration lineage was attempted; the connector returned HTTP 401 authentication failure. Therefore current authoritative production migration lineage is NOT VERIFIED in this session. The successful control-plane metadata inspection above does not substitute for querying schema_migrations.

Do not rewrite, delete, reintroduce, or mark migration 096 resolved based on inference. Resolve the evidence gap first, then perform an independently reviewed lineage reconciliation.

## Parallel release/security work
- #291 protected migrator: open, unmerged, non-draft; validation-only.
- #298 security convergence: draft/open/unmerged; validation-only.
- #302 oversized production-representative rehearsal stack: open, unmerged; do not merge.
- #303 bounded recovery/startup isolation branch: open, unmerged; CI #5628 SUCCESS.
- #304 protected-migrator/startup reconciliation: open, draft, unmerged; validated code head CI #5634 SUCCESS.

## Next safe actions
1. Preserve #304 as a verified validation artifact; do not merge/deploy automatically.
2. Resolve authoritative production migration-lineage evidence, including version 096, through a successful read-only connection.
3. Continue repository/database release-gate audit for tenant isolation/RLS, runtime DB identity, and least privilege using actual source and metadata evidence.
4. Keep recovery rehearsals disposable and bounded.
5. Do not perform production DDL/DML, role/grant/RLS changes, deployment, worker activation, certification, or TRL 9 declaration without the required independent gates and explicit founder approval.

## 2026-11-05 tenant isolation / RLS gate — VERIFIED BLOCKER
Fresh read-only SQL against the authoritative Neon branch/database succeeded.
Runtime identity observed: current_database=rupaykg, current_user=rupaykg, session_user=rupaykg.
Production schema_migrations is now directly VERIFIED for the current branch: the latest visible entries include 20261021, 20261020, 20261019, 20261018, then 096, followed by 087 and earlier entries. Version 096 is recorded as 096_verification_authorization_provenance.sql. This resolves the previous session's SQL-authentication evidence gap for the inspected branch; it does NOT establish that the source migration lineage is reconciled, because source-file inventory still needs to be compared against this ledger.
Most importantly, direct PostgreSQL catalog inspection shows all 67 public tables have relrowsecurity=false and relforcerowsecurity=false. A direct policy count returns 0 rows. Therefore RLS is NOT ENABLED and there are NO PostgreSQL RLS policies on the inspected database.
This is a release-critical tenant-isolation blocker. Do not enable RLS ad hoc in production: the correct next step is repository/source/migration reconciliation to design and validate the complete tenant-boundary policy set, including service-role/migrator exceptions, before any controlled migration is proposed.
No production DDL/DML or security mutation was executed.

### Evidence classification
- Runtime DB identity: VERIFIED for inspected Neon branch/database.
- Production migration ledger contents: VERIFIED for inspected Neon branch/database.
- RLS enablement: VERIFIED FALSE.
- RLS policy inventory: VERIFIED ZERO.
- Tenant isolation safety: NOT ACCEPTED / BLOCKED pending repository-level policy design and controlled validation.
- TRL 9: NOT CLAIMED.


## 2026-11-05 tenant-isolation reconstruction — IN PROGRESS / RELEASE BLOCKED
Branch: `shakti/2026-11-05-tenant-isolation-reconstruction`.
PR #305 is OPEN / DRAFT / UNMERGED / validation-only. Commits on this branch record the verified tenant-scope inventory, policy matrix, and transaction-scoped database-context design.

Direct Neon `information_schema.columns` inspection verified 31 organization-bearing column occurrences across 28 table names: single-organization ownership columns and bilateral relationships such as processor, actor, issuer, recycler, from/to, and obligated organization identifiers. This is an inventory input, not a completed RLS policy set.

The repository API currently uses a shared PostgreSQL pool and many direct `pool.query()` calls. Therefore RLS must not be enabled before protected data access is migrated to transaction-scoped authorization context. Session-level tenant state on pooled connections is prohibited.

Required next implementation batch: build the transaction-scoped DB context abstraction, migrate protected route/data-access paths, and add disposable PostgreSQL cross-tenant isolation plus pooled-connection leakage tests. Only after those tests pass should RLS SQL policies be implemented and rehearsed on disposable PostgreSQL.

Migration 096 remains unresolved at source/ledger lineage level: the inspected production ledger records `096_verification_authorization_provenance.sql`, while exact active-path checks did not locate that filename. Commit-history search identified historical authorization/provenance work but did not establish the exact missing migration filename/path. Do not mark 096 resolved by inference.

No production DDL/DML, role/grant change, RLS mutation, deployment, merge, certification, or TRL 9 declaration was performed in this batch.


## 2026-11-05 Tenant Context Implementation Batch

- Branch: `shakti/2026-11-05-tenant-isolation-reconstruction`.
- Implemented a reusable transaction-scoped PostgreSQL tenant/security context primitive in `apps/src/db-context.ts`.
- Context uses parameterized `set_config(..., true)` inside an explicit transaction, so the identity/organization/bilateral/service settings are transaction-local rather than session-local.
- Added unit tests in `apps/src/db-context.test.ts` covering commit/release and rollback/release behavior.
- Migrated the `POST /api/v1/resource-flows` protected write path to execute authorization, geography checks, and the insert in one tenant-context transaction.
- This is a bounded implementation checkpoint, not completion of tenant isolation.
- RLS remains disabled in the inspected Neon database and no production RLS mutation has been performed.
- Required next validation: CI on the new head, then disposable PostgreSQL isolation tests and pooled-connection reset evidence before broader protected-route migration or any RLS migration.


## 2026-11-05 Disposable Tenant-Isolation Acceptance Batch — VERIFIED CI

- Added `apps/src/tenant-isolation.integration.test.ts`.
- The suite creates a disposable schema and a dedicated non-superuser/non-BYPASSRLS PostgreSQL test role so the acceptance tests exercise actual PostgreSQL RLS semantics rather than the CI superuser bypass path.
- Verified in CI run **#5654** / workflow **42078866425** on branch `shakti/2026-11-05-tenant-isolation-reconstruction`.
- CI steps 1–17 completed successfully, including typecheck, build, browser smoke, disposable PostgreSQL acceptance, production-container build, bounded backup/restore rehearsal, and startup-isolation assertion.
- Disposable acceptance coverage now includes:
  - cross-tenant SELECT isolation;
  - cross-tenant INSERT denial;
  - cross-tenant UPDATE/DELETE isolation;
  - revoked-membership denial;
  - suspended-identity denial;
  - pooled-connection context reset;
  - bilateral organization scope;
  - explicit service-mode exception.
- This validates the **context primitive + representative disposable RLS semantics**. It does **not** prove that RupayKg's 67 production tables have correct policies.
- Production remains unchanged: no production RLS enablement, policy creation, DDL/DML, role/grant change, deployment, merge, certification, or TRL 9 declaration.
- Next safe implementation gate: reconcile the tested policy semantics against the full repository organization/bilateral table inventory, then build the complete production RLS policy migration and rehearse it on disposable PostgreSQL. Migration 096 source/ledger reconciliation remains a separate blocker.


## 2026-11-05 Protected Write-Path Expansion — IMPLEMENTED / VALIDATION PENDING

- Extended the tenant-context migration beyond `POST /api/v1/resource-flows`.
- `POST /api/v1/activities/:activityId/measurements` now executes authorization and the protected measurement INSERT inside `withDatabaseTenantContext(...)`.
- Measurement writes require an explicit active organization context; this avoids ambiguous multi-organization pooled-connection access before RLS is enabled.
- The protected write uses the transaction client for both authorization and mutation, preserving one authorization/data transaction.
- No production database mutation, RLS enablement, role/grant change, deployment, merge, certification, or TRL 9 declaration was performed.
- **Validation pending:** CI on commit `2183dab781b16fa28704bb2c4e914e2b1fd5cd91`.
- After CI, continue migrating additional protected write/read paths and maintain the rule that no production RLS migration is proposed until the complete policy matrix is reconciled with protected access paths.


## 2026-11-05 MRV Protected Access Expansion — VERIFIED CI

- Branch: `shakti/2026-11-05-tenant-isolation-reconstruction`.
- Commit: `72fdaba350042dea0933b4cf6635081cb3632acf`.
- CI #5675 / workflow run `42085269136`: **SUCCESS**.
- Validation steps 1–17 completed successfully, including migration validation, migration-manifest validation, protected-migrator configuration validation, CI migration execution, typecheck, build, browser smoke, disposable PostgreSQL acceptance, production-container build, bounded disposable backup/restore rehearsal, and startup-isolation assertion.
- MRV protected paths migrated in this batch:
  - `POST /api/v1/mrv/activities/:activityId/submit`
  - `GET /api/v1/mrv/provenance/:activityId`
  - `GET /api/v1/mrv/hedera/verify/:consensusTimestamp`
- These paths now use the transaction-scoped tenant context for protected authorization/data access and, where applicable, provenance persistence.
- The MRV submission path requires an explicit active organization and keeps authorization, geography, evidence/verification checks, measurements, provenance reads and provenance persistence on the same tenant transaction client.
- The Hedera verification path likewise performs the protected read/authorization and verification persistence through the same tenant transaction client.
- This is **VERIFIED COMPLETE at the engineering/CI level for this bounded batch only**. It is not tenant-isolation completion, production RLS completion, production readiness, field acceptance, statutory/regulatory approval, certification, or TRL 9.
- Production remains READ-ONLY / HOLD. No production DDL/DML, RLS enablement, role/grant change, deployment, merge, certification, or TRL 9 declaration was performed.

### Next protected-access batch

Continue from the same branch and prioritize remaining high-risk organization-scoped mutation paths, especially CPCB/SWM stakeholder workspace writes and other statutory/operational writes still using direct shared-pool access. Preserve the transaction-scoped context rule and run the full CI gate after each coherent batch. Migration 096 source/ledger reconciliation remains a separate release blocker.


## 2026-11-05 CPCB/SWM Protected Access Batch — VERIFIED CI

- Branch: `shakti/2026-11-05-tenant-isolation-reconstruction`.
- CPCB/SWM stakeholder workspace protected paths were migrated in commit `87047e53760b1fc8f257c2c275248c9c98719360`.
- CI #5677 / workflow run `42085738435`: **SUCCESS**.
- All validation steps 1–17 completed successfully: migration validation, migration manifest, protected migrator contract, CI migration execution, typecheck, build, browser smoke, disposable PostgreSQL acceptance, production container build, bounded disposable backup/restore rehearsal, and startup-isolation assertion.
- Migrated CPCB/SWM paths:
  - `GET /api/v1/cpcb-swm/workspaces`
  - `POST /api/v1/cpcb-swm/workspaces`
  - `PATCH /api/v1/cpcb-swm/workspaces/:workspaceId`
- These protected paths now use `withDatabaseTenantContext(...)`; authorization, geography checks, reads/writes, status history, and audit writes are executed through the same transaction-scoped client.
- The file inspection after the change confirmed no direct `pool.query`, `pool.connect`, manual BEGIN/COMMIT/ROLLBACK, or client release remains in those protected CPCB/SWM paths.
- Status: **VERIFIED COMPLETE at engineering/CI level for this bounded batch only**.
- This does not establish complete tenant isolation, production RLS completion, production readiness, field acceptance, statutory/regulatory approval, certification, or TRL 9.
- Production remains READ-ONLY / HOLD. No production DDL/DML, RLS enablement, role/grant change, deployment, merge, certification, or TRL 9 declaration was performed.

### Next protected-access batch — EPR return workspace

- Started bounded migration of `apps/src/epr-return-routes.ts` in commit `66c04a6d09b3c600d823413e0241685666dba97f`.
- Migrated EPR return list/create/submit/external-reference paths from split shared-pool/manual transaction access to `withDatabaseTenantContext(...)`.
- Authorization checks in those migrated paths now use the same tenant transaction client as the protected data access.
- CI validation for this new EPR-return head is **PENDING**; do not mark the batch complete until the full 17-step gate succeeds.
- Before production RLS is proposed, protected access still requires broader route/data-access migration and complete policy-matrix reconciliation.
- Migration 096 source/ledger lineage remains a separate unresolved release blocker.


### 2026-11-05 EPR Return CI Failure and Correction
- CI #5678 / run `42086424930`: **FAILURE** at TypeScript typecheck; migration validation and protected-migrator configuration gates passed before the failure.
- Exact failure: `DatabaseTenantContext.organizationId` requires `string`, while two EPR return transaction contexts supplied `string | undefined` via `auth.activeOrganizationId ?? undefined`.
- No production change occurred.
- Correction commit: `921aa260ad102fabd146b8c3676f230a47d80856` — requires an explicit active organization before EPR return submit/external-reference contexts and passes the narrowed organization ID into `withDatabaseTenantContext`.
- New CI validation is pending; EPR return batch remains **IMPLEMENTED BUT NOT VALIDATED** until the full gate succeeds.

## 2026-11-05 EPR Return + Workspace Tenant-Context Expansion — VERIFIED CI

- EPR return protected paths were corrected after CI #5678 TypeScript failure.
- Correction commit: `921aa260ad102fabd146b8c3676f230a47d80856`.
- CI #5680 / workflow run `42086785425`: **SUCCESS**.
- All validation steps 1–17 completed successfully.
- Verified EPR return paths:
  - `GET /api/v1/epr/returns`
  - `POST /api/v1/epr/returns`
  - `POST /api/v1/epr/returns/:returnId/submit`
  - `POST /api/v1/epr/returns/:returnId/external-reference`
- These paths now require/propagate explicit active organization context and use the same tenant transaction client for protected authorization/data access.

### Workspace route expansion

- Commit: `dde00fb02b8f97c1e77aeeaa6b8fe6ea2ffc1f2d`.
- CI #5684 / workflow run `42088209275`: **SUCCESS**.
- All validation steps 1–17 completed successfully.
- The bounded workspace migration now covers:
  - resource-flow workspace reads;
  - compliance workspace reads;
  - carbon workspace reads;
  - registry workspace reads;
  - settlement workspace reads;
  - ESG workspace reads;
  - workspace permission pre-handler;
  - workspace authorization helper;
  - MRV workspace read;
  - evidence verification write.
- Direct inspection of `apps/src/workspace-routes.ts` at the validated head found no remaining `pool.query`, `hasOrganizationPermission(pool,` or `authorizeGeography(pool,` usage in that module.
- Status: **VERIFIED COMPLETE at engineering/CI level for this bounded batch only**.

### Current release-gate position

- PR #305 remains **OPEN / DRAFT / UNMERGED / VALIDATION-ONLY**.
- Production remains **READ-ONLY / HOLD**.
- RLS remains disabled in the inspected authoritative Neon database; zero PostgreSQL policies remain a verified release blocker.
- Migration 096 source/ledger lineage remains unresolved and must not be resolved by inference.
- Tenant isolation is **NOT COMPLETE** merely because these route batches passed CI. Remaining repository-wide protected data-access paths must still be reconciled before a complete RLS migration can be designed.
- Next action: continue systematic repository-wide protected-access inventory/migration, prioritizing remaining organization-scoped operational, registry, sync, onboarding, evidence-vault, BWG, intelligence, and platform-admin paths; preserve transaction-scoped context and validate each coherent batch through the full CI gate before any RLS proposal.
\n

## 2026-11-06 Tenant-Isolation Route Expansion — VERIFIED CI

- Onboarding hierarchy correction commit: `c3a6edc56eff0951d33f9855b974ba531fcb8886`.
- CI #5697 / workflow run `42093472038`: **SUCCESS**.
- All validation steps 1–17 completed successfully.
- Field-sync migration commit `c4378a75aa87691f19a567785bee5e9a39d77b3b` is **VERIFIED COMPLETE at engineering/CI level** via CI #5694 / workflow run `42092552103`.
- Onboarding, registry, intelligence, sync, evidence-vault, and BWG modules inspected on the current branch contain no direct shared-pool query/connect patterns in the inspected source and use transaction-scoped tenant context where migrated.
- This remains bounded engineering validation only; tenant isolation, production RLS, production readiness, field acceptance, regulatory approval, certification, and TRL 9 remain unverified/not achieved.
- Production remains **READ-ONLY / HOLD**. No production DDL/DML, RLS enablement, deployment, merge, role/grant mutation, certification, or TRL 9 declaration was performed.

### Immediate next release-blocker work

1. Complete semantic repository-wide protected-access review; do not rely only on regex absence of shared-pool patterns.
2. Reconcile production migration ledger version `096_verification_authorization_provenance.sql` against authoritative active source/history; unresolved until exact lineage is proven.
3. Convert the proposed tenant policy matrix into reviewed SQL policy semantics for the complete 67-table production inventory.
4. Rehearse the complete RLS migration on disposable PostgreSQL, including service/migrator exceptions and bilateral semantics.
5. Obtain the independent release gate before any production proposal.


## 2026-11-06 CI recovery checkpoint — authentication bootstrap test compatibility

Verified CI #5711 / run 42155117584 on tenant-isolation reconstruction head e5990915bfe97dfda57a79d3dc5e56c462046eb3 failed at validation step 14 (disposable PostgreSQL acceptance tests), after migration validation, manifest validation, protected migrator validation, migration execution, typecheck, build and browser smoke all passed.

Evidence-backed failure:
- Tests 35–46 in platform-admin-routes.test.ts returned 503 where the existing unit tests expected authorization/business statuses (403/200/409/400).
- Test 60, bootstrap context, also failed in that prior test suite.
- Root cause for tests 35–46 is confirmed: authenticate() now uses withDatabaseBootstrapContext(), which requires pool.connect(); the shared fakePool() test double only implemented pool.query(), causing authentication to fail closed as AUTH_UNAVAILABLE and downstream tests to receive 503.
- Corrective commit 4a0fb01cd37dfdb6feb03cffcb020beee731cc61 updates the platform-admin fakePool test double to implement a transaction-capable connect()/release() path and recognize BEGIN/COMMIT/ROLLBACK. This is test infrastructure only; no production runtime behavior or database mutation.
- Bootstrap context semantics remain organization-neutral, identity-neutral, service_mode=false, bilateral_scope=false.

Current status: corrective commit implemented; awaiting fresh CI validation. Production remains READ-ONLY / HOLD.


## 2026-11-06 CI #5712 correction checkpoint

CI #5712 / run 42155494022 completed with migration validation, protected migrator validation, migration execution, typecheck, build and browser smoke passing; disposable acceptance failed.

Exact evidence:
- platform-admin tests 35–46 returned 503 instead of expected authorization/business responses because the fake pool response matcher classified the authorization query as an organization-membership query before checking the super_admin role predicate.
- tenant bootstrap test 60 expected empty-string unset settings, but PostgreSQL current_setting(..., true) returned NULL for unset organization/identity context.
- Corrective changes:
  - platform-admin fake query matcher reordered to recognize the super_admin authorization query before generic membership SQL.
  - bootstrap integration assertions changed to PostgreSQL-correct NULL semantics and test wording corrected to non-service-scoped.
- Production remains READ-ONLY / HOLD.
- Awaiting fresh CI validation.
