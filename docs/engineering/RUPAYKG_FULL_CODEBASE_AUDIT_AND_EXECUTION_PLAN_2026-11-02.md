# RupayKg full-codebase audit and accelerated execution plan

**Date:** 2026-11-02  
**Repository:** `vishaltradewinds/rupaykg`  
**Canonical integration branch:** `shakti/auth-bootstrap-application-integration-2026-11-01`  
**Canonical PR:** #192 (OPEN / DRAFT; do not merge)  
**Production posture:** HOLD — no production changes authorized by this audit  
**Assessment type:** CTO engineering audit / evidence-led plan; not independent security certification or statutory approval

## 1. Executive decision

RupayKg has a substantial working software prototype and meaningful laboratory controls, but it is **not production-ready as a national multi-tenant environmental infrastructure platform**. The immediate critical path is not adding more features. It is closing the identity/authority bootstrap, runtime database privilege, tenant isolation, and operational evidence gaps in the correct order.

The highest-risk finding is that the proposed least-privilege application runtime and the current route implementation are not yet compatible: a request-scoped signed RLS transaction helper exists, but it is not integrated across the API's SQL paths. Several routes still perform direct SQL against membership, identity, organization, and other tenant-owned data. Enabling RLS or switching to the proposed restricted runtime before the route and grant matrix is complete would break legitimate paths or leave an incomplete enforcement boundary.

**No blanket RLS migration, runtime credential cutover, PR merge, or deployment is recommended now.**

## 2. Audit scope and confidence

This first audit batch reviewed:
- PR #192 metadata and full changed-file inventory (54 files; approximately 5,745 additions and 74 deletions at inspection).
- The current API server, authentication adapter, authentication routes, hierarchical onboarding routes, platform-admin routes, value, registry, sync, workspace, BWG, CPCB/SWM, intelligence, MRV and evidence-vault routes.
- Production configuration, Dockerfile, Render blueprint, CI workflow, migration validator, migration index and the current auth/bootstrap/RLS migrations.
- Existing authentication, runtime-compatibility, tenant-isolation, disposable-lab, TRL and engineering checkpoint reports.
- Exact-head CI #4521 for forged platform-role acceptance: completed successfully.

This is a **broad architecture and release-gate audit**, not yet a final line-by-line audit of every file in every package, every historical migration, every worker/CLI path, every frontend flow, or every live integration. Those are explicit work packages below. Existing source inventories are retained as evidence but must be refreshed against the current branch before certification.

## 3. Findings — ranked by release risk

### P0 — Production database is not tenant-isolated

Previously verified by read-only production Neon catalog inspection:
- 67 public base tables.
- 0/67 with RLS enabled; 0/67 with FORCE RLS.
- All 67 public tables owned by the broad `rupaykg` login.
- That login has BYPASSRLS and elevated role/database/replication capabilities and is a member of `neon_superuser`.
- 46 tables have direct organization/identity/owner attribution; 21 require inherited-owner, shared-reference or control-plane classification.
- Production has no installed signed-context verifier or the proposed auth-private functions at the recorded inspection point.

**Impact:** application-side organization filtering is not a substitute for PostgreSQL tenant isolation. Enabling RLS while continuing to use the broad owner/runtime identity would not establish the intended boundary.

**Required:** independently inventory live role consumers; design separate NOLOGIN object owners, restricted app/auth runtimes and a controlled migrator; validate the complete ownership/grant transition on disposable Neon; build and test all table policies; prepare rollback and restore proof; only then seek explicit DBA/founder release approval.

### P0 — RLS request transaction wrapper is not integrated

`apps/src/rls-request-transaction.ts` implements a signed, transaction-local request context and deliberately rejects unsupported bilateral scope. The server and route modules still use shared-pool `pool.query()` and manual `pool.connect()` transactions. The helper is not the universal request SQL boundary.

The existing tenant-context inventory recorded approximately 318 query call sites and 15 connect call sites across 13 API modules. The current branch still has many direct route SQL paths.

**Impact:** do not enable tenant-table RLS or claim end-to-end tenant isolation yet. A GUC/token helper that is not used by every applicable query gives no protection to those queries. A naive outer transaction is unsafe because some routes issue their own BEGIN/COMMIT/ROLLBACK.

**Required:** instrument Fastify request lifecycle with one verified context per request; migrate or safely adapt every route query and existing transaction; explicitly separate public/auth/bootstrap/worker paths; test async-context propagation, nested transactions, concurrent requests, connection reuse, rollback and revocation. Use a distinct bilateral policy/context design for settlement payer/payee access rather than bypassing the single-org guard.

### P0 — Runtime-role compatibility is incomplete

The existing static compatibility inventory identifies remaining direct protected-table use, including:
- `platform-admin-routes.ts`: 49 SQL call sites in current static scan; direct identity/session/membership/role/organization/application workflows remain.
- `server.ts`: direct membership/geography-scope queries remain alongside function-backed helpers.
- `value-routes.ts`, `registry-routes.ts`, `sync-routes.ts`, `workspace-routes.ts`, `cpcb-swm-routes.ts`, `intelligence-routes.ts`, `mrv-routes.ts` and other modules retain direct authorization/data SQL that needs table-by-table review.
- The current app runtime contract explicitly denies direct auth-table privileges, while these handlers still depend on some direct reads/writes.

**Impact:** a successful startup preflight cannot prove that every route can execute with the proposed grants. Some routes will fail at runtime or lack the required scoped authorization if credentials are cut over prematurely.

**Required:** complete a route-by-route function/grant matrix; convert platform-admin, onboarding, geography, device, field-sync, CPCB, MRV, intelligence, evidence and registry operations to reviewed identity/authority-bound functions or a verified RLS transaction boundary; test each route under the exact proposed app/auth roles, not a superuser CI connection.

### P0 — Initial platform authority remains a controlled bootstrap dependency

The two-custodian bootstrap implementation and synthetic CI exercise exist. CI #4518 passed; the forged-role negative test in CI #4521 also passed. The database guard correctly rejects direct reserved-role activation without dual control.

Still required before any production ceremony:
- Founder selects two distinct initial authority identities and the trusted IdP/identity verification model.
- Independent security reviewer validates token/secret custody, owner/function ACLs, trigger exception, audit chain and recovery/revocation.
- DBA provisions the exact NOLOGIN owner and temporary migration privileges under change control.
- Two separate single-use secrets are issued out of band and consumed by the two distinct custodians.
- Post-ceremony evidence proves exactly two verified initial authority memberships and a consumed, immutable ceremony.

**Impact:** no production authority exists to lawfully perform first onboarding or approve reserved-role grants. Synthetic CI identities do not satisfy founder identity selection or production trust.

### P1 — The 67-table tenant policy model is not complete

Existing discovery classifies 46 direct-attribution tables and 21 without direct tenant keys. That is a useful baseline, not a policy specification.

**Required:** for each table record owner, tenant key or parent-derived owner, permitted reader/writer, regulator/system-worker access, insert/update/delete behavior, append-only rules, FK consistency, indexes, views/functions/triggers/grants and adversarial test cases. Explicitly model multi-party EPR/settlement/registry visibility, identity-owned data, child tables, global regulatory references and platform control/migration tables. No blanket policies based on column names.

### P1 — Migrations and database governance need full reconciliation

The branch includes a long ordered migration history and recent auth/bootstrap/verifier migrations. CI validates a fresh PostgreSQL application of the repository migrations. That does not prove equivalence to production's recorded 92 applied migrations or prove a safe upgrade path from the live schema.

**Required:** reconcile repository migration ledger against the authoritative Neon branch read-only; detect drift, duplicate objects, untracked/manual DDL, ownership, default privileges, PUBLIC grants, SECURITY DEFINER owners/search_path, trigger ordering and migration principal requirements. Build forward/rollback or restore procedures. Do not rewrite historical migrations or fill intentional numbering gaps.

### P1 — External integrations and MRV acceptance are not field-proven

Code paths and fail-closed checks exist for Guardian/Hedera/Mirror Node, but there is no evidence in the current TRL assessment of a live authorized end-to-end submission/consensus/retrieval round trip accepted by an external counterpart. CPCB/CCTS acceptance is also not evidenced.

**Required:** sandbox credentials and authorization; real external round-trip; exact transaction/consensus/Mirror Node evidence; retry/idempotency/reconciliation tests; independent methodology review; statutory portal or authorized counterpart acceptance. Testnet configuration is not production registry acceptance.

### P1 — Hardware/edge and operating evidence are not established

The current TRL report rates edge/physical instrumentation approximately TRL 2–3. There is no complete evidence of calibrated field instruments, deployed secure edge stations, sustained telemetry, device attestation, offline synchronization under real connectivity, field maintenance or measured chain of custody.

**Required:** approved device BOM and regulatory/MeitY eligibility review; calibration certificates and traceability; secure provisioning/key rotation; sensor-to-platform data lineage; site acceptance and continuous field data; offline/replay/tamper tests; field support and replacement procedures.

### P1 — National operational readiness is unproven

There is no demonstrated real urban/rural stakeholder workflow, verified multi-tenant production operation, sustained support model, DR/restore/failover evidence, performance/SLO baseline, incident response exercise, or independent field evaluation in the current TRL evidence.

**Required:** representative pilot(s), real authorized participants, training and SOPs, operational monitoring, support/escalation, backups and restore drills, load/failure testing, data retention/privacy controls, independent evaluation and repeatable multi-site evidence.

### P2 — CI and supply-chain assurance can be strengthened

Current CI passes dependency audit for production dependencies, migration validation/application, typecheck/build, synthetic bootstrap acceptance, browser smoke, API/PostgreSQL tests and container build. This is valuable laboratory evidence.

Remaining assurance work:
- audit development/toolchain dependencies and lockfile reproducibility;
- add secret scanning, static analysis, dependency/SBOM provenance, container scanning and signed release artifacts;
- enforce branch protection/review ownership and required independent approvals;
- add migration upgrade-from-production-snapshot tests, exact-role integration tests and policy coverage thresholds;
- test web authorization flows and API contract coverage beyond smoke rendering.

## 4. Verified current state

| Area | Current evidence | Decision |
|---|---|---|
| PR #192 | Open, draft; canonical integration spine | Keep draft; no merge |
| CI #4518 | Passed on code commit `434ec340` | Lab acceptance evidence |
| CI #4521 | Passed on forged-role negative-test commit `ec527314` | Lab acceptance evidence |
| Initial platform bootstrap | Synthetic two-custodian path tested | Production ceremony blocked |
| Production Neon | 67 public tables; 0 RLS; broad owner role at last read-only audit | HOLD |
| Request-context wrapper | Implemented but not integrated across all route SQL | RLS rollout blocked |
| Runtime compatibility | Direct route SQL remains; exact-role route matrix incomplete | Cutover blocked |
| Guardian/Hedera/CPCB/CCTS | External production acceptance not evidenced | Not verified |
| Edge hardware | Architecture/interface work; no calibrated field proof | Not verified |
| TRL | Conservative system-level provisional TRL 3 | TRL 9 not established |
| Render | Main deployment remains separate from draft PR; no PR deployment | Do not merge into auto-deploy path |

## 5. Accelerated execution plan — critical path

Run independent *read-only/investigation* workstreams in parallel. Merge implementation only through the canonical branch, with one authoritative migration per database object and exact-head CI after each batch.

### Workstream A — Repository and runtime inventory (first gate)
1. Enumerate every package, API module, frontend route, worker, script, scheduled job, migration, database function, trigger and external connector.
2. Generate machine-readable inventory of SQL call sites, connection creation, transaction boundaries, auth checks, tenant filters, direct protected-table access and side effects.
3. Refresh the 14-module API compatibility matrix against current branch; add every worker/CLI and frontend path.
4. Establish route contract tests for every authenticated endpoint and identify endpoints without explicit organization/role/scope checks.
**Exit:** complete file/route/worker register with owner, risk, test and remediation status.

### Workstream B — Identity, onboarding and authority (P0)
1. Finish forged-role, wrong-organization, missing-permission, geographic-scope, revoked-session, suspended-identity, self-approval and concurrent-approval negative tests.
2. Test bootstrap replay, expiry, two-custodian separation, claim consumption, audit immutability and failure atomicity.
3. Convert remaining platform-admin direct SQL operations to narrow database functions; retain dual control.
4. Founder identity/trust-model decision; independent security review; DBA role provisioning plan.
**Exit:** full identity lifecycle acceptance under exact app/auth roles; bootstrap production ceremony approved but not executed until separate explicit authorization.

### Workstream C — Tenant model and RLS (P0)
1. Complete 67-table classification and policy matrix; map child/multi-party/global/control tables.
2. Reconcile live database catalog and migrations read-only.
3. Integrate signed context into every applicable request query; refactor manual transactions safely; build bilateral settlement context.
4. Provision owners/runtime roles only in disposable Neon; install policy groups there.
5. Run adversarial A/B tenant SELECT/INSERT/UPDATE/DELETE, null-context, forged/expired/replayed token, revocation, pool-reuse, concurrent-request and cross-parent-FK tests.
**Exit:** 67/67 tables classified; every tenant table has approved policy or documented non-tenant exception; no unexplained direct access; exact-role route and worker suite passes.

### Workstream D — Domain correctness, MRV and regulatory evidence (P1)
1. Audit calculation packages and methodology versions for source, formula, units, uncertainty, boundary, leakage, additionality, permanence, double counting and reproducibility.
2. Validate SWM/BWG/EPR/CCTS rules against effective official sources and preserve source/version/effective dates.
3. Validate chain-of-custody quantities, weighbridge reconciliation, sampling, measurement uncertainty and audit evidence.
4. Complete Guardian/Hedera/Mirror Node authorized sandbox round trip; preserve external proof and distinguish submission from consensus and final acceptance.
5. Audit registry/settlement state machines, idempotency, two-party authorization and external financial confirmation.
**Exit:** independent numerical/regulatory review; no issuance/settlement eligibility without complete verified evidence.

### Workstream E — Edge hardware and field operations (P1)
1. Freeze site-specific and reusable hardware reference architecture/BOM.
2. Verify device origin, applicable MeitY/TEC/BIS requirements and procurement evidence; do not claim 100% domestic manufacture without component provenance.
3. Calibrate instruments and establish traceable measurement records.
4. Implement device identity, secure key provisioning, attestation, signed telemetry, offline buffering and replay protection.
5. Execute controlled field acceptance with measured waste flow, weighbridge, sensor cross-checks and operator SOPs.
**Exit:** calibrated hardware operating continuously at a real site with independent data-quality acceptance.

### Workstream F — Production engineering and operations (P1)
1. Verify Render configuration, secrets and current deployed commit without exposing secret values.
2. Establish a dedicated migrator, owner and runtime roles; backup/restore and rollback.
3. Add logs/metrics/traces, SLOs, alerting, incident runbooks, key rotation and vulnerability response.
4. Run load, soak, failover, backup restore, disaster recovery, offline recovery and security tests.
5. Stage release with a controlled canary and explicit rollback decision.
**Exit:** signed production-readiness evidence, independent security review and accountable operations owner.

### Workstream G — TRL assurance (P1)
Maintain separate TRL ratings for software, MRV methodology, external integrations, edge hardware, field operations and the integrated system. Raise the system rating only when the weakest critical component and end-to-end operational evidence justify it. Prepare an evidence index mapping each TRL claim to test reports, calibration records, external receipts, site logs, user acceptance and independent evaluator findings.

**Exit:** independent assessor confirms repeatable real-environment operation and the full system-level TRL 9 evidence package. A passing CI run or production deployment alone is insufficient.

## 6. Delivery sequence and time ranges

These are planning ranges, not guarantees. They assume access to engineering environments, founder decisions, site operators, independent reviewers, regulatory counterparties and hardware.

| Milestone | Planning range from active execution | Dependency |
|---|---:|---|
| Complete code/route/worker inventory and prioritized backlog | 1–2 weeks | Repository access and CI |
| Close auth/bootstrap negative tests and route authorization blockers | 2–4 weeks | Founder trust-model decision for production path; synthetic CI can continue meanwhile |
| Complete table policy model and integrated RLS in disposable Neon | 3–6 weeks | Workstreams A–C |
| Exact-role end-to-end staging, migration reconciliation, restore/security review | 4–8 additional weeks | RLS and runtime role contracts |
| First representative pilot with calibrated instruments and external round trips | 3–6 months | Site, partners, calibration, sandbox/authority access |
| Sustained pilot, independent evaluation and repeatable multi-site operation | 6–18+ months | Real operations, measured outcomes and external acceptance |
| System-level TRL 9 | Indicatively 12–24+ months overall; may take longer | All critical components proven in operational environments |

The fastest responsible route is to parallelize repository inventory, regulatory evidence, hardware procurement/calibration planning and partner/sandbox preparation while the P0 identity/RLS controls are engineered. Do not parallelize production changes or bypass security gates.

## 7. Immediate next 10 engineering actions

1. Finish and publish the full route/worker/SQL inventory from the current branch.
2. Add non-platform-organization and geographic-scope denial tests; verify CI exact-head.
3. Add session revocation, identity suspension, replay, concurrent approval and audit immutability acceptance tests.
4. Convert platform-admin direct SQL to identity-bound `auth_private` functions.
5. Design and test a request transaction adapter for existing nested/manual transactions before touching all route paths.
6. Build the 67-table ownership/reader/writer/RLS matrix and FK-derived ownership map.
7. Reconcile production migration/catalog state read-only against repository history.
8. Build disposable Neon exact-role integration with no superuser execution in application acceptance.
9. Audit all domain packages, frontend workflows, external integrations and workers; publish separate evidence gaps.
10. Create pilot acceptance protocol with calibrated measurement chain, external MRV evidence, operational SOP and independent evaluator.

## 8. Non-negotiable safety boundaries

- Production Neon remains read-only until explicit change approval, independent review, backup/rollback and exact-role staging evidence.
- Do not enable RLS on production while the broad `rupaykg` owner/runtime boundary remains.
- Do not merge PR #192 while Render auto-deploys `main` and required production auth roles/functions/secrets are not installed and validated.
- Do not provision production authority identities or secrets without founder selection and two-custodian approval.
- Do not issue carbon credits, represent statutory compliance, or claim external registry/CPCB/CCTS acceptance without authoritative evidence.
- Do not claim TRL 9 without independent real-environment operational validation.

## 9. Canonical continuation

Continue from PR #192 and its current resume pointer. Do not resurrect superseded duplicate PR implementations. Every engineering batch must:
1. identify the precise risk and acceptance criterion;
2. make the smallest coherent change;
3. add positive and negative tests;
4. run exact-head CI;
5. update this audit, the canonical resume pointer and issue blockers;
6. report only verified outcomes and the next dependency.

**Current decision: engineering may proceed aggressively in disposable CI/staging and repository code. Production remains HOLD. System-level TRL remains provisional 3; TRL 9 is not established.**
