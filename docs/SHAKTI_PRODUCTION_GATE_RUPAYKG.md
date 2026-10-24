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
- Production startup/TLS hardening is being developed in draft PR #43. GitHub Actions CI run #1921 (`39928536739`) passed on earlier head `03e43f7de1ae33831aace2a450bfb89400d584bf`, covering dependency audit, migration validation, disposable-PostgreSQL migration, typecheck, build, browser smoke test, acceptance tests, and production container build. Later changes add an IPv6-loopback rejection and regression test; the pass on the earlier SHA does not validate later changes. Before merge, verify a green CI result for the exact current PR head. CI does not prove live database recovery, production health, external integrations, regulatory approval, or Pan-India readiness.
- PR #43 latest head `2c0fe2e20868525375c137ff38c99fa93141d730` passed CI run #1948 (`39936139122`) on 2026-10-23. The run passed dependency audit, migration validation, disposable-PostgreSQL migration, typecheck, build, browser smoke, tests including PostgreSQL acceptance, and production-container build. This is engineering evidence only; it does not establish live production recovery or readiness.
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
| S14 Verification | PARTIAL | CI passed on an earlier PR head; current-head CI must be verified before merge. Broader recovery, multi-tenant, field/offline, and resilience tests remain. |
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

- Keep PR #43 draft and unmerged until CI is green for its exact current head, focused code review confirms production startup/TLS behavior, and all remaining release gates are handled.
- Do not use production database access for exploratory tests or run destructive migrations to diagnose the billing suspension.
- Do not change providers or migrate data until recovery options, data ownership, cost, security, compatibility, and rollback are assessed.
- Do not claim official environmental credits, government integration, external consensus, certification, or compliance without authoritative evidence.
- A successful build, CI run, deployment, or HTTP 200 response is **not** sufficient for production acceptance.
- Deployment is the final gate, after functional, security, data-recovery, operational, regulatory, and external-integration evidence is complete.

**Current decision: NOT PRODUCTION-READY / NOT SHAKTI-CERTIFIED. Engineering and verification continue; deployment is deferred.**


## Repository audit addendum — 2026-10-23

### Verified engineering gate
- Exact PR head: `2c0fe2e20868525375c137ff38c99fa93141d730`.
- GitHub Actions CI run #1948: `39936139122`, conclusion `success`.
- Run: https://github.com/vishaltradewinds/rupaykg/actions/runs/39936139122
- PR: https://github.com/vishaltradewinds/rupaykg/pull/43

### Newly confirmed audit-chain gap — remains OPEN
A targeted source review found that the platform does not yet have one consistently enforced, concurrency-safe audit chain across all writers:

1. `apps/src/platform-admin-routes.ts` locks and advances the singleton `platform_audit_chain_head` for platform-admin audit writes.
2. `apps/src/cpcb-swm-routes.ts` independently selects the latest organization audit event with `FOR UPDATE`. This is not the same serialization lock; an organization with no prior events has no row to lock, and concurrent first writes can race.
3. `apps/src/sync-routes.ts` writes audit events directly without consistently setting `previous_hash` or advancing the singleton chain head.
4. `migrations/050_field_sync_conflict_audit.sql` inserts audit events through a database trigger using an MD5-derived value, without advancing the shared chain head.
5. `migrations/084_platform_audit_chain_head.sql` explicitly documents that older writers do not all participate in the platform-admin chain.

**Impact:** audit rows exist, but the system must not be described as having a single complete, tamper-evident, globally ordered audit chain. A future hardening batch must inventory every application and database-trigger writer, define one canonical append contract and hash serialization, serialize appends transactionally, advance the chain head consistently, and add concurrent-writer plus legacy-event tests. Do not retrofit or rewrite historical audit rows without a reviewed migration and recovery plan.

### Audit scope boundary
The recursive Git tree inventory found 318 tracked files at this PR head. The review remains a repository inventory plus targeted source/migration review, not a claim that every file and every workflow has been fully audited. Remaining high-priority checks include backup/restore proof, tenant-isolation coverage across all routes, field/offline retry and conflict behavior, external Guardian/Hedera proof, MRV methodology applicability, and current production health after database recovery.


### Audit database privilege boundary — OPEN (follow-up, 2026-10-24)

The canonical append function and append-only UPDATE/DELETE/TRUNCATE triggers exist, but migration 090 does not block direct INSERTs. Repository configuration does not define or prove a separate non-login function-owner role and restricted runtime role. Therefore the database can still permit an unchained direct insert if the runtime role has INSERT privilege.

This is intentionally **not** “fixed” with a custom GUC guard or an unreviewed `SECURITY DEFINER` function: without role separation, those would not prove a security boundary. The migration README now records the exact privilege topology and acceptance tests required to close this gate. Production role grants were not inspectable during this repository-only pass.

**Release consequence:** audit-chain bypass protection remains OPEN. Before this gate can pass, provision and verify distinct least-privilege roles, restrict direct INSERT and role escalation, harden the function's owner/search path/execute grants, and run integration tests under the production-equivalent role topology. Do not merge or deploy on the strength of source-level convention alone.


### Verification update — 2026-10-24 (PR head 40578451)

- Latest observed PR branch commit: `40578451b92e3ebade9c86199be921344ca53c4e`.
- GitHub Actions CI run #1977 (`40048332741`) completed with conclusion `success`: https://github.com/vishaltradewinds/rupaykg/actions/runs/40048332741
- The commit improves the read-only SQL diagnostic at `docs/sql/audit_privilege_diagnostics.sql`: catalog-level relation ACLs include PUBLIC, and role membership paths are traversed recursively with cycle protection. This is a diagnostic improvement, not a privilege remediation.
- Render control-plane inspection reconfirmed PostgreSQL `rupaykg-db` is `suspended` with `suspenders=[billing]`; its configured IP allowlist remains `0.0.0.0/0`. The web service is not marked suspended, but that alone does not prove it can serve functional requests.
- An attempted read-only connection through the Render PostgreSQL query tool failed: connection attempts returned unexpected EOF and PostgreSQL reported `SSL/TLS required` for non-TLS attempts. No SQL diagnostic completed and no production data or grants were changed. The suspension and the connection error are separate observed obstacles; do not infer that fixing TLS alone will reactivate the database.
- The diagnostic script has not been executed against the production database. Effective production grants, owner separation, and role escalation paths therefore remain unverified.

**Current decision unchanged:** NOT PRODUCTION-READY / NOT SHAKTI-CERTIFIED. PR #43 remains draft and unmerged; deployment remains deferred. The next security step requires an authorized, working TLS-capable database connection and review of actual role/grant output before any privilege migration is designed or applied.
