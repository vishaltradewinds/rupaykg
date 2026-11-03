# RupayKg — Repository AIM & Whole-Repository Reconciliation

**Audit date:** 2026-11-03 (UTC)  
**Repository:** `vishaltradewinds/rupaykg`  
**Baseline:** `main` at `a3fecc0abd2c46549a201058d3963afc0e3a73c9`  
**Disposition:** Engineering reconciliation in progress; production certification **HOLD / OFF**.

> This is a read-only repository, deployment-metadata and Neon-schema reconciliation. It does not authorize production DDL/DML, migrations, role/grant changes, RLS activation, worker/scheduler activation, external transactions, deployments or certification.

## 1. Governing AIM — product truth

RupayKg is **India's Circular Economy Operating System** and the operating system for trusted environmental resource flows. It is a pan-India operational and compliance platform, not a carbon-credit calculator, a single-site pilot application, or a dashboard-only product.

Its purpose is to connect real-world waste and biomass activity to trustworthy measurement, evidence, regulatory applicability, controlled MRV and verification, environmental-value eligibility, credentials/registry and governed settlement/reporting.

The platform must optimize for **trust, compliance, auditability and operational utility**—not screen count or displayed credit volume.

### Non-negotiable operating lifecycle

`Actor / Organization → Authorized Geography → Real Activity / Resource Flow → Measurement → Evidence → Regulatory Applicability → Methodology / Obligation → Independent Verification → MRV / Provenance → Eligibility → Credential / Registry → Transfer / Retirement → Settlement / Reconciliation → Reporting`

The state boundaries are mandatory:

`Captured ≠ Authoritative ≠ Measured ≠ Evidenced ≠ Verified ≠ Guardian-verified ≠ HCS-consensus-confirmed ≠ Value-eligible ≠ Officially issued ≠ Settled`

A database write is not external consensus. Guardian acceptance is not statutory approval. Internal eligibility is not an official certificate. A settlement workflow is not proof that funds moved.

### National operating model

One common trust core must support distinct but connected operating contexts:

- **Urban:** State → District → ULB/Municipal Corporation → Ward → Facility → activity.
- **Rural:** State → District → Block → Gram Panchayat → Village/cluster → producer/FPO/facility → activity.
- **Enterprise / EPR / BWG:** entity and statutory applicability → obligations → evidence → reporting and authority references.
- **Carbon / MRV:** mechanism and methodology eligibility → measurement → evidence → independent verification → external provenance → authority-governed issuance/registry boundary.

Jabalpur SITE-JBP-01 / Kathonda is a pilot validation site within the national architecture. It must not become a hard-coded national boundary or a replacement for pan-India facility, geography, stakeholder and resource-flow models.

### Statutory and trust boundaries

- SWM 2026 is the current solid-waste baseline documented in the product requirements; other waste streams retain their own applicable rules and competent authorities.
- EPR is a family of scheme-specific mechanisms, not one generic credit.
- Indian statutory requirements, CCTS/ICM mechanisms, permits, voluntary standards and ICVCM Core Carbon Principles must remain distinct and versioned.
- RupayKg does not itself grant statutory registration, accreditation, CPCB acceptance, EPR certificate issuance, carbon-credit issuance or government approval.
- AI is advisory and source-grounded; it cannot mutate authoritative business state or fabricate evidence, quantities, verification, credits or settlement.

**Canonical product sources:** `docs/PLATFORM-CORE-OBJECTIVES-AND-REGULATORY-ALIGNMENT-2026.md`, `docs/PRODUCT.md`, `docs/PRODUCTION_TARGET.md`, `docs/DOMAIN-MODEL.md`, and `docs/SECURITY.md`. This reconciliation is the current repository-level status record; those product principles remain governing.

## 2. Mainline inventory (observed)

At the audited main commit:

| Surface | Inventory |
|---|---:|
| Git-tracked files in recursive tree | 319 |
| API application source files under `apps/src` | 42 |
| Web source files under `apps/web/src` | 31 |
| Test/spec files matching the repository inventory pattern | 39 |
| Domain/workflow packages | 5 (`domain`, `carbon`, `compliance`, `esg`, `intelligence`) |
| SQL migration files in `migrations/` | 91 |
| Public tables in authoritative Neon main | 67 |
| Mainline migration ledger rows in Neon | 92 |

The source is a monorepo with a TypeScript/Fastify API, React/Vite web application, domain-oriented packages and PostgreSQL migrations. Existing functional areas include identity/onboarding, geography, resource flows, field/offline sync, measurement/MRV, Evidence Vault, statutory applicability, CPCB/SWM/BWG, EPR, ESG, carbon methodologies/calculations, credentials/registry, settlement and advisory intelligence.

The mainline tree contains tests and UI/API modules across these areas. Their presence is **not** proof that every stakeholder journey is complete, legally accepted, production-secure or live-integrated. A route/screen/package is not an end-to-end product acceptance result.

The CDPI Wave 1 route/authorization inventory in PR #230 records 56 mainline API route declarations and maps route families to data/test coverage. A general machine-readable OpenAPI contract was not found in that reviewed tree; derive contracts from actual route schemas/validators rather than inventing one.

## 3. Source, deployment and database authority

### GitHub source

- Canonical repository: `vishaltradewinds/rupaykg`.
- Default branch: `main`.
- Audited main SHA: `a3fecc0abd2c46549a201058d3963afc0e3a73c9`.
- `rupaykg-aistudio` is reference-only for design/domain comparison; do not replace the canonical implementation with its architecture.
- The main branch is the source of truth for current code. Open PR branches are proposals, not production code.

### Render service

Render metadata currently identifies service `rupaykg` (`srv-daki4d7qj5pc73b8qksg`), connected to this repository, branch `main`, auto-deploy enabled, free plan, Singapore region, public IP allowlist `0.0.0.0/0`, health path `/health`.

The latest observed live deployment is `dep-dbjo4dqvcj2c73f7bt00`, commit `a3fecc0abd2c46549a201058d3963afc0e3a73c9`. This confirms a live Render service and deployed commit; it does **not** prove that its `DATABASE_URL` targets the Neon project/branch audited below, that real organization workflows work, or that external Guardian/Hedera acceptance is complete.

### Neon database

The connected Neon account exposes project `steep-mud-79906940`, named `rupaykg-production-fresh`, region `aws-us-east-2`. Its primary/default branch is `main` / `br-restless-base-b44cip2h`, database `rupaykg`.

This is the authoritative Neon candidate used for this audit, but the Render-to-Neon connection binding must be independently confirmed before claiming that the deployed service uses it.

Read-only main-branch inspection on 2026-11-03 found:

- 67 public base tables; all 67 owned by role `rupaykg`.
- 0/67 tables with RLS enabled; 0/67 with FORCE RLS.
- Runtime/database owner role `rupaykg` has `BYPASSRLS`, `CREATEDB` and `CREATEROLE`.
- `cloud_admin` is a superuser; provider roles also carry elevated capabilities.
- 115 public functions; 0 are SECURITY DEFINER; all 115 report PUBLIC EXECUTE.
- The Neon branch is not protected; the project metadata shows no IP allowlist entries and public connections are not blocked.
- The branch is not protected and the project is on the free_v3 tier with a 10-branch limit; 9 active branches were observed.

**P0:** the current production database does not provide database-enforced tenant isolation. Application-level tenant checks are still required, and the production owner/BYPASSRLS posture prevents claiming that RLS protects tenants. Do not enable RLS globally as a shortcut.

### Staging and lab branches

The Neon branch `br-spring-hill-b4544vz5` (`rupaykg-gov-inbox-staging-20261020`) is a non-authoritative staging branch. It has 95 migration-ledger rows, latest `20261025`, 71 public tables and 0 RLS / 0 FORCE RLS. It contains four additional migration records and tables for async mirror inbox/worker leases and AI intake that are not present in the current main migration source tree.

The tenant-isolation and RLS-assurance lab branches are rehearsals, not production proof. Their policies cannot be inferred to protect production. No lab branch is authorized as an alternative production database.

## 4. Migration source / ledger reconciliation — P0

Main source contains 91 SQL migration files (001–087 plus dated 20261018–20261021). Production Neon records 92 applied rows:

- Production includes `096_verification_authorization_provenance.sql`, applied at `2026-10-27T13:46:14.262Z`, but that exact source file is absent from current main.
- Git history records the migration source in commit `ca8f4100782e13f8d72106187fafc8e1e446214f` and its removal in `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`. Render deployment history places the `ca8f410` deployment between 13:44:53 and 13:46:30 UTC, overlapping the production ledger timestamp. Preserve the recovered SQL as immutable evidence and independently review it; do not replay it.
- Staging has four additional applied migrations: `20261022_async_mirror_inbox.sql`, `20261023_async_mirror_worker_leases.sql`, `20261024_ai_intake_rate_limits.sql`, `20261025_ai_evidence_intake_jobs.sql`. Their exact source and tests are not in the current main migration directory. Do not copy or apply guessed SQL.
- `migrations/README.md` incorrectly says migration 023 is absent. Main contains `023_lifecycle_state_guards.sql` and production records it. This is a documentation defect, not a migration gap.
- The production and staging schema histories differ; table counts differ (67 vs 71). No ledger rewrite, checksum fabrication, migration replay, historical migration edit, or data deletion is permitted.

Required order: recover exact historical source and provenance; map each ledger row to exact filename/checksum and schema effect; recover staging-only source; compare objects and reference data; create forward-only reviewed corrections; rehearse on disposable PostgreSQL; prove data preservation and restore; obtain independent DBA/security review. Keep live Neon read-only.

## 5. Security and authorization — release-blocking

### Tenant isolation

Tenant isolation is a cross-cutting requirement for every read, list, detail, upload, download, mutation, report, export, background job, sync envelope and external callback. The trusted organization must come from validated server context; a client-supplied organization/geography is never authority.

A signed tenant transaction helper does not itself filter rows if a route fails to bind the requested resource to the signed active organization. Every protected read/write must perform resource lookup, organization/geography checks, permission checks and mutation on the same tenant-bound transaction client wherever the operation requires atomicity.

Acceptance must include at least two real tenants and negative tests for cross-tenant IDs, parent-child substitution, multi-membership active-organization switching, ambiguous/bilateral scope, untrusted headers, suspended/unverified identities, geography mismatch, missing permission, rollback on denial/failure and export/download leakage.

### Verification authorization — P0 issue #215

The current open P0 finding records conflicting database-trigger semantics: a legacy independence trigger can use a global membership lookup and role-name fallback, while the stricter authorization function does not uniformly enforce same-organization authorization for every decision. Candidate migrations in PR #192 also reintroduce role-name fallback and fail-open geography behavior in reviewed versions.

The canonical rule must be:
1. Every decision is tied to the subject activity's exact organization.
2. Identity and membership are verified and not suspended/revoked.
3. Explicit permission keys are required; role names never grant verification authority.
4. Geography must be verified and in scope; missing scope fails closed.
5. Self-verification is rejected and independent reviewer separation is enforced.
6. Approved decision snapshots are immutable; corrections are superseding records.
7. Any SECURITY DEFINER routine has a pinned least-privilege NOLOGIN/NOBYPASSRLS owner, fixed search_path and narrowly granted EXECUTE/table privileges.

Do not apply candidate migrations until these invariants and negative PostgreSQL tests are independently reviewed.

### Other route-level findings

- Evidence Vault active-organization boundary is being corrected in PR #232; exact-head CI passed, but independent review is still absent.
- MRV workspace signed reads in #218 and evidence-verification writes in #229 remain draft and require complete two-tenant PostgreSQL acceptance and review.
- EPR obligations has overlapping implementations: #213 (based on #192, currently not mergeable) and #228 (based on #216). Keep one canonical route. Preserve #228's bilateral-scope, multi-membership, untrusted-selector and rollback tests; its prior overall CI failure involving an Evidence Vault artifact-version listing assertion must not be weakened.
- BWG workspace read authorization has duplicate candidates #194 and #231. Reconcile their bases, behavior and tests before selecting one.
- Route-level authorization and tenant-scoped data access must be checked independently of UI permission metadata.

## 6. Active PR topology and reconciliation register

All items below were observed open and unmerged at audit time unless stated otherwise. No PR is merge-approved by this document.

| PR | Purpose / dependency | Current disposition |
|---|---|---|
| #192 | Authentication/bootstrap integration, base main | Draft foundation; large 96-file change. Review migration semantics against issue #215 before downstream integration. |
| #213 | EPR read route, based on #192 | Draft; 52 files, mergeable=false at audit; no current exact-head CI evidence for latest head. Do not merge as-is. |
| #216 | Verifier identity / tenant hardening, based on an EPR security base branch | Draft; upstream base lineage must be reconciled before merge. |
| #218 | MRV workspace signed tenant reads, based on #216 | Draft; needs PostgreSQL A/B tenant acceptance. |
| #219 | Pilot demo UI, based on #218 | Draft; preserve as a demo surface, not production certification. |
| #229 | Evidence-verification writes, stacked on #218 | Draft; CI evidence exists for a prior exact head; complete A/B acceptance and review. |
| #232 | Evidence Vault active-organization binding, stacked on #229 | Draft; current head `ca403e962f9fa6c5f27a0e29151c47e27e42a614`; CI run #41615632245 passed all 18 validation stages including disposable PostgreSQL acceptance and production-container build; no independent review. |
| #228 | EPR obligations read, based on #216 | Draft; overlaps #213. Preserve its additional regression coverage and unresolved artifact-version assertion. |
| #230 | CDPI Wave 1 standards/licensing/route foundation, base main | Draft documentation foundation; current head is ahead of main; latest head has no recorded exact-head CI run. |
| #227 | DPI acceptance assessment | Draft; coordinate with #230 rather than duplicating standards inventory. |
| #231 | BWG workspace read guard, base main | Draft; exact-head CI passed on the recorded head; overlaps older open #194. |
| #194 | BWG workspace read guard, base main | Open non-draft; reconcile against #231 and select one canonical implementation. |
| #197 / #198 | RLS assurance programme and database-enforced RLS design | Open; design/specification only, not production RLS evidence. |
| #221 | Preserve recovered production migration 096 | Open draft; reconcile with issue #214 and immutable historical source. |
| #222 | Least-privilege role provisioning rehearsal specification | Open draft; necessary design evidence, not proof of production role posture. |

The open-PR search returned 100 results at its requested result cap; this is not a claim that exactly 100 PRs exist. Older and parallel work must be deduplicated by changed file, behavior, base SHA, migration identity and test evidence—not by title alone.

### Required branch policy

- No merging both implementations of one route.
- No merging stacked PRs before their parent/base lineage is canonical and independently reviewed.
- Rebase/replay only after preserving exact commit and test evidence; never silently rewrite migration history.
- For every candidate, record exact head SHA, base SHA, CI run tied to that SHA, review status, test coverage, and downstream dependencies.
- PR mergeability is a GitHub graph fact, not a security or product approval.

## 7. CDPI / DPG alignment

CDPI Wave 1 is an architecture and ecosystem-reuse discipline, not a proprietary turnkey platform to copy. Reuse open standards and suitably licensed components after due diligence; own RupayKg's domain model, regulatory applicability, workflows, evidence, audit trail, user experience, integrations and service economics.

The shared capability layer should be standards-aligned for identity/access, verifiable credentials, registries, consent/data exchange, discovery/fulfilment, provenance/evidence and governed APIs. Interoperability must be demonstrated through versioned contracts and independent partner/client conformance tests.

A component is not automatically a Digital Public Good merely because it is open source. Confirm licence, governance, security, maintenance, data protection, accessibility, interoperability and actual third-party reuse. CDPI/DPG qualification is not claimed. PR #230 is the Wave 1 foundation, not certification.

## 8. Product completeness and pilot truth

The repository has substantial foundations, but the following remain separate acceptance work:

- Stakeholder-by-stakeholder journeys for national/state/district bodies, ULBs, Gram Panchayats, BWGs, generators/PIBOs, collectors, transporters, processors/recyclers, PRO/EPR teams, verifiers/auditors, carbon project teams/buyers and registry/settlement operators.
- Regulatory applicability by entity, activity, waste stream, threshold, geography, source version and effective date.
- Reproducible EPR/ESG metrics with source, unit, boundary, period, methodology, missing-data/uncertainty and approval state.
- Urban and rural golden transactions through real authorization and database state.
- Evidence capture, chain of custody, measurement calibration, anomaly/double-count handling and independent verification.
- Live Guardian → Hedera HCS → Mirror Node round-trip with real execution/consensus references and persisted provenance. A workflow file or mock response is not live acceptance.
- Production backup/restore, RPO/RTO, monitoring, incident response, rollback, rate limits, field/offline recovery, accessibility, mobile/low-bandwidth and multilingual acceptance.
- Jabalpur pilot onboarding with real stakeholders and site evidence, without replacing the national data model.

The UI must clearly label demo/synthetic, captured, pending, unavailable, verified and externally confirmed states. The pilot demonstration may use synthetic data only when conspicuously labeled and isolated from production authority.

## 9. TRL and release decision

The current main branch does not contain an authoritative current `docs/TRL9_EXECUTION_PLAN.md`; the detailed plan exists in open PR/history rather than the audited mainline. The prior provisional software/platform TRL 4 assessment is historical and must be revalidated. No evidence reviewed here supports TRL 9.

TRL must be assigned per component and end-to-end operating system: software/domain, MRV methodology, instruments/IoT, edge/offline operation, external trust integrations, field deployment and national operating model. Each rating requires test environment, real evidence, limitations, independent reviewer and retest trigger.

**Current decision: RED / HOLD — production certification OFF.** A passing CI pipeline, live Render service, demo dashboard or database schema does not close tenant isolation, migration parity, legal approval, live external acceptance or operational resilience.

## 10. Dependency-aware execution order

1. **Repository reconciliation baseline:** keep this record and `docs/ECOSYSTEM_STATE.json` aligned; resolve duplicate/stacked PR topology; make mainline documentation truthful.
2. **P0 verification authorization (#215):** correct same-organization/permission/geography/identity/independence/immutability semantics; prove negative PostgreSQL cases.
3. **P0 migration source parity (#214):** recover 096 and staging-only source; reconcile ledgers/checksums/objects; rehearse forward-only changes on disposable PostgreSQL; preserve production read-only.
4. **Tenant-scoped API completion:** Evidence Vault, MRV, EPR, BWG, registry, sync, reports, downloads and exports; same-client transactions and two-tenant acceptance.
5. **Database isolation design:** classify every tenant/shared/reference table; design runtime and migration roles, RLS/FORCE policies, grants, SECURITY DEFINER ownership/search_path, and bypass analysis. Rehearse on disposable branches only.
6. **Independent review and production proof:** DBA/security/regulatory/methodology review, backup/restore, deployment-to-database identity proof, monitoring and rollback.
7. **Golden transactions and pilot:** real urban and rural paths plus Jabalpur pilot evidence; external Guardian/Hedera/Mirror Node acceptance.
8. **TRL assurance and CDPI qualification:** component TRL evidence and ecosystem interoperability/reuse/conformance proof.

No step is skipped because a later screen or integration appears ready. Independent work may proceed in parallel only where dependencies do not conflict; changes must be reconciled before integration.

## 11. Evidence limits and audit discipline

- **Audit depth:** this pass inventories the entire mainline tree and deeply reconciles the release-critical product, database, migration, authorization, deployment and active-PR surfaces. It is not a line-by-line independent code review of all 319 files; domain-specific route and stakeholder acceptance must continue through the mapped work packages.
- GitHub main tree, PR metadata, CI run #41615632245, Render service/deployment metadata and Neon read-only metadata/SQL were inspected on 2026-11-03.
- GitHub branch-protection API inspection was not available to the connected integration; do not infer protection settings from that failed read.
- Render service environment values were not read; the Render-to-Neon `DATABASE_URL` binding is unverified.
- No production data was modified and no production migration, role/grant change, RLS policy, branch deletion or deployment was performed.
- Re-run the inventory after main changes; this is a dated evidence snapshot, not a permanent claim that the repository cannot change.

**Next controlling blockers:** GitHub issues [#215](https://github.com/vishaltradewinds/rupaykg/issues/215) and [#214](https://github.com/vishaltradewinds/rupaykg/issues/214).  
**Current Evidence Vault candidate:** [PR #232](https://github.com/vishaltradewinds/rupaykg/pull/232).  
**Current CDPI Wave 1 foundation:** [PR #230](https://github.com/vishaltradewinds/rupaykg/pull/230).

---

## 12. Source-level audit addendum — 2026-11-03 10:35 UTC

This addendum records further direct source inspection on the canonical `main` SHA `a3fecc0abd2c46549a201058d3963afc0e3a73c9`. It supersedes no prior evidence and does not claim a complete line-by-line audit.

### 12.1 Production startup ordering — P0

Observed mainline files:

- `Dockerfile` (blob `502178d64801215c05abb10d74ccbc14bc97bd1c`) starts the container with: `node apps/dist/src/migrate.js && node apps/dist/src/acceptance-seed.js && node apps/dist/src/production-server.js`.
- `apps/package.json` (blob `a63906efbfd495110c705dffa762f51114759020`) starts with `node dist/src/acceptance-seed.js && node dist/src/production-server.js`.
- `apps/src/production-server.ts` calls `readProductionConfig()` before importing `server.js`, but this validated entrypoint is reached only after the Docker migration and seed commands.
- `apps/src/acceptance-seed.ts` performs database writes when `RUPAYKG_ACCEPTANCE_SEED_ON_START=true`; the mainline production config does not reject that flag before this script is invoked.
- `apps/src/production-config.ts` validates the production contract, but the current Docker command runs migrations and the optional seed before that validation.

**Finding:** the production configuration gate is too late in the container startup sequence. A misconfigured production environment can reach migration SQL before the validated production entrypoint runs. If the acceptance-seed flag is enabled, the seed script can write before production config validation. This is a release-blocking startup-order defect; it does not prove the flag is currently enabled in Render.

**Required correction:** one validated startup preflight must run before any database connection, migration, seed, or application import. Production must categorically prohibit acceptance seeding. The default production container must not silently perform schema changes or fixture writes at startup. Migration execution must be a separately controlled, reviewed operation after source/ledger reconciliation and explicit release approval.

Related existing work: PR #43 removes migration/seed execution from the container command but is based on an older mainline; PR #120 adds a startup-preflight before migration, but its candidate migration client still uses a non-verifying TLS configuration. Neither branch is approved for merge or production deployment. Port only reviewed, necessary behavior onto the current canonical base after exact-head testing; do not merge stale histories wholesale.

### 12.2 PostgreSQL TLS trust mismatch — P1

- Mainline `apps/src/migrate.ts` constructs its PostgreSQL pool with `ssl: { rejectUnauthorized: false }` unless `DATABASE_SSL=false`.
- Mainline `apps/src/server.ts` verifies the certificate when `DATABASE_SSL=require` and passes `DATABASE_CA_CERT`, but has a non-verifying fallback when the environment is not normalized.
- Mainline `render.yaml` sets `DATABASE_SSL=require`, but this does not override the explicit `rejectUnauthorized:false` setting in the migration runner.

**Finding:** application-pool TLS verification and migration-pool TLS verification are inconsistent. The migration connection can accept an untrusted server certificate while the API pool verifies it. Do not treat `DATABASE_SSL=require` alone as proof of certificate validation.

**Required correction:** share one tested TLS-policy helper across API, migration and any database-seed clients; production external connections must verify the configured CA/hostname. Internal database connections may disable TLS only when the production configuration has explicitly classified the destination as a trusted internal endpoint. Add tests for missing CA, invalid CA, TLS downgrade/connection-string overrides, and exact production startup ordering.

### 12.3 Mainline authorization and route-boundary observations — P0/P1

- `apps/src/auth.ts` selects the active organization from a requested organization selector after checking membership, otherwise defaults to the first verified membership. `canActForOrganization` relies on this active-organization boundary unless bilateral scope is explicitly enabled.
- Mainline `apps/src/epr-return-routes.ts` reads EPR returns using the general pool; its create and submit paths also use direct pool/client operations rather than the signed tenant transaction helper. Some authorization is performed before protected reads/writes, but this does not prove same-transaction tenant isolation under the intended restricted database role.
- Mainline `apps/src/workspace-routes.ts` still contains general-pool workspace reads and legacy verification mutations. The MRV workspace signed-read candidate #218 covers a specific workspace endpoint, not every route in the file.
- Mainline `apps/src/mrv-routes.ts` performs Guardian submission preparation, MRV provenance reads/writes and Mirror Node verification persistence through pooled queries. PR #218/#229 do not, by themselves, certify all MRV route families or all background/worker operations.
- Mainline `apps/src/server.ts` mounts several route families directly against the general pool. Route registration and permission metadata are not proof that each protected query uses one trusted tenant transaction.

**Required correction:** build a route-to-query inventory with, for each route, authentication source, active-tenant source, permission, geography rule, protected SQL statements, transaction/client identity, side effects, tests and downstream UI caller. Do not mark an entire module tenant-safe because one route in it has been corrected. Complete two-tenant adversarial PostgreSQL acceptance for each read, write, download, export, sync and callback path.

### 12.4 Guardian / Hedera evidence boundary

Mainline `render.yaml` sets `HEDERA_NETWORK=testnet`. The Hedera adapter accepts a configured network and reports a consensus timestamp when submission succeeds; the MRV route separately persists Mirror Node verification time before reporting registry eligibility.

**Finding:** repository code supports a staged Guardian/HCS/Mirror Node flow, but the current deployment blueprint explicitly defaults to Hedera testnet. This is not evidence of mainnet operation, external partner acceptance, statutory approval or registry issuance. A testnet round trip can validate integration mechanics only.

**Required correction:** keep environment/network labels visible in every stakeholder view and provenance record. Separate testnet acceptance from production network readiness; verify topic ownership, operator custody, policy version, Guardian execution, HCS transaction/consensus, Mirror Node payload match, retry/idempotency and independent evidence before any production eligibility claim.

### 12.5 Migration branch topology — do not duplicate or cherry-pick blindly

Direct GitHub metadata review found:

| PR | Branch relationship | Reconciliation decision |
|---|---|---|
| #108 | Dual-ledger runner acceptance; older base; currently non-mergeable | Preserve as historical test evidence; extract only tests that remain valid after comparing exact current runner behavior. |
| #107 | Orphan-ledger guard; older base; non-mergeable | Do not merge as-is. Its fail-closed behavior is a requirement, not a reason to retain stale branch ancestry. |
| #132 | Canonical history contract stacked on disposable-DB test branch | Dependency candidate, not standalone. |
| #134 | Canonical history guard based on older main | Fresh exact-head CI and base reconciliation required. |
| #148 | Preflight-before-bootstrap DDL and advisory-lock serialization; stacked on #134 | Stronger runner candidate; depends on #134 and needs current-main integration, PostgreSQL concurrency tests and independent review. |
| #179 | Captured production migration-ledger parity gate, based on main | Useful production snapshot gate; explicitly does not resolve staging-only source history or deployment-source provenance. |
| #139 / #140 | Disposable-only verification provenance regression/forward-fix tests | Keep as test evidence; no migration version or production SQL may be inferred from these fixtures. |
| #43 / #120 | Older production startup/TLS/safety candidates | Port only isolated reviewed fixes to current main; do not merge broad stale branches. |

The correct integration sequence is to select one canonical migration-history validator, one runner implementation, one authoritative production manifest plus a separate staging-history manifest, and one disposable PostgreSQL acceptance suite that exercises the actual runner. It must fail before DDL when any applied source is missing, any version/filename mapping is ambiguous, any source is unaccounted for, or environment identity is unknown. Session-level advisory locking must cover preflight and all migration execution on the same connection.

### 12.6 Newly confirmed workstream risks and status

1. **P0 — startup preflight ordering:** production database operations can precede validated config; optional seed can run before that gate.
2. **P1 — migration TLS:** certificate verification is disabled in the mainline migration pool.
3. **P0 — migration history:** production 096 and staging 20261022–20261025 source histories remain unresolved; parity CI does not reconstruct missing source or deployment provenance.
4. **P0 — verification authorization:** legacy trigger conflict and decision-snapshot immutability remain unresolved; use #215 as controlling issue.
5. **P0 — tenant boundary:** #218/#229/#232 are narrow, stacked changes; they do not establish full application or database tenant isolation.
6. **P1 — EPR/BWG duplication:** EPR #213/#228 and BWG #194/#231 require one canonical implementation each, with dependency and exact-head tests reconciled.
7. **P1 — external trust integration:** current Render blueprint points to Hedera testnet; mainnet/real Guardian evidence remains unproven.

**Audit status after this addendum:** repository inventory and selected critical-path source review are complete to this checkpoint; route-by-route and all-file independent review remains in progress. Production remains HOLD, certification OFF, worker activation OFF. No production database, deployment, branch protection, role/grant, migration, external transaction or credential was changed.


### 12.7 Candidate remediation review — PR #120 and PR #148

The candidate patches were inspected directly on 2026-11-03. This section distinguishes useful isolated changes from merge readiness.

**PR #120 — startup/safety candidate (branch `cto/batch1-production-safety`, base `main`):**
- Adds `apps/src/startup-preflight.ts`, which calls `readProductionConfig()`, and places it before migration and seed in the Docker command. It also adds a production-config rejection for `RUPAYKG_ACCEPTANCE_SEED_ON_START=true` and a defensive production guard inside `acceptance-seed.ts`.
- This is a meaningful correction to the Docker startup validation order. It is not the final release design: the Docker command still runs migrations automatically at every container start, followed by the optional seed script. The existing `apps/package.json` start script still invokes the acceptance seeder before `production-server.js`; this path must receive the same preflight/seed prohibition or be removed from production use.
- The candidate's `migrate.ts` still configures PostgreSQL TLS with `rejectUnauthorized: false`. It must not be adopted as the final migration runner.
- PR #120's CI patch adds migration-history acceptance, but the branch's migration implementation predates the stronger same-session advisory-lock and preflight-before-ledger-DDL behavior in PR #148.
- **Decision:** port the production seed prohibition and validated preflight concept to the canonical current-main startup design, but do not merge PR #120 wholesale or treat its Docker change as authorization for automatic production migrations.

**PR #148 — migration runner candidate (branch `fix/migration-ledger-preflight-order-2026-10-30`, based on `shakti/canonical-migration-history-verified`):**
- The inspected runner validates the migration catalogue, acquires a session-level advisory lock, checks whether the ledger exists, reconciles all applied rows before ledger DDL, and uses the same checked-out client for preflight and migration execution.
- It includes fail-closed connection disposal for lock acquisition/release uncertainty and rollback failure, plus unit tests and disposable-PostgreSQL concurrency/failure tests.
- These are the strongest reviewed runner mechanics among the inspected candidates. However, PR #148 is stacked on an older migration-history branch; its parent lineage, exact current-main replay, current CI and independent review remain unverified. Its PostgreSQL integration tests also need the shared verified TLS helper before use against any non-local database.
- The runner must be paired with exact source recovery for production 096 and staging 20261022–20261025. A better preflight cannot make missing historical source safe or resolve database/environment identity.
- **Decision:** retain PR #148 as the preferred migration-runner implementation reference. Replay/reconcile its isolated changes onto a current-main-based candidate only after validating PR #134/#132 ancestry, and run the exact-head disposable PostgreSQL suite. Do not merge the stacked branch as-is.

**Branch topology — PR #216 security chain:**
- PR #216 head is `8693239b28587fb61e0f61c2f2d021b97f073fba`; its declared base is `shakti/epr-security-base-2026-11-02` at `cd96ec579e2eda726b3fbe9e2d261f5b2ce9d832`.
- PR #218 is stacked on #216; #219 is stacked on #218; #229 is also stacked on #218; #232 is stacked on #229. These relationships are explicit in the PR metadata and must be preserved.
- A branch comparison against the current `main` reported a diverged history for the named EPR security base (567 commits ahead / 2 behind in the connector's comparison response). This unusually large ancestry delta requires commit-graph and merge-base inspection before any rebase, cherry-pick or merge. It is not evidence that 567 new feature commits should be integrated.
- **Decision:** freeze the stack's current heads as evidence; do not rewrite or merge the chain until the base lineage and per-PR exact-head CI are reconciled. Keep the pilot UI #219 downstream of the security read path; do not detach it and bypass authorization.

**Exact-head validation update:** the documentation-only PR #233 commit `9793d96eb7cfd1003ef0ac64f1fc7a746f083c1b` now has GitHub Actions CI run #41620872867 completed with conclusion `success`. This validates the documentation branch's configured CI only; it does not validate application code or authorize a merge.

**Next implementation batch:** (1) create one current-main startup/preflight candidate with no automatic production migrations or fixture seeding; (2) port the verified TLS policy into API, migration and seed clients; (3) reconcile the #148 runner with canonical migration history on a fresh branch; (4) recover exact historical source manifests; (5) inspect the full #216 base commit graph before touching the stacked tenant-security PRs. Production remains read-only and HOLD.


### 12.8 Current-main startup/TLS remediation candidate — PR #234

A focused current-main-based draft PR was opened: [#234 — isolate production startup and verify PostgreSQL TLS](https://github.com/vishaltradewinds/rupaykg/pull/234), branch `shakti/current-main-startup-tls-hardening-2026-11-03`, base SHA `a3fecc0abd2c46549a201058d3963afc0e3a73c9`, head SHA `c7d4b5431dd3aa8dd110a42cb295f9f420725419`.

Observed candidate changes:
- Docker production command and API package start script now invoke only `production-server.js`; normal startup no longer invokes the migration runner or acceptance fixture seeder.
- Production configuration rejects `RUPAYKG_ACCEPTANCE_SEED_ON_START=true`; the fixture seeder independently refuses to run under `NODE_ENV=production`.
- API, migration and acceptance-seed PostgreSQL pools now share `createDatabasePoolConfig`.
- The helper strips connection-string TLS query parameters before constructing the pool, requires verified TLS for external production PostgreSQL connections, and allows plaintext only for the Render private-host form when production configuration explicitly normalizes `DATABASE_SSL=false`.
- Added unit tests for URL-level TLS downgrade attempts, CA/system trust, private Render host handling, invalid connection schemes and the production seed prohibition.

**Review limitations / release gates:**
- PR #234 is draft. At the first exact-head check, no PR workflow run or combined status had yet been returned for head `c7d4b543...`; do not claim tests or CI passed.
- The Render private-host pattern must be confirmed against the actual deployed `DATABASE_URL` hostname before relying on the plaintext exception. Render environment values were not read; no live connection was attempted.
- Review Node-postgres URL parsing and TLS behavior against the pinned dependency version in CI; test real certificate/hostname rejection against a disposable PostgreSQL TLS endpoint, not production.
- Confirm every database client in all worker/background entrypoints uses the shared helper; this candidate covers the main API pool, migration CLI and acceptance fixture seeder only.
- Production migration history remains unresolved; separating migration execution from startup does not authorize running the CLI.
- No production deployment, database change, seed, migration or external transaction was performed.

**Disposition:** retain #234 as the current startup/TLS remediation candidate. Do not merge, deploy or remove draft status until exact-head CI, disposable PostgreSQL TLS acceptance, current Render private-host validation and independent security review are recorded.


### 12.9 Exact legacy migration fixture recovery and verifier candidate review

**Recovered source fixtures — PR #108 (shakti/dual-ledger-compatibility-tests):**

The following exact files were fetched from the historical PR branch. SHA values below are Git blob IDs for the recovered fixture files, not SHA-256 checksums and not proof of deployment:

| Historical fixture path | Git blob ID | Embedded upstream provenance |
|---|---|---|
| scripts/fixtures/legacy-migrations/096_verification_authorization_provenance.sql | 258b1f4534efbf915688f78aa84d4ec24a47cbc0 | historical RupayKg migration; matches previously recovered 096 blob |
| scripts/fixtures/legacy-migrations/20261022_async_mirror_inbox.sql | da7bad12d12d791cc4bd75e772eca05c42dc3760 | intelligence/ai-evidence-intake-middleware, commit c56b9c1, upstream blob 4d08607e03561b9fbb4ce502b4c4211127237050 |
| scripts/fixtures/legacy-migrations/20261023_async_mirror_worker_leases.sql | c1482ba72286657e8ef17bdd5cd6324a1c353af0 | intelligence/ai-evidence-intake-middleware, commit c56b9c1, upstream blob 33cb4d5d2e29a4a111340e5a0ac34170a0081895 |
| scripts/fixtures/legacy-migrations/20261024_ai_intake_rate_limits.sql | 95a4d8ea93b5acf48927634406ecc7d2fc05f313 | intelligence/ai-evidence-intake-middleware, commit c56b9c1, upstream blob 87b51fe60a96a4e0752c8b0a9a170c81f9936dbb |
| scripts/fixtures/legacy-migrations/20261025_ai_evidence_intake_jobs.sql | 169aeebbe44b31d2c43f86f39f2acada33bc52aa | intelligence/ai-evidence-intake-middleware, commit c56b9c1, upstream blob 6a0ae54530b7b756dac33589eaf18df3b071d8f2 |

The four 20261022–25 fixtures are recoverable from the historical PR branch and reside in a test-only legacy-fixture directory. Do not move them into migrations/, include them in the production migration catalogue, or apply them until upstream repository/commit/blob provenance is independently fetched and byte-compared, and the staging catalog is reconciled against exact SQL semantics. In particular, 20261023 adds an append-only inbox event table and trigger; 20261025 adds durable AI evidence-intake idempotency/lease state. Review tenant ownership, RLS, worker principal, retention and data-classification boundaries before any activation.

Migration 096 remains historical evidence only. Its exact blob and limitations are recorded in PR #204's recovered-source provenance note. Do not replay it or treat it as the final verifier authorization design.

**Verification candidate — PR #213 (security/epr-explicit-client-read-2026-11-02):**
- Latest inspected head: 8c32583683320642e15bb48f43454d87d5537917; PR remains draft and connector reports mergeable=false.
- Candidate migrations 20261106/07 remove role-name fallback, bind verified membership to the activity organization, check verified/non-suspended identity, apply authorization to APPROVED and REJECTED, and remove the legacy global-membership trigger. Candidate 20261108 fails closed for missing geography scope and bounds recursive traversal with a visited path and depth ceiling.
- The branch adds route coverage for EPR, BWG, CPCB-SWM, Evidence Vault, MRV, workspaces and value routes, plus an opt-in PostgreSQL verifier acceptance test. Issue #215 comments state the test is gated by RUPAYKG_RUN_DB_INTEGRATION_TESTS=1 and DATABASE_URL and had not yet been executed against PostgreSQL at that time.
- The candidate accepts three permission strings: VERIFY_EVIDENCE, verification:approve, and verification.approve. The canonical permission registry and migration history must establish whether the latter two are stable permission keys or legacy aliases; do not equate compatibility aliases with canonical authority without evidence.
- Review cycle handling against the stronger invariant that any encountered malformed cycle must fail closed, including a verified scope node inside the cycle. Bounded traversal prevents unbounded recursion but must be shown to reject every corrupt-cycle authorization path.
- Verify immutability for all fields constituting an approved decision and its authorization snapshot, including DELETE and superseding-record reference. The patch explicitly rejects UPDATE mutation of an existing APPROVED row; verify the complete correction/deletion contract.
- This broad stacked security change is not merge-ready. Test candidate migrations from a clean disposable production-derived branch using the exact full chain, not only static guards or mocked route clients.

**PR #234 latest CI:** initial run failed one new TLS unit assertion because the helper rejected missing DATABASE_SSL=require before the more specific plaintext-production assertion. Commit 5e98e4f2731d9e1e8898fc6c45402088fc3b2384 reorders the explicit plaintext rejection. Exact-head CI run #41626454283 was still in progress at this update; no pass is claimed.

**Next coordinated execution batch:**
1. Finish #234 exact-head CI and inspect test/container stages; add disposable TLS-server acceptance for certificate and hostname rejection.
2. Verify upstream source blob IDs for the four staging fixtures, compare staging objects against SQL, and produce a non-executable reconciliation manifest.
3. Complete PR #213 verifier trigger review and execute opt-in PostgreSQL tests on a fresh disposable production-derived child only after independent review.
4. Keep staging migrations out of the active release catalogue until lineage, data model, worker principal and RLS design are accepted.
5. Keep production HOLD, no production DDL/DML, no global RLS, no worker activation, no issuance or settlement enablement.


### 12.10 Direct staging-catalog comparison of recovered migration fixtures

A read-only Neon catalog comparison was performed against staging branch br-spring-hill-b4544vz5 and production branch br-restless-base-b44cip2h, database rupaykg, on 2026-11-03. No row payloads were read and no database writes were performed.

**Staging ledger:** all four 20261022–20261025 rows are present with applied_at 2026-10-20T10:48:38.647Z. The four corresponding tables exist. Catalog shape confirms the 20261023 inbox lease columns/status expansion, the append-only inbox-event table and triggers, plus the AI rate-limit and evidence-intake job tables with their unique/FK/check constraints and indexes. This supports schema-shape consistency with the recovered fixture sequence, but it is not cryptographic proof of the exact deployed SQL bytes.

**Aggregate data profile (no payload contents queried):** async_mirror_inbox 12 rows; async_mirror_inbox_events 29 rows; ai_intake_rate_limits 0 rows; ai_evidence_intake_jobs 0 rows. The inbox table contains payload JSON, which remains untrusted source data and must not be equated with measurements or MRV evidence.

**Staging security posture:** all four tables have RLS=false and FORCE RLS=false; no policies were found; owner is elevated role rupaykg. Catalog shows rupaykg has full owner table privileges including TRUNCATE and grantable privileges. The inspected role has BYPASSRLS, CREATEDB, CREATEROLE, INHERIT and REPLICATION, while rolsuper=false. No separate restricted worker principal was evidenced by this inspection. The event append-only trigger is not a substitute for RLS, restricted grants, or a hardened worker boundary.

**Production comparison:** the authoritative production branch query returned zero of these four tables. Therefore these remain staging-only schema objects in the inspected snapshots; do not promote them into production or the active release catalogue.

**Release decision:** staging-only inbox and AI-intake capabilities remain disabled/unsupported for production. Before any future activation require independent upstream blob verification, dedicated least-privilege worker principals, tenant-scoped data ownership, RLS/FORCE RLS and explicit policies, payload classification and retention, signed authority/source validation, idempotency/replay acceptance, and two-tenant PostgreSQL negative tests. No DDL/DML, payload reads, role/grant changes, migration, worker activation or deployment occurred.

### 12.11 Latest PR #234 / pilot UI follow-up

- PR #234 commit 5e98e4f2731d9e1e8898fc6c45402088fc3b2384 passed CI run #41626454283, including typecheck, build, browser smoke, disposable PostgreSQL acceptance and production-container build. This pass applies to that exact commit only.
- Further TLS hardening followed on the same PR: preserve native connection-string TLS parameters in non-production when DATABASE_SSL is not explicitly set; apply an explicit environment policy only when provided; reject unsupported DATABASE_SSL values. New head is 59490c40a8e597fd17679f19d74fc7d704f13f86 and exact-head CI run #41627023797 was still in progress at the time of this update.
- PR #219 pilot demo was hardened in commit c488c5e6a1624c142f81941ba0edceb7f98ea7c3: synthetic panel requires explicit ?demo=1, “Verified” was removed from the title, and CSV delimiters corrected. PR remains draft; its base branch is diverged 9 commits ahead/9 behind from the current pilot head comparison. Preserve parent relationship and await exact-head CI and base reconciliation.


### 12.12 Exact-head CI closure and pilot UI status correction

The follow-up CI checks have now completed:

- PR #234 head 59490c40a8e597fd17679f19d74fc7d704f13f86 — workflow run #41627023797 / run number 5157 — conclusion SUCCESS. Every configured stage passed: dependency audit, migration validation, migration CLI against disposable CI PostgreSQL, TypeScript typecheck, production build, browser smoke, disposable PostgreSQL acceptance and production-container build. This includes the new tests preserving non-production URL TLS configuration when DATABASE_SSL is not explicitly set, while explicit env policy remains authoritative.
- PR #219 head c488c5e6a1624c142f81941ba0edceb7f98ea7c3 — workflow run #41626898059 / run number 5155 — conclusion SUCCESS. The pilot UI branch passed typecheck, build, browser smoke, disposable PostgreSQL acceptance and production-container build.

PR #234 remains draft: its CI suite does not exercise a real PostgreSQL TLS handshake with an untrusted CA and hostname mismatch, and the actual Render DATABASE_URL hostname/binding remains unverified. Independent security review is still required.

PR #219 remains draft and stacked on the MRV workspace security branch. Its head-to-base comparison remains 9 commits ahead and 9 behind from merge base 337bc5cc6abbf09acdc786c7c37ab7b4d1a57eb6. Do not rebase or merge until the MRV parent head is reconciled. The UI's reference-parity token layer uses near-black #050505, charcoal #151619 and emerald #10b981; the pilot fixture is opt-in (?demo=1), synthetic-only and browser-local.

These exact-head CI successes validate only the branches and workflow stages described above. They do not certify production tenant isolation, historical migration parity, real Guardian/HCS/Mirror Node operation, regulatory approval, live pilot readiness or TRL 9.


### 12.13 Additional planned inbox crosswalk correction — not applied

PR #108 also contains scripts/fixtures/legacy-migrations/20261101_async_mirror_unresolved_crosswalk.sql (fixture Git blob b38ce7632869dce5d6837442035b845a1bbc8802; embedded upstream source blob 4f9776bc449025e795cb0d5c93e8bace9dea280b). Its header explicitly marks it as planned corrective source and not an applied/live migration. It adds UNRESOLVED to the inbox status domain for structurally valid source batches lacking one unambiguous, currently valid, verified jurisdiction crosswalk.

A read-only staging ledger query found no 20261101 row; the actual staging status constraint also does not include UNRESOLVED. This state is a useful national platform requirement: do not convert ambiguous or unmapped authority/municipal identifiers into accepted/rejected MRV facts. Preserve the source as a design fixture only. Before implementing, define crosswalk authority, hierarchy, effective dates, source provenance, ambiguity behavior, retry/quarantine and operator adjudication. Do not add this fixture to the active migration catalogue or imply it was deployed.


### 12.14 Verification candidate correction after direct source review

Direct current-main source review confirms migrations/008_verification_integrity.sql contains a global membership check with role-name fallback and enforces it only for APPROVED. Migration 012_geography_authorization.sql returns TRUE when an organization has no VERIFIED geography roots and uses an unbounded recursive ancestor walk. These are the mainline defects the PR #213 candidate is intended to replace.

**Permission vocabulary correction:** current-main apps/src/auth.ts defines HIGH_RISK_PERMISSIONS.VERIFY_EVIDENCE as the explicit permission-key set [VERIFY_EVIDENCE, verification:approve, verification.approve]. Therefore PR #213's use of those three exact permission strings is consistent with the current application registry. The required boundary is that role names themselves never grant authority. SQL and application registries must remain synchronized and tests must cover each allowed key plus role-name-only denial.

**New confirmed candidate gaps:** the PR #213 20261106 replacement trigger calls a boolean permission helper but does not populate authorization_membership_id, authorization_role_id, authorization_permissions_snapshot or authorization_checked_at. The active current-main migration catalogue does not contain the recovered 096 file, so the forward-only migration must create these columns/FKs idempotently before trigger use. The candidate blocks UPDATE of an approved row but does not add BEFORE DELETE protection for approved decisions. Its current cycle acceptance case tests a cycle with no assigned root, not a verified scope node inside the cycle.

**Acceptance additions:** (1) persist the decision-time membership, role, permission snapshot and checked-at for both APPROVED and REJECTED; (2) explicitly deny ambiguous eligible memberships or define a reviewed deterministic selection contract; (3) reject mutation of snapshot fields and approved-row DELETE; (4) require superseding correction linkage; (5) test verified scope inside a malformed cycle, exact match, ancestor, child, sibling, unrelated and depth ceiling; (6) execute all cases through the exact clean migration chain on disposable PostgreSQL. The permission-key aliases themselves are not a blocker after registry confirmation.

No production or staging writes, migrations, trigger changes or role changes occurred.


### 12.15 Staging inbox event integrity: search_path and TRUNCATE bypass

Further read-only review of staging branch br-spring-hill-b4544vz5 found:
- public.record_async_mirror_inbox_event() has no function-level search_path setting (pg_proc.proconfig is NULL), is invoker-security, and inserts into async_mirror_inbox_events without schema qualification. A safe forward design must pin search_path and explicitly write to public.async_mirror_inbox_events; acceptance must prove temp-schema/search_path shadowing cannot redirect or suppress the event write.
- async_mirror_inbox_events has a row-level BEFORE UPDATE OR DELETE trigger, but the current table owner rupaykg has TRUNCATE privilege. PostgreSQL TRUNCATE does not fire row-level triggers, so the append-only guarantee is not effective against the elevated owner. Add statement-level BEFORE TRUNCATE rejection as defense in depth and separate ownership from runtime authority.
- The four staging tables remain RLS/FORCE RLS disabled with no policies. The elevated owner has BYPASSRLS, DDL and replication capabilities. A dedicated NOLOGIN schema owner and least-privilege runtime/worker principal without ownership, BYPASSRLS, DDL or TRUNCATE are mandatory before activation.

This is staging-only. No DDL/DML, role/grant change, payload read or worker activation occurred. Do not add these staging-only objects to production as part of the hardening exercise. Any future implementation must be a reviewed forward migration and disposable PostgreSQL acceptance package, not an edit/replay of historical fixtures.


### 12.16 Consolidated current-main production-safety and migration-runner candidate — PR #235

Opened draft [PR #235](https://github.com/vishaltradewinds/rupaykg/pull/235), head aa2b89f9785e547ed81f28d6e286f7bd997525af, base main at a3fecc0abd2c46549a201058d3963afc0e3a73c9. It consolidates PR #234's current-main startup/TLS hardening with migration-history preflight, session advisory-lock serialization, single-client migration execution, rollback/unlock connection disposal, public search_path pinning, and orphan-schema refusal when the ledger is absent. PR #234 remains an open draft component/reference PR and must not be merged separately if #235 is accepted.

Exact-head CI run #41628809379 (run 5168) on aa2b89f9785e547ed81f28d6e286f7bd997525af: dependency audit, migration catalogue validation, migration CLI against disposable CI PostgreSQL, TypeScript typecheck, production build, browser smoke and disposable PostgreSQL acceptance (including the new orphan-schema case) all passed. The production-container build was still running at the time of this addendum; no final workflow success is claimed yet.

The runner preflight verifies migration catalogue uniqueness, applied filename presence and numeric-prefix consistency, and refuses an unledgered schema containing non-extension relations/custom enum or domain types/functions. It does not verify historical SQL bytes against cryptographic checksums. Exact 096 source reconciliation and staging-only 20261022–25 provenance remain separate blocking gates. No production or staging migration was executed.


### 12.17 Migration 027 filename/source reconciliation correction

A direct SELECT of production and staging migration ledgers confirms both record version 027 as filename 027_verification_permission_hardening.sql, applied_at 2026-10-17T10:48:26.266Z. The exact file exists on current main and historical commit ca8f4100782e13f8d72106187fafc8e1e446214f with Git blob c626a7aad10a31a620b5d814af1330f00c54def4. It is not a missing source file. The current migrations README incorrectly names it 027_verification_permission_guard.sql; correct the README reference.

The 027 SQL removes role-name fallback and checks explicit permission keys, but only verifies a membership status and permission. It does not bind the membership to the activity organization, verify identity state/suspension, enforce geography scope, or persist immutable decision-time authorization snapshots. Treat 027 as a partial historical hardening step, not the complete verifier authorization contract. Do not replay it; replace/extend only through a reviewed forward migration after the #213 snapshot, DELETE and geography gaps are closed.


### 12.18 PR #235 CI completion and migration README correction

The full CI run #41628809379 (run 5168) on commit aa2b89f9785e547ed81f28d6e286f7bd997525af completed SUCCESS, including the production-container build. This exact head passed all configured validation, browser, disposable PostgreSQL and container stages.

After that success, the migration README's incorrect version-027 filename was corrected in PR #235 to 027_verification_permission_hardening.sql, matching both inspected environment ledgers and the exact source blob c626a7aad10a31a620b5d814af1330f00c54def4. New head e7e34aca8097281a315a2348a96a264cb9531c65 is documentation-only relative to the CI-green head; a fresh exact-head CI run is still required before the PR can be called green. PR #235 remains draft and unmerged.


### 12.19 Field-data write-path and device-binding audit (mainline vs security stack)

Manual review of current main and PR #216 security-base source confirms the direct operational routes remain unchanged:
- POST /api/v1/resource-flows checks permission and geography using separate pool operations and inserts via a separate pool query; it lacks a single transaction, idempotency key and direct actor/device provenance.
- POST /api/v1/activities/:activityId/measurements checks activity authorization/geography via pool then inserts via pool; it lacks idempotency and omits measurements.captured_by_identity_id, device_id, latitude, longitude and location_accuracy_m columns already present in the schema.
- The same route code is present in PR #216's security-base branch; adding signed request-context helpers elsewhere does not certify these direct write routes.

The offline field-sync path has useful per-device idempotency, payload-hash conflict detection, client-sequence collision detection, server cursors and transactional envelope application. However, requireFieldDevice() is called before the intake transaction, checks only device ID/identity/VERIFIED status, and does not bind device.organization_id to auth.activeOrganizationId or lock/revalidate the device in the transaction. Apply locks the envelope but does not join/revalidate field_devices or pass device context into applyOperation. A device bound to org A must not be used to create org B records simply because its identity also belongs to org B.

Offline domain mapping is also incomplete: MEASUREMENT_CREATE does not populate measurement actor/device provenance or create an instrument/uncertainty/evidence-linked mrv_observations row; EVIDENCE_CREATE writes captured_by_identity_id but omits device_id; ACTIVITY_CREATE writes actor_identity_id but omits device_id; RESOURCE_FLOW_CREATE relies on envelope linkage and the direct route bypasses it. Resource flows have no direct idempotency or actor/device fields.

**Disposition:** this is a P0/P1 field-data integrity and tenant-authorization gap. Require same-client authorization+write transactions, device identity+organization binding and lock/revalidation at both intake and apply, idempotent online/offline parity, and explicit provenance mapping to every domain record. Two-tenant/two-device PostgreSQL acceptance must prove cross-org device denial, revocation-between-intake/apply denial, replay/conflict semantics and zero writes on denial. Do not treat a captured numeric measurement as an MRV observation or verified evidence.

**CDPI Wave 1 update:** PR #230's route trace and API/domain inventory were extended with these manual findings. The current inline Fastify routes use manual validation, not attached JSON Schema. Machine-readable OpenAPI should be generated only after versioned JSON Schema is attached to runtime validation and the authorization/device/provenance semantics match the contract. No public partner contract is approved yet.


### 12.20 Staging search_path and append-only privilege confirmation

A further read-only SELECT on staging confirmed current search_path = "$user", public; role rupaykg has database TEMP privilege; and rupaykg has both TRUNCATE and DELETE on public.async_mirror_inbox_events. Combined with the event-writing function's NULL proconfig (no pinned search_path), invoker-security mode and unqualified INSERT target, the temp-schema shadowing and event-history bypass risks are concrete. The function must pin a safe search_path and explicitly insert into public.async_mirror_inbox_events; add a statement-level TRUNCATE guard as defense in depth; and separate a NOLOGIN schema owner from a runtime principal without TEMP, TRUNCATE, DELETE, ownership, BYPASSRLS or DDL authority. No DDL/DML or payload reads were performed.


### 12.21 Final exact-head CI and TLS handshake test for PR #235

PR #235 head 45e757b5062c9e7d80bf62dc7ebc1c5ac4d9afa9 completed GitHub Actions run #41630197690 (run 5182) with conclusion SUCCESS. All configured stages passed: dependency audit, migration catalogue validation, migration CLI against disposable CI PostgreSQL, TypeScript typecheck, production build, browser smoke, disposable PostgreSQL acceptance and production-container build.

Added an ephemeral local Node TLS handshake regression test using a generated self-signed certificate. It verifies trusted CA + matching hostname succeeds, untrusted/self-signed CA is rejected, and hostname mismatch is rejected using the exact TLS policy returned by createDatabasePoolConfig. This validates Node TLS policy, but not the full PostgreSQL SSLRequest/protocol handshake or the live Render/Neon connection. Those remain independent release gates. PR #235 remains draft and unmerged; PR #234 is closed as superseded. Production remains read-only/HOLD.


### 12.22 Field-sync envelope, device lifecycle and conflict-isolation audit

Read-only source review of migrations 003/009/011/016/017 and apps/src/sync-routes.ts found:
- can_manage_field_device() authorizes by role-name fallback (admin, administrator, org_admin, organization_admin, field_manager, operations_manager) as well as permission strings. Current auth.ts HIGH_RISK_PERMISSIONS has no MANAGE_FIELD_DEVICES action. A forward policy must add canonical explicit permission keys and remove role-name authority; verify active/non-suspended identity and verified membership.
- field_sync_envelopes stores device_id and identity_id but no organization_id. Intake checks device identity/status before the transaction and does not compare device.organization_id with auth.activeOrganizationId. Apply locks only the envelope and does not join/revalidate field_devices. Persist organization binding at intake and revalidate/lock envelope+device on apply; do not infer old envelope ownership from a device row that may later be reassigned.
- Migration 016 freezes device identity/org/device_id only while OLD.status='VERIFIED'. A revoked or pending device can be rebound, which can make historical envelopes appear associated with a different organization. Freeze device identity/org after registration/verification and use a new device record for reassignment.
- Migration 009's processed-envelope guard freezes only payload/device_id/client_sequence when old.status is terminal. It does not freeze identity_id, idempotency_key, captured_at, payload_hash, server_cursor, applied entity metadata or terminal status, and has no DELETE/TRUNCATE guard. Implement an explicit RECEIVED-to-terminal state machine and immutable provenance/idempotency fields, plus DELETE/TRUNCATE rejection.
- Field-sync conflict list and resolution routes filter by envelope identity only, not active organization. Multi-org identities can view/resolve conflicts across organizations. Bind conflict operations to persisted envelope organization and active org.
- MEASUREMENT_CREATE does not populate measurements.captured_by_identity_id/device_id; EVIDENCE_CREATE omits evidence.device_id; ACTIVITY_CREATE omits activities.device_id. Preserve actor/device/envelope linkage in authoritative domain rows.
- Current-main canVerifyEvidence() joins any verified membership for the identity and geography without binding om.organization_id to activities.organization_id. The security-definer candidate path must be mandatory in production with no unsafe legacy fallback.

**Disposition:** P0/P1 field-data and tenant-isolation work. Do not activate field-sync workers or global RLS until two-tenant/two-device, device revocation/reassignment, conflict isolation, idempotency replay, terminal-state immutability and domain provenance tests pass under a restricted runtime principal. No production/staging changes were made.
