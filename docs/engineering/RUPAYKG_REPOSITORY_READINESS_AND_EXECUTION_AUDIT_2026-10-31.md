# RupayKg — Repository-wide readiness and execution audit — 2026-10-31

**Audit disposition: ENGINEERING CANDIDATE; NATIONAL PRODUCTION EXECUTION = NO-GO / HOLD.**  
**Audit basis:** current working branch inventory and exact-head CI, current product/architecture/security/release documents, prior targeted source and PostgreSQL acceptance reviews, and the latest read-only production Neon catalog evidence.  
**This is not:** an independent third-party security certification, statutory approval, production acceptance, or line-by-line review of every tracked file.

## 1. Executive decision

RupayKg has substantial software foundations and a coherent technical direction. It is not an empty prototype. The repository contains a React/Vite/TypeScript web application, a Fastify/Node API, five shared domain packages, PostgreSQL migrations, field/offline-sync and evidence/MRV capabilities, statutory/EPR workflows, carbon/ESG/intelligence logic, registry/settlement guardrails, and an engineering proposal for national government-source intake.

However, **the platform is not yet ready to execute the complete environmental economy as a trusted live national service**. The critical issue is not simply missing features. The current evidence does not yet establish that every stakeholder can complete their real work end-to-end, that all parties can safely access only their permitted records, that production changes can be recovered, or that external statutory and environmental outcomes are accepted by the relevant authorities.

### Readiness verdict by dimension

| Dimension | Audit verdict | Meaning |
|---|---|---|
| Repository and build discipline | PASS WITH QUALIFICATION | Current exact-head CI passes; branch/review governance is fragmented |
| Core software architecture | SUBSTANTIAL FOUNDATION | PostgreSQL-centred modular monolith is a sensible base |
| Core operational workflows | PARTIAL | Important building blocks exist; complete multi-party journeys are not proven |
| Stakeholder work/reporting coverage | INCOMPLETE | Product concept exists, but no complete executable stakeholder work/report contract |
| Application authorization | PARTIAL / ROUTE-DEPENDENT | Authentication, membership and geography checks exist; not universal proof |
| Database tenant isolation | BLOCKED | Production RLS is disabled on all 67 public tables |
| Migration/release integration | BLOCKED | Production ledger and candidate migration history differ |
| Worker execution | ENGINEERING-ONLY | Worker code and tests exist; production identity, authority scope and activation are not approved |
| Regulatory/external acceptance | NOT ESTABLISHED | Internal workflows do not prove official acceptance or registry outcomes |
| Hardware and field operation | NOT ESTABLISHED | Device and offline foundations do not prove qualified, calibrated, supported field deployment |
| Operations and recovery | NOT ESTABLISHED | Restore rehearsal, RPO/RTO, SLOs and live incident readiness are not evidenced |
| Pan-India readiness / TRL 9 | NOT ESTABLISHED | No independent multi-site operational evidence |

**Decision:** continue engineering in controlled batches. Do not declare production-ready, activate workers, run production migrations, or claim TRL 9.

## 2. Fresh repository and integration snapshot

Verified on 2026-10-31:

- Repository: `vishaltradewinds/rupaykg`.
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Pre-audit HEAD: `afbbfeffdc60c614332acee965964de1785ceb1b`.
- Exact-head GitHub Actions run #3942 / ID `41216157190`: completed SUCCESS on that exact SHA.
- PR #175 is OPEN / DRAFT, targets `main`, and points to the working branch.
- PR #161 is OPEN / DRAFT on the same head but has a stacked feature base. It must not be merged independently of its dependency chain.
- PR #173 is OPEN / DRAFT on a separate branch and is a separate authoritative-database/repository-cleanup stream. Reconcile it before integrating overlapping work.
- The open-PR search returned 84 open PRs.
- The current branch compares as 289 commits ahead and 1 behind the observed main base SHA `862512c8c904cef0f604df0350f02672318953af`, with 101 changed files.

Recursive tree at the audited HEAD was complete (not truncated): 396 tracked blobs, comprising 61 API source files, 43 web files, 50 test files, 115 SQL migration files plus migration README, 103 documentation files, 36 shared-package files and 14 route-family files. Five shared packages are present: domain, carbon, compliance, ESG and intelligence.

**Integration risk: HIGH.** A green CI run proves the branch's tested build and acceptance suite passed. It does not resolve a 289-commit branch divergence, stacked PR dependencies, duplicate implementation candidates, or the large open-PR inventory. Merge order must be dependency-driven and reviewed, not based on PR number or green checks alone.

## 3. Architecture and capability findings

The PostgreSQL-centred modular monolith is appropriate at this stage. No evidence justifies splitting it into microservices. The logical architecture is:

1. Stakeholder experience: web workflows and field/offline UX.
2. API/application: Fastify routes, sessions, identity, membership, roles and geography.
3. Shared domain: resource flows, field operations, compliance/EPR, carbon, ESG and intelligence.
4. Evidence and trust: evidence vault, hashes, provenance, verification, methodology snapshots and audit history.
5. Persistence: PostgreSQL as the sole operational system of record.
6. External adapters: regulatory sources, external registries/trust rails, payments and field devices.
7. Controlled system services: migrations, offline sync, government intake and reconciliation workers.

The code and existing audit records support the following capability assessment:

| Capability | What is evidenced in repository | What remains unproven |
|---|---|---|
| Identity and organizations | Session/authentication, verified identity/membership, role and geography checks | Complete route-to-query authorization proof; deployed least-privilege runtime principal |
| Generator and BWG | Product specification includes household/commercial/bulk-generator modes; BWG and SWM route/workspace foundations exist | Full generator-to-collection-to-destination journey, service-provider handoff, reconciliation and complete generator reporting |
| Collection and field operations | Field-device enrollment, offline envelopes, sequence/idempotency and sync controls | Real field-device qualification, sustained offline operation, support and multi-site acceptance |
| Transport and custody | Resource-flow/custody domain foundations and provenance-oriented controls | All transporter workflows, proof of delivery, loss/weight reconciliation and multi-party authorization in live use |
| MRF / aggregator / facility | Facility/resource-flow foundations and related domain concepts | Complete facility operational ledger, stock/input-output reconciliation, capacity/downtime and verified operating data across facilities |
| Recycler / processor | Processing/resource-flow and MRV concepts | Full production-grade process-output and residual balance with real facility evidence |
| Municipality / Panchayat | CPCB/SWM stakeholder workspaces, geography and government intake foundations | End-to-end ward/ULB/Panchayat work queues, contractor SLA, complaints, inspections and official reporting acceptance |
| Producer / importer / brand owner | EPR applicability/return and evidence/authorization controls | Complete obligation-to-eligible-evidence reconciliation and verified portal acceptance for each applicable category |
| Buyer / offtaker | Marketplace/commercial concepts in product direction | Complete buyer-supplier contract, quality, receipt, invoice/payment and commercial dispute lifecycle |
| Auditor / verifier | Evidence vault, verification provenance, authorization and self-verification guards | Independent real-world audit acceptance, full conflict-of-interest and challenge/appeal workflow |
| Regulator / government | Source registry, jurisdiction crosswalk and national intake worker proposal | Official API/source contracts, production worker authority, acknowledgement/correction/revocation and regulator acceptance |
| Carbon/MRV participants | CCTS methodology registry, calculations, evidence binding and lifecycle guards | Approved methodology eligibility, independent validation/verification and external registry issuance proof |
| ESG/reporting users | ESG reporting package and GRI mapping foundations | Governed current source register, full disclosure control ownership and independent assurance |
| Funders / insurers / financial partners | Not established as a complete operating capability in the audited product contract | Financing workflow, disbursement evidence, covenants, risk and performance reporting |

### Important Generator finding

Generator is a first-class stakeholder in the product concept and the product specification already describes household, commercial and bulk-generator operating modes. The repository also contains BWG and CPCB/SWM workflow foundations. That is not the same as a proven generator operating system. No dedicated generator route family was present in the 14 route-family inventory; generator behavior may be served through BWG/workspace routes, but the full journey must be traced before claiming coverage.

Generator work must cover registration, premises/facility, stream classification, generation records, segregation, storage, collection scheduling, handover, receipt, downstream destination, discrepancy handling, applicable compliance and generator-specific reporting.

## 4. End-to-end execution and reporting gap

The current product specification defines a high-level lifecycle and six pillars. It does not yet act as the controlling acceptance contract for every stakeholder.

The required shared lifecycle is:

`Plan/Obligation → Generate → Segregate/Store → Collect → Weigh/Handover → Transport → Receive/Inspect → Sort/Aggregate → Process/Treat → Recover/Dispose → Verify → Report/Recognize`

Each handoff must preserve a stable lot/activity identity, sender and receiver, time, location, measurement method, evidence, quantity/unit, quality/contamination, custody state, applicable rule/methodology version and exception resolution.

The product must produce linked but role-specific reports:
- Generator: generation, segregation, collection, handover, destination, applicable compliance and quantity balance.
- Collector: assigned routes, pickups, missed pickups, weights, contamination, worker activity and handovers.
- Transporter: trips, manifests, dispatch/receipt weights, delays, route exceptions and delivery acknowledgements.
- Aggregator/MRF: inward, sorting/grade, rejection, inventory, dispatch and mass balance.
- Recycler/processor: input, process parameters, recovered output, by-products, rejects/residuals, resource consumption and facility performance.
- ULB/Panchayat: ward/village coverage, collection, processing, contractor performance, complaints, inspections and applicable statutory returns.
- Producer/brand owner/importer: applicable obligations, eligible evidence, EPR fulfilment and submission/acceptance state.
- Buyer/offtaker: orders, quality, receipt, inventory, supplier performance and invoice/payment reconciliation.
- Verifier: evidence completeness, sampling, findings, reproducible calculations, conflicts and signed decision.
- Regulator: authorized jurisdictional view, submissions, inspections, non-compliance, corrective action and enforcement history.
- Carbon/MRV project: boundary, baseline, monitoring, methodology version, calculations, verification and external registry state.
- Funders/insurers: project milestones, disbursements, operating risk, incidents and verified outcomes.

**Critical gap:** there is no single versioned stakeholder work-and-reporting matrix proving that these reports are generated from the same underlying records, with consistent units, definitions, source lineage, permissions and reporting-period rules. The recent human-centred product discussion should be converted into this controlling specification before adding isolated dashboards.

A report must never promote a declared quantity to a verified quantity, a processing record to an eligible environmental outcome, or an internal status to an official regulatory/registry acceptance.

## 5. Critical production security and data-integrity blockers

Latest read-only production evidence recorded in the active resume/security documents:

- Neon sole authority: project `rupaykg-production-fresh`, project ID `steep-mud-79906940`; production branch `main`, ID `br-restless-base-b44cip2h`; database `rupaykg`.
- 67 public base tables; 0 tables with RLS enabled; 0 public RLS policies.
- 92 production migration ledger rows through `20261021`.
- 181 foreign-key constraints; 109 trigger rows across 33 tables and 67 trigger functions.
- Current catalog role evidence includes broad BYPASSRLS and role-creation privileges; `rupaykg` is a member of `neon_superuser`. No verified least-privilege application or worker identity has been established.
- Route families including auth, registry, sync, onboarding hierarchy, intelligence and platform admin have direct/manual database paths requiring distinct identity, bilateral, device or control-plane authorization.
- Transaction-local custom GUCs are useful context transport but are caller-forgeable by a sufficiently privileged direct SQL client; they cannot be the sole RLS authority.
- 39 tables have neither direct `organization_id` nor direct `identity_id` and require FK-derived and semantic ownership classification.
- Full ACL/default privilege/sequence/function execute review and full trigger/function body/search_path/dynamic SQL review remain incomplete.
- Independent backup/restore rehearsal, RPO/RTO and actual application runtime principal remain unverified.

**Disposition: P0 security HOLD.** Do not enable blanket RLS or assume one-organization ownership for bilateral transfers, credentials, settlements, chain of custody, national intake, device sync or platform administration. Complete table-specific ownership and authority design, least-privilege roles, non-forgeable capability validation and positive/negative tests on a disposable production-derived branch before any production change.

## 6. Migration and worker readiness

### Migration integrity
- Production remains at 92 migration ledger rows through `20261021`.
- The working candidate includes the proposed 23-migration worker/source-governance sequence through `20261113`; a production-derived disposable rehearsal reportedly applied that sequence successfully and reached 115 ledger rows.
- That rehearsal is not production. Production has not received the worker inbox/event/crosswalk/source-snapshot schema.
- Repository history contains recovered migration 096 and later date-prefixed migrations; source/ledger divergence and branch ancestry must be reconciled exactly.
- Migrations must remain explicit one-off, reviewed changes; never run automatically during API startup.

### Government intake worker
Engineering foundations include atomic bounded claims, `FOR UPDATE SKIP LOCKED`, lease tokens/expiry, heartbeat, stale-worker fencing, timeout/abort, retries/backoff, quarantine, canonical hashes, timestamp checks, serializable crosswalk/source-snapshot resolution and append-only event design, with unit and disposable PostgreSQL tests.

Still blocking:
- National system-queue versus tenant-scoped authority-scope decision is not approved.
- Production queue schema is not installed.
- Actual dedicated least-privilege production worker identity and grants are not established.
- Worker service, scheduler, monitoring, alerting, recovery and downstream tenant consumer are not deployed/accepted.
- RLS/policies and positive/negative tests for the actual worker principal are not complete.

**Disposition: worker code is an engineering candidate only; worker and scheduler remain OFF.**

## 7. External, regulatory, hardware and operational readiness

- Regulatory source register entries must be archived, hashed, versioned, checked for effective dates/supersession and independently approved before they can authorize production workflows.
- Internal CPCB/SWM/EPR/CCTS workflow code is not proof of an official submission, portal acceptance or regulator approval.
- Hedera/Guardian integration requires live idempotent submission, external consensus/Mirror Node evidence and recovery from ambiguous outcomes; internal hashes or local states are not proof.
- Registry issuance, transfer, retirement and payment settlement require authoritative external confirmation and reconciliation.
- Hardware requires approved device model, sensor/measurement traceability, calibration, firmware/key management, device identity, field maintenance and real acceptance trials. A simulated sensor or software test is not instrument qualification.
- Operations require measured SLOs, queue lag, latency, retry/quarantine, alerting, incident response, secret rotation, access review, backup/restore, disaster recovery, privacy/retention and support.
- Pan-India readiness requires representative urban/rural/industrial contexts, state/UT and local jurisdiction mapping, local languages, accessibility, connectivity constraints, training and service support.

Software TRL remains a provisional internal estimate in the TRL 4–5 range only; no independent assessment is evidenced. Hardware and integrated national service TRL are NOT ESTABLISHED. TRL 9 is NOT ESTABLISHED.

## 8. Repository execution willingness and governance

The codebase shows strong engineering activity: many targeted fixes, migration safeguards, database acceptance tests, worker concurrency tests, security reviews and detailed runbooks. That is positive evidence of engineering intent and capacity.

The repository does not yet demonstrate disciplined execution as one integrated product programme:
- 84 open PRs create a large review and integration surface.
- The current branch is 289 commits ahead and one behind main.
- Multiple PRs contain overlapping migration, worker, security, hardware and documentation work.
- Some historical readiness documents use status labels that can be misread as current production assurance. For example, application-level organization authorization marked GREEN must not be interpreted as database RLS/tenant isolation, which is currently NOT ESTABLISHED.
- The current product specification does not yet bind all stakeholder jobs, handoffs, reports, exceptions and acceptance tests into one executable plan.

**Assessment:** willingness is visible in the engineering history; execution control is not yet strong enough. The remedy is not more parallel PRs. It is one authoritative workstream, dependency-controlled integration, one stakeholder acceptance matrix, explicit owners and evidence gates.

## 9. Ordered execution plan — no skipped gates

### Batch 0 — Establish one integrated execution baseline
1. Freeze new overlapping PR creation except for urgent defects.
2. Inventory all 84 open PRs into: merge candidate, dependency, duplicate, superseded, validation-only, blocked, close-after-evidence.
3. Build a commit/dependency graph; identify the one integration spine and reconcile current branch ancestry with main.
4. Re-run exact-head CI after every integration batch; retain draft status until independent review.
5. Resolve conflicting/stale readiness documents and make the latest resume pointer authoritative.

### Batch 1 — National stakeholder work and reporting contract
1. Create the stakeholder work-and-reporting matrix covering Generator, collector, transporter, aggregator/MRF, processor, ULB/Panchayat, producer/importer/brand owner, buyer/offtaker, verifier, regulator, carbon/MRV participant, funder/insurer and platform operator.
2. Define role, real-world job, inputs, evidence, outputs, handoffs, permissions, reports, exceptions, SLAs and acceptance tests for each.
3. Define the shared material/activity/lot/evidence model and quantity/mass-balance rules.
4. Validate statutory applicability and reporting requirements against current primary sources; preserve separate legal regimes by waste stream and jurisdiction.
5. Convert journeys into end-to-end automated and field acceptance tests.

### Batch 2 — Data security and migration integrity
1. Complete route-handler → SQL callsite → table → operation → principal → authority map.
2. Classify every production table and FK path, including bilateral, national, device, reference and control-plane data.
3. Complete ACL, schema/table/sequence/function grants, ownership, memberships and SECURITY DEFINER/search_path review.
4. Design least-privilege API, auth, migration, worker, event-writer and operations identities.
5. Rehearse table-specific RLS and migration chain on disposable production-derived Neon branch.
6. Test forged context, cross-tenant read/write, pooled connections, revoked membership, bilateral transfers, platform admin, sync replay, triggers and rollback.
7. Obtain independent security review and explicit authorization before production changes.

### Batch 3 — Operational workflows
Implement and prove end-to-end Generator → Collection → Transport → Facility receipt → Sorting → Processing → Output/Residual → Buyer/Offtake, with reconciled quantities and evidence at every handoff. Add offline recovery, disputes, complaints, service-provider contracts, invoices and operational reports.

### Batch 4 — Statutory and independent assurance
Complete source governance, applicable rule snapshots, EPR/BWG/ULB reporting, statutory submission acknowledgement/reconciliation, independent verification and correction/appeal workflows. Keep legal compliance separate from voluntary reporting and carbon-credit eligibility.

### Batch 5 — External integrations and field validation
Qualify actual devices and calibration; verify official source contracts; prove external registry/trust/payment outcomes; conduct representative multi-site field trials; test failure, recovery and support.

### Batch 6 — Production and TRL assurance
Prove backup restore and RPO/RTO; security/incident drills; SLOs; monitoring; capacity; privacy; support; operational continuity; independent acceptance and repeated real-world operation. Only then consider production certification and independently assessed TRL advancement.

## 10. Acceptance gates

The platform is ready to progress only when all applicable gates pass:

- **Human usability:** each stakeholder can complete their actual job without engineer assistance.
- **Completeness:** each activity has required inputs, outputs, reports, handoffs and exception handling.
- **Truth and provenance:** every reported result traces to original source evidence and reproducible calculations.
- **Reconciliation:** quantities and custody balance across all handoffs, with discrepancies explained rather than hidden.
- **Security:** cross-organization and cross-role negative tests prove denied access; actual runtime principals are least-privilege.
- **Recovery:** offline sync, duplicate delivery, failure, restore and incident procedures are demonstrated.
- **Legal legitimacy:** applicable law, authority, methodology and approval are independently verified.
- **Operational proof:** real users, sites, devices, facilities and external systems operate repeatedly under measured conditions.
- **National scalability:** state/local variation, language, geography, connectivity, support and governance are validated.

## 11. Audit boundary and next resume action

- This audit is documentation/evidence only.
- No application code or SQL was changed.
- No production Neon DDL/DML, migration, role/grant/RLS change, branch operation, deployment, worker activation, scheduler activation, external submission or certification action occurred.
- Production remains read-only/HOLD; tenant isolation NOT ESTABLISHED; worker OFF; scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.

**Next executable action:** create and reconcile the National Stakeholder Work-and-Reporting Matrix against actual routes, tables, UI and tests, then use it as the product acceptance contract. In parallel, keep the P0 database/security and migration integration gates ahead of any production execution.
