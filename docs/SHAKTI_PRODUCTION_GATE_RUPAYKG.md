# RupayKg — SHAKTI Production Gate

## Purpose and non-negotiable rule

This document is the production-control record for RupayKg under SHAKTI — Standard Operating Systems.

**Objective:** RupayKg is intended to become a robust Pan-India Circular Economy Operating System, not merely a pilot or a demonstration. Build and verify real operating workflows before considering deployment.

**Rule:** One Shakti Standard, many project-specific operating systems. All applicable gates must be evidenced before a release can be called production-ready or SHAKTI-certified. SHAKTI certification does not replace statutory, regulatory, contractual, infrastructure-provider, or third-party approvals.

**Deployment is not the current objective.** The current objective is repository-wide audit, functional completeness, security, recoverability, test coverage, and end-to-end workflow verification.

## Current verified baseline — 2026-10-23

- Repository: `vishaltradewinds/rupaykg`
- Default branch: `main`
- Render service: `rupaykg`
- Render service ID: `srv-daki4d7qj5pc73b8qksg`
- Render service's latest observed deployment ID: `dep-dbbjqic9v7es73ffofmg`
- Render deployment commit observed: `0ddcf6087620880e21ea60f954c9f05d6b759469`
- Render PostgreSQL resource: `rupaykg-db` (`dpg-dakhdv95efls73e1974g-a`)
- Latest observed database state: **suspended by billing**.
- The public health endpoint and homepage could not be independently verified during the current audit. Render log retrieval returned HTTP 503. Therefore live readiness is **unverified**, not passed.
- The historical CI run on commit `0ddcf6087620880e21ea60f954c9f05d6b759469` passed on 2026-10-19. This is historical evidence, not current-day production acceptance.
- This file previously listed a different deployed commit (`5c1c215c777b0e7f15a4b74168db5c0f9307fbd5`) and a different deployment ID. That record conflicts with the latest observed Render control-plane metadata and must not be treated as the current deployment source of truth.
- Production startup/TLS hardening is being developed in draft PR #43. GitHub Actions CI run #1921 (`39928536739`) completed successfully on head `03e43f7de1ae33831aace2a450bfb89400d584bf` on 2026-10-23. The configured job passed dependency audit, migration validation, migration against disposable PostgreSQL, typecheck, build, browser smoke test, tests including disposable PostgreSQL acceptance, and production container build. This validates that exact branch commit against configured checks only; it does not prove live database recovery, production health, external integrations, regulatory approval, or Pan-India readiness.
- PR #43 is not merged or deployed. No production database mutation or deployment was performed as part of this hardening work.

## SHAKTI gate status

| Gate | Status | Evidence / condition |
|---|---|---|
| S01 Reality | PARTIAL | Repository and Render control-plane resources inspected; service/database states do not currently establish live operation. |
| S02 Context | OPEN | Real operational context, regional workflows, actors, infrastructure dependencies, and support model need full validation. |
| S03 Need / purpose | PASS | Pan-India circular-economy operations, evidence-first MRV, EPR/ESG, and governed environmental data are the platform objective. |
| S04 Evidence | OPEN | Code/CI evidence exists; production runtime and independent external evidence are incomplete. |
| S05 Understanding | OPEN | A repository inventory and targeted audit exist; complete file-by-file and workflow-level audit is not yet complete. |
| S06 Relevance | PASS | Current work directly addresses production startup, database security, and operational readiness. |
| S07 Boundaries | OPEN | Applicable statutory requirements, methodology scope, security, privacy, financial/credit claims, and third-party constraints require evidence. |
| S08 Options | OPEN | Recovery/provider options and alternative hosting/database options must be compared before any infrastructure change. |
| S09 Feasibility | BLOCKED | Database is suspended; operational feasibility cannot be proven until safe recovery and end-to-end tests. |
| S10 Validation | BLOCKED | Current production health, full workflows, and authoritative external verification have not been re-established. |
| S11 Decision | BLOCKED | No production-readiness or SHAKTI certification claim. |
| S12 Design | ONGOING | Architecture exists; security and workflow gaps are being audited and hardened. |
| S13 Engineering | ONGOING | Draft PR #43 addresses startup ordering and shared PostgreSQL TLS policy. |
| S14 Verification | PARTIAL | Latest PR-head CI passed configured checks; broader acceptance, recovery, multi-tenant, field/offline, and resilience tests remain. |
| S15 Compliance & approvals | OPEN | Applicable legal/methodology requirements and required independent approvals must be mapped and evidenced. |
| S16 SHAKTI certification | BLOCKED | Material gates remain open. |
| S17 Deployment / live release | DEFERRED | Deployment is deliberately postponed until platform functionality and readiness are proven. |
| S18 Assurance | OPEN | Backup existence, restore rehearsal, alert delivery, rate limiting, incident response, and rollback evidence remain to be demonstrated. |
| S19 Learning | ACTIVE | Audit findings are being converted into code, tests, and explicit acceptance criteria. |

## P0 blockers

1. Recover or otherwise safely resolve the suspended database, after confirming data preservation and backup/recovery options. Do not delete/recreate the database as a shortcut.
2. Review the database network exposure before recovery/release: Render currently reports its PostgreSQL IP allowlist as `0.0.0.0/0` (`everywhere`). Inventory any legitimate external clients first, then narrow access to the minimum required sources; prefer the same-region Render internal connection for the app. Do not change the allowlist blindly while the database is suspended.
3. Complete a repository-wide audit of migrations, startup, authentication, organization/tenant isolation, authorization, evidence storage and integrity, MRV calculations, registry/settlement, and operational workflows.
4. Verify the platform's real core workflows end-to-end using isolated/disposable data first, including negative and failure-path tests.
5. Prove tenant isolation: an identity from one organization must not read or mutate another organization's records without explicit authorized scope.
6. Prove evidence lifecycle: capture/upload, immutable hash/provenance, access control, review, correction/rejection, export, retention, and audit trace.
7. Prove that internal MRV estimates or platform records are not represented as official credits, accredited verification, government approval, or external settlement unless authoritative evidence exists.
8. Verify current official rules, methodology versions, applicability, required monitoring/parameters, calculations, uncertainty/leakage treatment, and approval/verification boundaries before operational carbon claims.
9. Verify Guardian/Hedera only with real configured credentials and independent authoritative evidence. Required chain where applicable: `Guardian VERIFIED -> Hedera CONSENSUS_CONFIRMED -> persisted provenance -> Mirror Node verification`. A fixture or mock does not count as external proof.
10. Verify backup/restore in an isolated environment, alert delivery, rate limiting, secret management/rotation, and recovery/rollback procedures.
11. Demonstrate field-ready workflows for low-connectivity use, retries/idempotency, duplicate/conflict resolution, accessibility, multiple organizations and geographies, and support operations.

## P1 robustness work

- Reconcile deployment metadata and all operational documentation against observed provider state.
- Establish repeatable CI checks for migration ordering/integrity, dependency vulnerabilities, type safety, builds, API contracts, security boundaries, and end-to-end workflows.
- Add operational observability: structured logs, actionable alerts, health/readiness separation, correlation IDs, safe error messages, and incident playbooks.
- Validate edge/API rate limits, abuse controls, upload size/type limits, and protection against replay or duplicate submissions.
- Validate data export, auditability, retention/deletion rules, backup restoration, and migration rollback strategy.
- Build and test staging/recovery environments without touching production data.
- Validate multi-state and multi-ULB/district onboarding, language/accessibility, intermittent connectivity, and scale assumptions using explicit acceptance criteria.

## Work and release rules

- PR #43's latest observed CI is green on head `03e43f7de1ae33831aace2a450bfb89400d584bf`; keep it draft and unmerged until focused code review confirms production startup/TLS behavior and all remaining release gates are handled.
- Do not use production database access for exploratory tests or run destructive migrations to diagnose the billing suspension.
- Do not change providers or migrate data until recovery options, data ownership, cost, security, compatibility, and rollback are assessed.
- Do not claim official environmental credits, government integration, external consensus, certification, or compliance without authoritative evidence.
- A successful build, CI run, deployment, or HTTP 200 response is **not** sufficient for production acceptance.
- Deployment is the final gate, after functional, security, data-recovery, operational, regulatory, and external-integration evidence is complete.

**Current decision: NOT PRODUCTION-READY / NOT SHAKTI-CERTIFIED. Engineering and verification continue; deployment is deferred.**
