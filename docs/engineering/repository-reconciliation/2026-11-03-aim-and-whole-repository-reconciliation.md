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
