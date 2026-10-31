# RupayKg repository-wide Shakti engineering audit — 2026-10-31

## 1. Audit purpose and standard

This audit evaluates the repository against the RupayKg execution plan and Shakti Standards: reality/context, evidence, statutory and security boundaries, feasibility, architecture, engineering, testing, approval, deployment, operations, measurement, continuous assurance and TRL. It distinguishes code/CI evidence from live production, statutory acceptance, external trust-rail acceptance and field/hardware evidence.

Repository: `vishaltradewinds/rupaykg`  
Review branch: `shakti/integrate-government-inbox-worker-2026-10-31`  
PR: [#157 — draft government inbox worker and migration chain](https://github.com/vishaltradewinds/rupaykg/pull/157)  
Inventory snapshot commit: `81dc02b633d013f9082514bb13be67be7f1318df`  
Inventory result: 352 tracked blobs; recursive Git tree was not truncated.

## 2. Repository inventory

| Area | Files |
|---|---:|
| API/server source (`apps/src`) | 50 |
| Web application (`apps/web`) | 43 |
| SQL migrations | 113 |
| Documentation (`docs`) | 73 |
| Test files | 43 |
| Shared packages | 36 |
| GitHub workflows | 2 |
| Entire tracked tree | 352 |

The repository includes API routes and services, frontend and offline/field UX, domain/compliance/carbon/ESG/intelligence packages, migration history, Guardian/Hedera adapters and policies, CI/deployment configuration, operational and regulatory documentation.

**Coverage qualification:** this is a repository-wide structural inventory plus targeted deep review of the production entrypoint, Docker/Render startup, migration runner/order, authentication/RBAC, evidence vault, CPCB SWM workflow routes, government inbox worker/hash, migration chain and related acceptance tests. It is not a formal independent line-by-line security audit of every one of the 352 files. Frontend visual/accessibility review, all route-by-route authorization review, every historical SQL definition, external provider contracts and live infrastructure were not independently certified by this pass.

## 3. Executive disposition

**Engineering status: substantial implementation and CI evidence; production release remains HOLD.**

The platform has a meaningful PostgreSQL-backed operational core, evidence-linked MRV, organization/geography authorization, statutory preparation workflows, registry/settlement guardrails, and an isolated government intake worker proposal. The new worker is deliberately not scheduled or activated. Its successful internal validation is not official government acceptance, a verified MRV record, carbon-credit eligibility, Guardian verification or Hedera consensus.

The most important release risk found in this pass was not a worker algorithm defect: the production container previously ran the migration runner automatically at every startup, and the migration runner used PostgreSQL TLS with certificate verification disabled. That contradicted the documented change-control and production-readiness gates. The candidate branch has been hardened to remove implicit migration execution, enforce a production migration approval envelope and exact baseline preflight, and verify TLS certificates. The new code must pass exact-head CI before these fixes can be accepted.

## 4. Findings and remediation

### F-01 — Production deployment implicitly applied pending migrations

**Severity: P1 / release blocker. Status: FIXED IN CANDIDATE; exact-head CI required.**

The previous Docker runtime command executed `migrate.js` before starting the production server. The migration runner defaulted to phase `all`, which could apply every pending SQL file as a side effect of a Render deployment or restart. This bypassed the execution plan's independent review, staging reconciliation, backup, approved change window and rollback gates.

Candidate correction:
- Docker runtime now starts only `production-server.js`.
- The package `start` command starts only the API.
- Production migrations are a separate one-off operation.
- The production migration runner requires explicit approval flags, a change/ticket ID, a verified backup reference and the `production-upgrade` phase.
- Before applying, it requires the live ledger to match the captured 92-row production manifest exactly by ordered version/filename identity. Missing/extra/renamed rows block execution for manual reconciliation.
- Operations and production-target documents now describe the separate migration gate.

This correction does not authorize a migration run. No live Neon database was changed.

### F-02 — PostgreSQL TLS certificate verification disabled in migration/seed paths

**Severity: P1 / security. Status: FIXED IN CANDIDATE; exact-head CI required.**

The migration runner and acceptance seed previously configured `rejectUnauthorized: false` for TLS connections. This weakens protection against database endpoint impersonation.

Candidate correction: both paths now use certificate verification (`rejectUnauthorized: true`) and pass an explicitly supplied CA certificate when present. Render's private-network non-TLS configuration remains an explicit `DATABASE_SSL=false` choice; external PostgreSQL deployments must use verified TLS. The production server's validated config continues to enforce the production database contract.

### F-03 — Production migration gate did not enforce live baseline identity

**Severity: P1 / data integrity. Status: FIXED IN CANDIDATE; exact-head CI required.**

The generic migration runner previously had no production-only gate proving the target database was the captured production baseline before running the proposed chain.

Candidate correction: production migration execution now fails closed without explicit change/backup/approval evidence and checks the exact 92-row production ledger manifest before any migration application. If the ledger is absent or differs, the runner stops and requires a reviewed reconciliation. Unit tests cover missing approval evidence and the approved envelope; the database preflight is covered by the existing disposable PostgreSQL reconstruction path.

This is a controlled initial-baseline gate. After a separately approved migration has been applied, the baseline manifest and next change procedure must be deliberately refreshed/reconciled before a future migration batch; do not bypass the check.

### F-04 — Disposable PostgreSQL acceptance tests could be invoked outside CI

**Severity: P1 / test safety. Status: FIXED IN CANDIDATE; exact-head CI required.**

The worker DB acceptance test provisions synthetic organizations, identities, geographies, evidence artifacts, source snapshots, crosswalks and inbox rows. It was enabled by a user-set test flag plus `DATABASE_URL`, without requiring CI. Accidental invocation against a persistent database could leave synthetic test records.

Candidate correction: both database integration test suites now require `CI=true`, non-production mode, the explicit integration-test flag and a database URL. The test connection no longer disables TLS verification. The production-shaped baseline capture already had a CI-only guard.

### F-05 — Jurisdiction source-scope guard did not re-run on status-only approval transitions

**Severity: P1 / authorization integrity. Status: FIXED IN CANDIDATE and passed an exact-head disposable PostgreSQL run.**

Manual review found that the source-scope triggers originally ran on INSERT and source/geography changes but did not explicitly include status-only updates. That left a weaker contract for pre-existing pending rows transitioning to approval.

Candidate correction: both request and crosswalk source-scope triggers now include `status` in their UPDATE event columns. The acceptance test asserts both installed trigger definitions include status revalidation. Exact-head CI run [#41187277102](https://github.com/vishaltradewinds/rupaykg/actions/runs/41187277102) passed all workflow steps on the corresponding code/test head. The later deployment-control changes still require their own exact-head CI.

### F-06 — Taxonomy seed is a platform baseline, not official stakeholder authorization

**Severity: P2 / regulatory semantics. Status: OPEN REVIEW CONTROL.**

Migration `20261103_swm_stakeholder_taxonomy_registry.sql` seeds seven taxonomy codes with `BASELINE_SUPPORTED` and a CPCB user-guide source reference. The migration comments correctly say the taxonomy does not confer registration or jurisdiction. Reviewers must nevertheless verify each code/profile against the exact authoritative source/version and confirm application/database authorization never treats `BASELINE_SUPPORTED` as CPCB registration, statutory approval or stakeholder authorization. Existing live production values must be reconciled against the taxonomy before any FK application.

### F-07 — Native account registration and login assurance

**Severity: P2 / identity assurance. Status: OPEN HARDENING.**

The native registration path creates an account identity with platform status `VERIFIED` before organization onboarding/legal review. Organization operational membership remains pending and protected routes require verified membership, which is a meaningful boundary. However, the reviewed path does not show an email-verification challenge or MFA, and login lockout is account-based (10 failures / 15 minutes) rather than a complete IP/device-aware abuse-control strategy. Before broad pan-India onboarding, add verified contact ownership, password reset/recovery controls, MFA for privileged roles, and edge/API rate limiting with monitoring. Do not equate platform account creation with legal identity or organization verification.

### F-08 — Evidence vault content validation and operational scale

**Severity: P2 / operational assurance. Status: OPEN HARDENING.**

The evidence vault enforces a 5 MiB bound, a media-type allowlist, basic file-signature/content checks, SHA-256 integrity, immutable versioning and separate reviewer controls. The current checks are not malware scanning, content disarm/reconstruction, full parser hardening or a large-scale object-storage architecture. Before high-volume production, add malware scanning/quarantine, robust PDF/image/CSV parser limits, storage lifecycle/retention policy, backup/restore and cost/throughput tests. Keep evidence hashes and immutable provenance independent of storage migration.

### F-09 — Government inbox worker is not an operational integration

**Severity: P1 / capability boundary. Status: INTENTIONALLY NOT ACTIVATED.**

The worker is a bounded, leased, retryable, fenced internal intake processor. Its validator is explicitly structural-only; a successful `VALIDATED` state means structural validation and exact jurisdiction crosswalk resolution only. No scheduler, cron, HTTP trigger or startup hook activates it. No official CPCB/BEE API ingestion, signed authority transport, government acknowledgement, authoritative MRV mutation or Guardian/Hedera submission is demonstrated by this worker. Do not activate it until source contracts, signatures/keys, source snapshots, LGD ingestion, independent review, operational SLOs and external acceptance are completed.

### F-10 — Live Neon drift and production verifier divergence

**Severity: P1 / migration integrity. Status: OPEN; read-only audit completed.**

Read-only inspection found:
- Production: 92 migration ledger rows, max dated version 20261021; no async inbox/crosswalk/source-snapshot chain.
- Staging and rehearsal: 95 rows through 20261025; async inbox present, but no crosswalk/source-snapshot chain.
- Rehearsal alone contains the `UNRESOLVED` status constraint/comment without a matching 20261101 ledger row. Schema effect matches the migration, but execution provenance is unresolved.
- Production has stronger verifier authorization provenance/function guards from migration 096 than staging/rehearsal.

No live DDL, migration replay, ledger edits or data writes were performed. Preserve production verifier controls. Do not copy staging/rehearsal wholesale or replay 20261101. Resolve the drift through a separately reviewed evidence-backed reconciliation.

## 5. Existing architecture assessment

| Domain | Evidence observed | Remaining boundary |
|---|---|---|
| PostgreSQL system of record | Migration history, server routes, DB-backed acceptance tests | Actual production/staging data and schema reconciliation |
| Identity and RBAC | Opaque bearer sessions, password hashing, verified membership, role permissions, high-risk DB guards | Contact verification, MFA, abuse controls, independent security review |
| Geography authorization | Explicit organization geography scope and server-side checks | Verified nationwide authoritative geography ingestion/maintenance |
| Field/offline workflows | Offline queue, device and sync routes, idempotency/conflict controls | Real device fleet, connectivity-loss field trials, device key lifecycle |
| Evidence/MRV | Evidence vault, hash binding, reviewer workflow, verification provenance | Real instrument/source integration, calibration/uncertainty evidence, field verification |
| CPCB SWM/BWG | Stakeholder workspaces, workflow state, taxonomy, due/status evidence | Official portal interoperability and source-backed applicability review |
| EPR/statutory | Registration/applicability/return routes and DB controls | Regulator acceptance, exact scheme/source version and filing confirmation |
| Carbon/methodologies | Deterministic calculation and methodology governance packages | Independent methodology approval, actual project validation/verification and issuance |
| Guardian/Hedera | Adapters, policy artifacts and tests exist | Real production credentials, authoritative Guardian response, HCS consensus and Mirror Node proof |
| Registry/settlement | Authorization, append-only controls, external confirmation/reconciliation gates | Live registry/payment provider acceptance and real funds reconciliation |
| UI/UX | Role dashboards, guided stakeholder journeys, multilingual and mobile/offline components | Full usability/accessibility, language coverage, field usability and truth-state audit |
| Observability/operations | Health endpoint, Render config, runbooks | Rate limiting, alerting/SLOs, tested backup restore, incident drills and rollback rehearsal |
| Government inbox | Isolated worker, lease/retry/fencing, jurisdiction resolver tests | Not connected to official source or active in any environment |

## 6. CI evidence and limits

The previous exact-head run [#41187030802](https://github.com/vishaltradewinds/rupaykg/actions/runs/41187030802) passed all workflow steps and produced a before/after schema artifact for the disposable PostgreSQL 16.15 production-shaped reconstruction:
- 92 baseline migration identities; 113 after the proposed chain.
- 67→78 tables; 756→933 columns; 393→523 constraints; 215→249 indexes; 70→89 triggers; 114→132 functions.
- The one removed constraint identity is the legacy inline stakeholder-type check intentionally replaced by the taxonomy FK.
- `prevent_invalid_verification()` definition SHA-256 remained identical before/after.
- The artifact is disposable CI evidence, not a production data clone or live Neon rehearsal.

The status-trigger follow-up exact-head run [#41187277102](https://github.com/vishaltradewinds/rupaykg/actions/runs/41187277102) also completed successfully, including the new trigger-definition assertions.

**The subsequent production migration/startup/TLS/test-safety changes in this audit require the newest exact-head CI result before they can be marked validated.** Earlier green runs do not certify later commits.

## 7. TRL and Shakti gate assessment

### Software

The codebase and disposable PostgreSQL CI demonstrate an integrated software system exercised in a controlled test environment. They do not demonstrate operational performance in a real municipal/ULB/BWG deployment, verified government interoperability, live Guardian/Hedera consensus, real weighbridge/sensor data, independent field validation or sustained operation.

**Provisional software evidence: laboratory/controlled-environment validation only (approximately TRL 4–5, not a formal assessment). TRL 9 is not established.**

### Hardware / IoT

The repository contains field-device UX and software integration contracts, but this code audit did not find a complete production-evidenced hardware package comprising approved device models, firmware, PCB/BOM, sensor calibration certificates, metrology traceability, environmental/EMC/safety approvals, device provisioning/key rotation, field installation, maintenance and measured reliability. MeitY approval/manufacturing evidence is not established by software code.

**Hardware TRL: NOT ASSESSED / NOT ESTABLISHED.** It must be assessed separately and cannot inherit software CI results.

### Pan-India deployment

The data model and geography authorization are designed for national scope, but the presence of a national hierarchy or generic route does not prove a verified all-India directory, state/UT/district/local-body completeness, authoritative code freshness, local statutory applicability, language coverage, support operations or service reliability at national scale.

**Pan-India production readiness: NOT ESTABLISHED.**

## 8. Required next execution batches

1. **Close this audit's exact-head CI gate:** inspect run status and artifact on the latest commit; diagnose any failure; rerun after narrow fixes.
2. **Independent review:** authorized reviewer for migration semantics, source-scope model, worker concurrency/leases, RLS/tenant boundaries, auth/session security, evidence handling and release controls.
3. **Live database reconciliation:** read-only fresh inventory of production/staging/rehearsal; preserve migration 096; resolve 20261101 provenance; validate production data against taxonomy and new constraints on a clone.
4. **Staging rehearsal:** production-equivalent clone, backup/restore proof, migration timing/locking, row counts, query plans, failure injection, rollback/forward-recovery rehearsal.
5. **Deployment controls:** confirm Render deployed commit, environment variables, DB target and TLS chain; migration run must remain a separately approved one-off job.
6. **Security hardening:** rate limits, email/contact verification, MFA for privileged roles, session lifecycle/revocation, evidence malware scanning, secrets rotation, audit-chain concurrency review.
7. **External acceptance:** authoritative government data/source ingestion and contracts; real Guardian/Hedera acceptance; live registry/settlement integration only when legally and technically supported.
8. **Hardware field validation:** MeitY/device eligibility evidence, sensor calibration, weighbridge/edge trials, secure provisioning, environmental tests and maintenance process.
9. **Operational readiness:** backup/restore drills, SLO/alerts, incident response, data retention, privacy, support model and cost controls.
10. **TRL review:** assess software, hardware and integrated service separately using dated test reports, field evidence and independent assessor sign-off.

## 9. Release decision

- PR #157 remains draft.
- No merge, deployment, live Neon write/DDL, migration replay, worker/scheduler activation, Guardian/HCS submission or certification is authorized by this audit.
- Production release: **HOLD**.
- Shakti production certification: **BLOCKED / evidence incomplete**.
- TRL 9: **NOT ESTABLISHED**.

This audit is a working engineering control record. It must be updated as evidence is collected; it is not an independent certification or legal opinion.


## 10. Follow-up regulatory workflow correction — BWG profile intake

A deeper route-level review after the initial audit found a second path in `apps/src/value-routes.ts` that wrote a BWG profile with `status='VERIFIED'` and directly classified `APPLICABLE` / `NOT_APPLICABLE` from hard-coded thresholds. This bypassed the dedicated statutory assessment route's evidence/verification preconditions and independent review boundary.

Candidate correction:
- BWG profile intake now persists `status='PENDING'` and `applicability_status='REVIEW_REQUIRED'`.
- The stored basis explicitly identifies `SWM_RULES_2026_S_O_388_E`, states that this is profile intake only, requires evidence and independent review, and asserts no external registration.
- The API response carries `PROFILE_INTAKE_ONLY_NOT_A_STATUTORY_DETERMINATION`.
- A unit test asserts the profile intake basis cannot claim a statutory determination or external registration.

The separate `/api/v1/statutory/bwg/assess` path remains the assessment workflow and requires its evidence/verification binding plus the dedicated statutory permission. This correction is source-level only until the newest exact-head CI passes; it has not changed any live database.
