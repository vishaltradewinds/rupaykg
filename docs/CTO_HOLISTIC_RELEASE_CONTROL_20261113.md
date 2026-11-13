# RupayKg Holistic Release Control — 2026-11-13

Status: ACTIVE ENGINEERING CONTROL  
Repository: `vishaltradewinds/rupaykg`  
Base: `main`  
Branch: `cto/20261113-holistic-release-convergence`

## CTO decision

The platform is in **convergence/hardening**, not feature-expansion mode.

The authoritative architecture remains:

Regulatory → Evidence → MRV → IoT/Measurement → Data → AI → Registry/Integrity → Workflow → Reporting → Ecosystem Integrations

Urban, rural, peri-urban, industrial and regional deployments are controlled configurations of the same platform.

## Release gates

| Gate | Required evidence | Current decision |
|---|---|---|
| Candidate CI | Successful CI on the tested code candidate; documentation-only head changes separately identified | **PASS** — run `43410574693` on code commit `754f44b...`; all 14 execution steps passed. PR head `840fd78...` contains documentation-only changes after that candidate; no separate CI run was returned for the docs-only head. |
| Migration reconciliation | Read-only production/staging comparison | **PARTIAL / OPEN** — production schema_migrations reaches `20261021`; repository head contains migrations through `100` plus dated migrations |
| Runtime identity | Verified identity + active membership | **PARTIAL PASS** — two existing verified identity/membership contexts were exercised transactionally; invalid bearer-token hash returned zero auth rows |
| Runtime DB role | Non-BYPASSRLS runtime role | **PARTIAL PASS** — `rupaykg_runtime_login` exists, is LOGIN/non-BYPASSRLS, inherits `rupaykg_app_runtime`, and connected successfully; `rupaykg_app_runtime` remains NOLOGIN/non-BYPASSRLS. Admin role `rupaykg` remains BYPASSRLS |
| RLS | Enabled and tested in target runtime | **PARTIAL PASS / OPEN** — 17/67 public tables have RLS enabled; tested non-BYPASSRLS runtime sees its own tenant organization and zero rows for the other tested tenant in both contexts; 50 remain disabled and enabled tables do not yet FORCE RLS |
| Cross-tenant negative tests | Tenant A cannot read/write tenant B | **PARTIAL PASS / OPEN** — live two-tenant SELECT isolation passed; cross-tenant INSERT/UPDATE/DELETE denial and full protected-table coverage remain untested |
| Urban Golden Transaction | Real end-to-end acceptance evidence | OPEN |
| Rural Golden Transaction | Real end-to-end acceptance evidence | OPEN |
| Physical measurement | Authenticated measurement/evidence | OPEN |
| Guardian | Authenticated authoritative execution | OPEN |
| Hedera/HCS | Authoritative consensus + Mirror Node evidence | OPEN |
| CPCB/EPR/etc. | Authoritative external confirmation where applicable | OPEN |
| Backup/restore | Tested recovery evidence | OPEN |
| Monitoring/rollback | Operational evidence | OPEN |
| Production acceptance | All material gates closed | BLOCKED |

## Golden transactions

### Urban

Generator → Collection/Aggregator → Transport → Processor/Recycler → Measurement → Evidence → Verification → MRV → Provenance → Report

Minimum actors:
- Generator
- Aggregator/collector
- Transporter
- Processor/Recycler
- ULB/operator
- Verifier

### Rural

Household/institution → Gram Panchayat → Collection/Aggregation → Transport → Processor/Recycler → Measurement → Evidence → Verification → MRV → Provenance → Report

Minimum actors:
- Generator
- Gram Panchayat
- Aggregator/collector
- Transporter
- Processor/Recycler
- Verifier

## Truthfulness rules

- Never convert demo/simulated evidence into verified evidence.
- Never infer CPCB/other government approval from an internal RupayKg state.
- Never call CI green without a successful run on the current release candidate.
- Never enable production RLS before runtime identity/context and negative cross-tenant tests are proven.
- Never modify production Neon during this hardening gate unless an explicitly approved migration is ready and the required evidence exists.
- Never claim TRL 9 from architecture or software completeness alone.

## Stakeholder acceptance matrix

| Stakeholder | Must be able to do | Evidence produced |
|---|---|---|
| Generator | create/submit activity | source activity + identity |
| Aggregator | receive/aggregate/move material | custody + measurement |
| Transporter | execute movement | movement + time/location |
| Processor/Recycler | receive/process/output | input/output measurement |
| ULB | govern urban workflow | authoritative operational state |
| Gram Panchayat | govern rural workflow | local authority/community evidence |
| Verifier | review and decide | verification record |
| Regulator | inspect/report | traceable compliance package |
| Producer/Brand | consume EPR evidence | obligation/output lineage |
| Buyer | consume recovered material/value | provenance |
| Auditor | sample/reconcile | assurance trail |

## Engineering sequence

1. Prove current-head CI.
2. Reconcile migrations read-only.
3. Close runtime tenant-isolation gate.
4. Execute Urban Golden Transaction.
5. Execute Rural Golden Transaction.
6. Connect authenticated physical measurement.
7. Execute Guardian/Hedera authoritative path.
8. Close operational backup/restore/rollback gates.
9. Produce release evidence bundle.
10. Only then decide production acceptance and TRL progression.

## Non-goals

This control does not:
- certify statutory compliance;
- certify CPCB approval;
- certify carbon credits;
- certify Hedera immutability;
- certify TRL 9;
- replace independent audit or government approval.

Those require their own authoritative evidence.

## Exit criterion

A release candidate may be called **production-ready** only when every material gate above is evidenced against the candidate itself and no P0/P1 blocker remains.

## 2026-11-13 CTO convergence update — tenant-isolation acceptance harness

- Fixed `VERIFY_RLS_POLICY_COVERAGE.sql` to use PostgreSQL's actual `pg_policies.cmd` values (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) instead of lower-case aliases, and to fail closed when any protected table lacks RLS.
- Fixed `.github/workflows/tenant-isolation-live-acceptance.yml` shell continuations in the SECURITY DEFINER verification step.
- Controlled rehearsal evidence on `rupaykg-tenant-isolation-lab-20261101` confirms `rupaykg_app_runtime` is non-SUPERUSER/non-BYPASSRLS and that existing policy rows are visible to the coverage query; the rehearsal remains incomplete because 45/67 public tables have RLS disabled and the required authentication bootstrap function is absent there.
- Production remains HOLD: the live production connection role `rupaykg` is BYPASSRLS and only 17/67 public tables currently have RLS enabled.
- No production SQL, role, credential, RLS, ownership, or data mutation was performed in this batch.

## 2026-11-13 CTO convergence batch — protected-domain activation

- Added forward-only migration `101_shakti_tenant_isolation_activation.sql` on the convergence branch.
- Scope is deliberately limited to the 17 protected-domain tables whose tenant boundary is explicit in the verified schema: direct organization-owned tables plus activity-derived MRV/evidence/verification records and organization-owned settlement/credential/chain-of-custody records.
- The migration requires the controlled `rupaykg_app_runtime` role to exist and be non-SUPERUSER/non-BYPASSRLS; it does not create credentials or alter the production login.
- Added `VERIFY_101_ACTIVATION.sql` as a read-only post-activation gate.
- Production remains untouched. Neon temporary migration rehearsal could not be prepared because the Neon project currently reports its branch limit exceeded; therefore migration 101 is code-reviewed/repository-pinned but not declared database-applied.
- Authentication bootstrap remains a separate gate. Read-only inspection of the current production schema now verifies that `app.authenticate_bearer_session(text)` exists as a SECURITY DEFINER function and that `app.set_request_context(uuid,uuid)` exists. The production runtime role remains NOLOGIN/BYPASSRLS-safe; no production role change was made.

## 2026-11-13 CTO convergence batch — runtime authentication handoff

- Added forward-only migration `102_shakti_runtime_auth_handoff.sql`.
- Migration 102 does **not** create credentials, enable LOGIN, or change production authentication configuration.
- It revokes PUBLIC EXECUTE on the four request-context/authentication functions and grants EXECUTE only to `rupaykg_app_runtime`, after asserting that role is non-SUPERUSER/non-BYPASSRLS.
- Added read-only `VERIFY_102_RUNTIME_AUTH_HANDOFF.sql` which fails closed if the runtime role is privileged, receives LOGIN, or lacks the required EXECUTE privileges.
- This closes the **database privilege handoff design** gate in the repository; it does **not** close production runtime acceptance because migration 102 has not been applied and the application still needs a verified runtime login/connection path.
- Production Neon remains untouched.


## 2026-11-13 CTO convergence batch — live production runtime read-isolation acceptance

- Discovered and connected as the existing `rupaykg_runtime_login` role; it is LOGIN, non-SUPERUSER, non-BYPASSRLS, and inherits `rupaykg_app_runtime`. The application runtime role itself remains NOLOGIN/non-BYPASSRLS.
- Used two existing verified identity/organization membership pairs. Within one transaction, Tenant A saw exactly its own organization and zero rows for Tenant B; Tenant B saw exactly its own organization and zero rows for Tenant A.
- Invalid bearer-token hash returned zero authentication rows.
- With no request context, the runtime login saw zero organizations and zero organization memberships; a mismatched identity/organization context was rejected by the verified-membership guard.
- Evidence is recorded in `docs/audit/evidence/2026-11-13-cto-tenant-isolation-live-runtime-acceptance.md`.
- This is a **partial production read-isolation PASS**, not full tenant isolation. Cross-tenant write denial, no-context fail-closed behavior across the protected domain, 67-table RLS coverage, FORCE RLS, and application deployment connection-path verification remain OPEN.
- Migrations 101/102 remain unapplied. Production data/schema/roles were not mutated; only read-only queries and transaction-local request-context settings were used.

- The new candidate CI run 6820 for commit `754f44b...` was observed in progress at the time of this update; run 6808 remains the previously verified successful baseline, not evidence that the latest candidate is green.


## 2026-11-13 CTO convergence batch — CI completion and application connection-path audit

### CI result
- GitHub Actions run `43410574693` completed successfully on candidate code commit `754f44b386fee9d3467e76d13e9bf6db90983484`.
- All 14 execution steps passed, including dependency audit, disposable non-BYPASSRLS runtime-role assertion, migration validation and disposable migration execution, typecheck, build, browser smoke, PostgreSQL acceptance tests, and production-container build.
- The current PR head `840fd78cb3834320ffb3d9db91db2f185fa0e8b2` is a documentation-only descendant of that code candidate. No separate workflow run was returned for the documentation-only head. The successful CI result is therefore attributed to the tested code SHA, not overstated as a new run on the later docs commit.

### Application connection-path audit
- Static path traced: `production-server.ts` reads the validated production configuration and propagates `DATABASE_URL`/TLS settings; `auth.ts` uses the configured pool for SECURITY DEFINER bearer-session bootstrap; `tenant-db.ts` establishes a transaction and calls `app.set_request_context(identity, organization)` before tenant-scoped work; `runtime-db-preflight.ts` checks the connected role and protected-table posture before startup.
- Render inspection found canonical production service `rupaykg` still configured to deploy from `main`, with latest live deploy at `385c75174579ba35e5f0bdd928be690e78f03438`. The candidate PR branch is not deployed to that service.
- The Render service configuration references externally supplied `DATABASE_URL`; its secret value was not retrieved or exposed. Consequently, the exact live application database login identity is **not verified** from the available deployment metadata. The separate `rupaykg_runtime_login` role was directly tested in read-only Neon checks, but that does not prove Render currently uses it.
- Candidate startup preflight is fail-closed for privileged roles, protected-table RLS/ownership gaps, and the governed SECURITY DEFINER boundary. This safeguard is not proof that production has already passed it.

### Test-scope review
- The existing tenant integration test creates fixture organizations/identity/role/membership, validates transaction context and rejects an identity/organization mismatch. Its fixture setup/cleanup uses ordinary integration-test database operations and is intended for the disposable CI database; it is not a production-safe test harness.
- `VERIFY_RLS_NEGATIVE_TEST.sql` is explicitly transactional and rolls back fixtures. It checks the two-tenant organization read boundary, cross-tenant organization UPDATE/DELETE row-count denial, and zero rows across the 17 protected tables with no request context.
- That SQL harness has **not** been executed against production. It also does not yet prove every protected child-table write path, cross-tenant INSERT denial, or the full 67-table platform boundary. Those remain acceptance gaps.
- No production data, schema, roles, credentials, or deployment settings were changed in this batch.

### Updated release decision
- Candidate code CI: PASS for `754f44b...`.
- Canonical Render production deploy of PR #355: NOT DEPLOYED.
- Exact production Render-to-Neon runtime login: NOT VERIFIED.
- Live production tenant read-isolation: PARTIAL PASS for two organization contexts only.
- Cross-tenant mutation denial and full-table coverage: OPEN.
- Migrations 101/102: NOT APPLIED.
- Urban/Rural real Golden Transactions: OPEN.
- Production release: HOLD.


## 2026-11-13 CTO convergence batch — complete candidate CI run 6822

- GitHub Actions run `43411575978` (run number 6822) completed with conclusion **SUCCESS** on branch `cto/20261113-holistic-release-convergence`.
- All execution gates passed: dependency audit; disposable non-BYPASSRLS runtime-role assertion; migration validation and disposable migration execution; typecheck; build; browser smoke; disposable PostgreSQL acceptance; and production-container build.
- The latest `VERIFY_RLS_NEGATIVE_TEST.sql` includes the cross-tenant organization INSERT denial assertion. The disposable PostgreSQL acceptance stage passed with that assertion present.
- **Correction to the earlier test-scope note above:** the latest harness does include and pass the cross-tenant organization INSERT denial assertion in disposable CI. The earlier statement that cross-tenant INSERT denial was not yet covered is superseded by this update.
- Scope remains limited to the candidate's 17-table protected domain and the assertions actually executed by the disposable CI harness. It does not prove every child-table write path, all 67 public tables, production write denial, or production application deployment identity.
- PR #355 remains open and unmerged. Canonical Render production remains on `main`; the candidate has not been deployed.
- Production Neon remains untouched: migrations 101/102 are not applied, and no production DDL/DML, role, credential, or deployment-setting changes were made.
- Updated release decision: **candidate CI PASS; production release HOLD** pending exact Render runtime identity proof, full-table tenant-isolation coverage and controlled production acceptance, Urban/Rural golden transactions, and operational recovery gates.


## 2026-11-13 CTO convergence batch — full-table inventory and context-authenticity finding

### Production inventory
- Read-only catalog audit confirms 67 public tables: 17 RLS-enabled, 50 RLS-disabled, and 0 with FORCE ROW LEVEL SECURITY enabled.
- The 50 unprotected tables span tenant-owned BWG/EPR/ESG/CPCB workflows, evidence vault, field-sync, provenance, registry/settlement events, stakeholder onboarding, identity/authentication control plane, shared regulatory/methodology/geography catalogues, and platform integrity.
- These tables cannot safely receive a generic `organization_id` policy. The new evidence document classifies them into tenant-direct, tenant-child, multi-party, identity/control-plane, global reference/configuration, and platform-integrity groups; per-table FK and route review remains required.

### New P0/P1 security finding — request-context authenticity
- A read-only live test as `rupaykg_runtime_login` directly set both custom GUCs `app.identity_id` and `app.organization_id` in a single SELECT statement without calling `app.set_request_context(uuid,uuid)`; RLS then exposed the selected valid organization row (1 row).
- A mismatched identity/organization pair remained blocked (0 rows), so the current policy checks membership consistency. However, the GUC pair is not cryptographically/session-bound to the bearer token; a compromised runtime DB session or SQL-injection path could choose a known valid identity/organization pair.
- This is now an explicit release blocker. Membership validation alone is not sufficient proof of authenticated context authenticity. A session-bound, non-forgeable context hand-off must be designed and tested before tenant isolation is called robust.
- Evidence: `docs/audit/evidence/2026-11-13-cto-tenant-boundary-context-authenticity.md`.

### Candidate migration/test corrections
- Corrected migration 101's new permissive policies to include `app.is_verified_org_member(...)` predicates. Without this, its weaker organization-GUC-only policies could OR-combine with and weaken the migration 099 policy foundation.
- Extended the rollback-only negative-test harness to assert that setting only the organization GUC with no identity yields zero visible organization rows.
- This regression test does not resolve the separate direct spoof of a valid identity/organization pair. Current CI is required before treating the correction as accepted.

### Updated release decision
- Candidate CI run 6822: PASS for the prior candidate only; new migration/test corrections require a fresh run.
- Production inventory: 17/67 RLS; 0 FORCE RLS.
- Context authenticity: OPEN / RELEASE BLOCKER.
- Full 67-table policy map and write-denial acceptance: OPEN.
- Migrations 101/102: NOT APPLIED.
- Urban/Rural real Golden Transactions: OPEN.
- Production release: HOLD.


## 2026-11-13 CTO convergence batch — session-bound context and remaining-table map

### Request-context authenticity remediation
- Added candidate migration `103_shakti_nonforgeable_request_context.sql`: the SECURITY DEFINER bearer-session bootstrap now mints short-lived opaque context grants; the request-context setter requires the matching grant; RLS context readers validate the grant against the live session, verified identity and current verified membership.
- The runtime role has no direct access to the private `app.request_context_grants` table. The API authentication layer carries the opaque grant internally; `withTenantTransaction` passes it to the setter.
- Removed the pre-context `organization_memberships` SELECT from `withTenantTransaction`. That query would be denied by the very RLS policy being established when the real non-BYPASSRLS runtime role connects. The bootstrap and grant setter now perform the authoritative checks before any tenant-scoped query.
- Expanded the integration test to SET ROLE `rupaykg_app_runtime` before calling the authentication bootstrap, before setting context, and for tenant-scoped reads. It also tests direct identity+organization GUC spoof without a context grant and cross-organization grant reuse.
- CI run 6843 completed SUCCESS on candidate SHA `aa82c3456fc8f230e73c0bbdfaaff51faa81c13c` (includes migration 103, auth token plumbing, migration/test typecheck/build and PostgreSQL integration suite; this run preceded the final non-BYPASSRLS transaction-wrapper test).
- CI run 6845 has passed dependency audit, runtime-role assertion, migration validation/execution, typecheck, build, browser smoke and disposable PostgreSQL acceptance with the non-BYPASSRLS transaction-wrapper test. Production-container build is still in progress at the time of this update. Run 6845 is on SHA `84599aacf20829b32969bca6189fe52a0045d102`; the subsequent commit that explicitly runs bearer bootstrap as runtime role requires its own fresh run.
- Earlier intermediate failures were used to fix the PL/pgSQL enum-to-text return cast and update test doubles to return the new context token. Do not count those failed runs as passing evidence.

### Remaining 50-table classification
- Added `docs/audit/evidence/2026-11-13-cto-tenant-policy-map-50-tables.md`, based on production catalog columns and FK targets. All 50 tables now have a candidate class: tenant-direct, tenant-child, multi-party, identity/control-plane, global reference, or platform-integrity.
- The map highlights unresolved semantics: bilateral EPR credit/transfer/allocation visibility; registry owner/recipient event scope; settlement-event payer/payee scope; pre-membership stakeholder application review; identity-secret access; and `operation_sync_envelopes.device_id` lacking an observed FK to `field_devices`.
- This is a classification, not policy implementation. RLS remains disabled on these 50 tables; each still needs code-path, operation-level and negative-test acceptance.

### Urban/Rural real-data readiness
- Read-only production inventory found two VERIFIED organizations, both `test_fixture`; zero activities, resource flows, measurements, evidence, verifications, field devices, MRV provenance events, credentials, registry events or settlements.
- The only geography row is the versioned acceptance-fixture cluster. No source-versioned ULB/Ward/Block/Gram Panchayat/Village records exist in the inspected production geography table.
- Urban and Rural Golden Transactions therefore remain NOT EXECUTED. CI fixtures are synthetic tests, not field/site evidence. SITE-JBP-01 remains pre-validation pending official site/ULB/GP records, authorized Generator + Aggregator + Processor/Recycler participation, source-backed geography, real calibrated measurement, evidence and independent verification.

### Updated release decision
- Session-bound context hardening: candidate implementation and tests underway; no production migration applied.
- Production table coverage: 17/67 RLS enabled, 50/67 disabled, 0 FORCE RLS in the inspected snapshot.
- Remaining 50 table policies: classified, not implemented.
- Real Urban/Rural transactions: not executed; production has no operational rows or source-backed ULB/GP geography.
- Migrations 101/102/103: NOT APPLIED to production.
- PR #355: OPEN / UNMERGED.
- Production release: HOLD.


## 2026-11-13 CTO convergence batch — context-grant integration CI completed

- CI run 6845 completed **SUCCESS** on SHA `84599aacf20829b32969bca6189fe52a0045d102`: all 14 execution stages passed, including the disposable PostgreSQL suite and production-container build.
- CI run 6846 completed **SUCCESS** on SHA `1bf50ab4620241af3fbc6e570a32de9a1358e9af`: this includes the additional integration test that executes `app.authenticate_bearer_session` as `rupaykg_app_runtime`, then establishes tenant context as that role before the first tenant-scoped query; all 14 stages passed.
- CI run 6847 completed **SUCCESS** on docs descendant SHA `f15e6242e5c240dae2d2d9d76277fd3c5e1cde15`; all stages passed.
- Added a dedicated rollback-only SQL negative acceptance step to the main CI workflow after run 6847. It now checks FORCE RLS, protected-table ownership, no direct runtime access to context grants, both tenant directions, cross-tenant mutation denial, direct GUC spoof denial and no-context zero visibility. This workflow update is commit `eca9cff3867d33d94e0ab128ed63bb8e994b6e80`; a fresh CI run on that workflow change is required and was not yet returned at this update.
- The new SQL harness remains a 17-table acceptance suite, not proof of all 67 public tables.

### Current candidate status
- Migration 103 + auth code + runtime transaction order: candidate integration CI PASS on run 6846.
- Full rollback-only SQL negative suite in main CI: newly wired, fresh run pending.
- 50 remaining public tables: candidate classification documented, policies not yet implemented.
- Production Neon migrations 101/102/103: NOT APPLIED.
- Render-to-Neon production connection identity: NOT VERIFIED.
- Real Urban/Rural Golden Transactions: NOT EXECUTED; production has only test fixtures and no operational MRV/evidence/device/settlement rows.
- PR #355: OPEN / UNMERGED.
- Production release: HOLD.


### CI retest after 6831/6849/6850 failure triage
- Run 6831 exposed an ambiguous `identity_id` reference in migration 103's grant CTE; the RETURNING columns are now table-qualified and aliased.
- Run 6849/6850 exposed an undeclared `v_name` variable in the rollback-only negative-test block; it is now declared in that DO block.
- Run 6850 was executed against prior SHA `49f5cb04f768c4789e0132a7991898e785007576`, before the loop-variable correction. Its failure is therefore not the result for current PR head.
- Current PR head at this document update: `5c0a8c43e71bae9e797f5b371a511d086b5a41af`. No workflow run was associated with this exact SHA at the time checked; fresh CI remains required.

## 13 November 2026 — CTO candidate-branch checkpoint

Canonical repository: `vishaltradewinds/rupaykg`. Work is confined to the candidate branch `cto/20261113-holistic-release-convergence` and PR #355. No production Neon migration, role provisioning, RLS activation, credential mutation, or deployment has been performed.

### Candidate database security work

- Runtime authentication and tenant transactions explicitly switch to the non-BYPASSRLS `rupaykg_app_runtime` role before establishing the authenticated request context.
- The candidate RLS activation and acceptance inventory now covers 28 tables (17 previously enabled plus 11 additional tenant-scoped tables). This is candidate SQL only; the inspected production snapshot remains 17/67 RLS-enabled.
- The candidate adds 12 narrowly scoped SECURITY DEFINER boolean helpers owned by the NOLOGIN/NOBYPASSRLS `rupaykg_security_definer` role. The helpers cover request context, verified membership, current registry owner, destination readiness, organization verification, activity/geography scope, acceptance-fixture exclusion and exact MRV provenance.
- The isolated owner receives column-level SELECT grants only for the required fields in activities, geography scopes, organizations, memberships, evidence, verifications, MRV provenance and registry events. It receives no runtime membership and no BYPASSRLS.
- Registry events and settlements are append-only/tenant-scoped. Credential access follows issuer and current owner; former owners retain access only to event rows in which they participated.
- Credential issuance, transfer and retirement preserve Guardian/Hedera/Mirror Node proof, acceptance-fixture exclusion, verified destination organization and verified geography constraints.

### Verification status

- Migration validation, disposable PostgreSQL migration execution, SECURITY DEFINER boundary checks and typecheck/build/browser smoke have passed on recent candidate runs.
- The full disposable PostgreSQL acceptance suite is still being iterated. A current-owner retirement path exposed that the MRV proof trigger queried issuer-owned provenance under the new owner's RLS context. The candidate now routes that exact proof check through a bounded helper; the latest CI run is pending.
- Do not label the candidate fully green until the full suite and rollback-only tenant-isolation negative acceptance both pass on the exact PR head.

### Release blockers retained

1. Verify the actual production database login and controlled DDL ownership-transfer capability before any production migration.
2. Complete tenant RLS policy design and negative tests for all remaining tables; 28 candidate-covered tables do not equal full-platform isolation.
3. Refactor or explicitly gate platform-admin control-plane queries so they do not depend on elevated application database credentials.
4. Complete exact-head CI, migration rehearsal, rollback review and runtime identity acceptance.
5. Complete authenticated Guardian policy execution, HCS/Mirror Node provenance acceptance and field validation at SITE-JBP-01.
6. Production Neon remains READ-ONLY/HOLD. No production deployment or TRL 9 claim is authorized by this checkpoint.


## 2026-11-13 CTO convergence batch — exact-head RLS increment accepted

- Exact PR head for this batch: `3ae62212ea5d53c5f37d9dcfb1c7b996a97c1db4`.
- CI run `43451009351` / run number `6940` completed **SUCCESS** on the PR merge candidate. All 17 execution stages passed, including migration validation/execution, SECURITY DEFINER boundary acceptance, typecheck, build, browser smoke, disposable PostgreSQL acceptance, rollback-only tenant-isolation negative acceptance, and production-container build.
- The first attempted batch exposed repository/CI schema drift: `cpcb_swm_stakeholder_workspaces` was present in the read-only production catalogue but absent from the repository's disposable schema. That table was removed from the candidate migration rather than inventing a compatibility table. The batch was then narrowed to the verified repository table `organization_geography_scopes`.
- Migration `107_shakti_tenant_direct_domain_activation.sql` now enables and **FORCE RLS** for `organization_geography_scopes`, requires verified tenant membership, grants only the protected runtime DML surface, and remains unapplied to production.
- The rollback-only negative acceptance was aligned with the exact activated table set and passed on the exact PR head.
- This is a **candidate security increment**, not production activation. Production remains READ-ONLY/HOLD; migrations 101/102/103/107 remain unapplied, and full 67-table tenant isolation is still not proven.

## Current exact-head release decision

- Candidate CI: **PASS** on `3ae62212ea5d53c5f37d9dcfb1c7b996a97c1db4`.
- Candidate migration 107: **REHEARSED IN DISPOSABLE CI; NOT APPLIED TO PRODUCTION**.
- Tenant isolation: **IMPROVED / STILL PARTIAL**. The candidate protected domain is incrementally expanding; full 67-table coverage remains open.
- Urban Golden Transaction: **OPEN / NOT EXECUTED**.
- Rural Golden Transaction: **OPEN / NOT EXECUTED**.
- Physical measurement: **OPEN**.
- Guardian/Hedera authoritative execution: **OPEN**.
- Backup/restore and operational rollback evidence: **OPEN**.
- Production release: **BLOCKED / HOLD**.
