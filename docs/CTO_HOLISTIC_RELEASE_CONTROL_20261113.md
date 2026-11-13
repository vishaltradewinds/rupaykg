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
