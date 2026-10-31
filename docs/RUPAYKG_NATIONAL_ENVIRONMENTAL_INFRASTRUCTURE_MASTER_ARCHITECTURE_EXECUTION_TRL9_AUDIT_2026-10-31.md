# RupayKg National Environmental Infrastructure — Master Architecture, Execution and TRL 9 Assurance Audit

**Audit date:** 2026-10-31  
**Canonical repository:** `vishaltradewinds/rupaykg`  
**Audit basis:** read-only repository, Neon and Render inspection; review-branch documentation and startup-hardening changes are separately identified below.  
**Release posture:** Production HOLD · worker OFF · scheduler OFF · certification OFF · TRL 9 not claimed.

## 1. Ultimate purpose

RupayKg is intended to become pan-India environmental evidence, compliance and circular-economy infrastructure. It should connect physical material movements to stakeholder obligations, auditable evidence, scientifically defensible environmental outcomes and legitimate economic value.

It is not a replacement for CPCB, BEE, statutory regulators, accredited validation/verification bodies or authorised carbon registries. It prepares, manages, reconciles and exposes evidence and workflows subject to the powers and procedures of those authorities.

## 2. Architecture principles

1. Evidence before claims.
2. Indian statutory requirements and official source instruments are primary; voluntary integrity benchmarks such as ICVCM are supplementary.
3. National governance must not imply unrestricted cross-tenant access.
4. Material mass balance and MRV calculations must preserve source values, uncertainty, discrepancy and reviewer decisions.
5. AI assists extraction and analysis; it does not make final legal determinations or silently alter measurements.
6. Production migration, worker activation, deployment and certification are separate controlled decisions.
7. Shakti Standards apply through discovery, evidence, statutory boundaries, feasibility, design, engineering, testing, independent review, approval, deployment, operation, measurement and continuous assurance.

## 3. Target architecture

### 3.1 National control plane
- Versioned regulatory-source registry and rule catalogue.
- Jurisdiction and facility identity/crosswalk registry.
- National source authentication, intake policy, routing and aggregate operational monitoring.
- Shared identity policy, trust framework, audit governance and integration contracts.
- No unrestricted access to tenant operational records.

### 3.2 Tenant/jurisdiction data plane
- Tenant-scoped organisations, users, roles, facilities and geography.
- Material-flow, evidence, measurement, compliance, project and settlement records.
- Tenant-scoped processing identities and explicit authority scopes.
- PostgreSQL RLS plus application authorization and adversarial cross-tenant tests; dedicated databases as an option for high-assurance institutions.

### 3.3 National ingestion and processing
Recommended target: hybrid national ingestion and authentication, followed by tenant-scoped processing. The worker architecture is a proposal, not approved or active. The national-vs-tenant authority decision must be an ADR with threat model, data classification, statutory basis, cost, operational ownership and acceptance tests.

### 3.4 Shared evidence foundation
- Append-only event history and provenance.
- Immutable/versioned original artefacts, content hashes and signature verification.
- Chain of custody, source attribution, timestamp, actor/device identity and correction history.
- Reconciliation, duplicate detection, dispute state and audit export.
- Retention, legal hold, deletion and privacy controls according to applicable law and contract.

### 3.5 Product domains
1. Identity, organisation, facility and jurisdiction registry.
2. Material traceability and mass balance.
3. Regulatory compliance modules by waste category and stakeholder.
4. Digital MRV and methodology governance.
5. EPR and producer/recycler workflows.
6. Carbon project eligibility, validation/verification and registry reconciliation.
7. Circular-economy marketplace and commercial services.
8. Field/IoT measurement and offline synchronisation.
9. Analytics, AI assistance and national reporting.

## 4. Audit methodology and status meanings

- **Verified:** directly inspected implementation or database evidence supports the statement.
- **Partial:** implementation exists but completeness, enforcement or real-world evidence is missing.
- **Documented only:** plan or schema exists without demonstrated runtime behaviour.
- **Blocked:** a known missing control prevents safe release/activation.
- **Unknown:** the required evidence was not available or was not inspected.

A schema table, route, migration or CI pass is not proof of an end-to-end live operational capability.

## 5. Existing assets verified

### 5.1 Application and domain foundations
The canonical repository contains API and web workspaces and domain packages for domain, carbon, compliance, ESG and intelligence. Production API source includes authenticated organisation workflows, geography checks, resource-flow creation, measurements, regulatory-source listing, BWG/CPCB-SWM, MRV, evidence-vault, registry, settlement, field sync and platform administration route groups.

### 5.2 Production database structures
Read-only inspection identified 67 public base tables in Neon project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`, PostgreSQL 18.6. Structures cover:
- organisations, identities, memberships, roles and sessions;
- geography and organisation geography scopes;
- activities, assignments and resource flows;
- evidence, measurements, observations and provenance;
- carbon projects, calculations and methodology versions;
- EPR, obligations, returns, credits and allocations;
- compliance/BWG/CPCB-SWM structures;
- verification, audit, registry and settlement controls;
- field devices, offline envelopes, cursors and conflicts.

The production migration ledger has 92 rows. The inspected core operational tables had zero rows for organisations, activities, resource flows, carbon projects, carbon calculations, audit events and field devices. Regulatory source, requirement and CCTS methodology catalogues returned 26, 15 and 29 rows respectively. These counts are a point-in-time read-only observation, not a full data-quality certification.

### 5.3 Existing integrity engineering
Repository migration history includes explicit verification permissions, geography-scope enforcement, field-sync idempotency/conflict controls, settlement external-confirmation gates, carbon calculation provenance, methodology governance, Guardian/Hedera/Mirror Node issuance gating, append-only audit/event patterns and reserved-role dual control. Each still requires test coverage and operational qualification at the applicable system boundary.

## 6. Critical audit findings

### F-01 — Database-enforced tenant isolation absent
**Status: BLOCKED.** The authoritative production public schema inspection found 67 base tables, zero with RLS enabled, zero with FORCE RLS and zero policies. Application-level organization and geography checks exist, but PostgreSQL is not enforcing tenant row boundaries. This prevents certification of national multi-tenant isolation and blocks the proposed worker.

**Required:** data classification and tenant ownership matrix; table-by-table RLS policy design; FORCE RLS where appropriate; least-privilege runtime roles; owner/BYPASSRLS analysis; SECURITY DEFINER review; connection-pool context reset; cross-tenant negative tests for every access path; independent security review.

### F-02 — Live deployment database target unverified
**Status: BLOCKED.** Render metadata confirms service `rupaykg` deploys canonical repository `main`; latest observed live deployment `dep-dbis4nm417fc73a8m7ng` runs commit `862512c8c904cef0f604df0350f02672318953af`. Render metadata does not disclose the effective Neon database target. No secret was accessed.

**Required:** safe runtime identity verification returning only database name, server version and non-secret provider/project/branch identity (or an approved equivalent). Compare with the approved Neon project and branch. Never expose DATABASE_URL or credentials.

### F-03 — Web-service startup previously coupled to schema migrations
**Status: REVIEW-BRANCH HARDENING APPLIED; NOT MERGED.** The prior Docker command ran the migration runner before starting the API. The runner creates the migration ledger if absent and applies every repository migration not already recorded, against whichever database DATABASE_URL identifies. This could turn an ordinary web deploy/restart into a schema-change operation.

**Required:** keep migration execution separate from web-service startup; create a distinct, audited migration release procedure using a least-privilege migration identity, exact target verification, ordered full-chain rehearsal, SQL hashes, independent review and change-window approval.

### F-04 — Acceptance seed could be opted into on production
**Status: REVIEW-BRANCH HARDENING APPLIED; NOT MERGED.** The old Docker command ran the acceptance seed. The seed's opt-in variable `RUPAYKG_ACCEPTANCE_SEED_ON_START` differed from the production synthetic-data guard `RUPAYKG_SYNTHETIC_DATA`. If the seed opt-in variable were set, it could insert synthetic acceptance identities, organisation, roles, membership, activity, measurement, evidence, verification and session.

**Required:** production environment must reject acceptance seeding; production web startup must never invoke the seed. Keep fixtures restricted to isolated acceptance environments.

### F-05 — Public ingress / abuse protection
**Status: PARTIAL.** Render service metadata shows public ingress with IP allowlist `0.0.0.0/0`. Authentication and authorization routes exist, but no complete independent evidence for rate limiting, WAF/abuse protection, security headers, incident monitoring or penetration testing was established.

### F-06 — Regulatory source authority and completeness
**Status: PARTIAL.** Regulatory source (26), requirement (15) and CCTS methodology (29) records exist. The full current official source set, legal applicability, effective dates, amendments, supersession, jurisdiction and reviewer provenance have not been independently audited.

### F-07 — Material traceability and mass balance
**Status: PARTIAL.** Resource-flow, measurement, evidence and MRV provenance structures exist. A complete real-world generator-to-collector-to-transporter-to-facility-to-output/reject/disposal chain and mass-balance reconciliation have not been demonstrated.

### F-08 — Real operational evidence absent in inspected core tables
**Status: BLOCKED FOR OPERATIONAL TRL CLAIM.** The inspected production core tables had zero rows for organisations, activities, resource flows, carbon projects, calculations, audit events and field devices. This prevents a claim of sustained live use from those records.

### F-09 — National worker architecture
**Status: BLOCKED.** Proposed worker schema is not present in production. The production-derived rehearsal applied 23 proposed migrations and verified inbox/event/crosswalk/source-snapshot/rule-version relations, but RLS was disabled on the worker relations. Worker PR #161 remains unmerged. No worker activation is authorised.

### F-10 — Deployment CI evidence
**Status: UNKNOWN/PARTIAL.** The latest observed deployed main SHA returned no combined status entries and no PR-triggered workflow runs through the inspected endpoints. This is not proof of failed CI; it is absence of retrieved passing evidence for that exact deployed SHA. The worker PR's separate passing CI does not substitute for main's deployment evidence.

## 7. Domain capability matrix

| Domain | Existing foundation | Required acceptance evidence |
|---|---|---|
| Identity and organisations | DB schema, roles, memberships | Verified onboarding, identity proofing, lifecycle/revocation and tenant isolation |
| Geography/jurisdiction | Geography, source-version and scope structures | Official crosswalks, effective dates, hierarchy reconciliation and authority ownership |
| Regulatory compliance | Sources, requirements, BWG/CPCB-SWM/EPR structures | Rule-by-rule statutory mapping, current-source review, reporting and acknowledgement tests |
| Material chain | Resource flows, activities, measurements | Real end-to-end custody chain, counterparties, mass balance, disputes and audit |
| Evidence vault | Evidence and versions/reviews | Original artefact preservation, signature/provenance validation, retention and export tests |
| MRV | Measurements, observations, calculations, provenance | Independent methodology implementation, calibration, uncertainty, sampling and reproduction |
| Carbon project | Project and methodology governance | Eligibility and boundary review, validation/verification evidence, registry reconciliation |
| IoT | Devices, offline sync and provenance | Approved hardware, device security, calibration traceability and field acceptance |
| EPR | Obligations, returns, credits, allocations/transfers | Current rule coverage, authorised entity validation and reconciliation with official systems |
| Settlement | Guardrails and external confirmation | Real authorised counterparties, external confirmation and reconciliation |
| Marketplace | Value/registry/settlement foundations | Real transactions, customer validation, dispute handling and commercial unit economics |
| AI | Intelligence package and routes | Dataset evaluation, accuracy thresholds, human review, model/version traceability and safe fallback |
| National operations | Render web service, worker proposal | Tenant isolation, operational SLOs, DR, monitoring, incident response and regional resilience |

## 8. TRL assurance model

Do not assign one blended TRL to the whole product. Maintain a separate evidence ledger for:
- core platform;
- regulatory engine;
- material traceability;
- digital MRV;
- IoT/measurement;
- carbon-project workflow;
- EPR workflows;
- national multi-tenant infrastructure;
- marketplace/settlement.

TRL 1–3: scientific basis, concept and analytical validation.  
TRL 4–5: component and integrated laboratory validation.  
TRL 6: demonstration in relevant environment.  
TRL 7: integrated system demonstration in actual operational environment.  
TRL 8: complete system qualified through testing, security and operational acceptance.  
TRL 9: sustained proven operation with real users, real data, support, independent evidence and repeatable outcomes.

Each TRL claim must identify the test article/version, operating environment, users, test duration, sample size, acceptance criteria, failures, corrective actions, independent reviewer and evidence artefact. A code build or database schema alone cannot establish TRL 9.

## 9. Ordered execution programme

### Batch 1 — Canonical truth and repository governance
- Keep one canonical implementation repository and one authoritative production database.
- Reconcile main, PR #161, PR #173 and related migration history.
- Preserve historical evidence; archive obsolete snapshots rather than deleting source history.
- Maintain a dated current-source-of-truth checkpoint and append-only execution log.
- Record exact commit SHA, blob SHA, CI run, deployment and database evidence for each batch.

**Exit:** no contradictory current checkpoints; migration files/ledger provenance reconciled; one approved release path.

### Batch 2 — Production runtime and security boundary
- Verify Render runtime database identity without exposing secrets.
- Remove schema migration and acceptance fixture writes from ordinary web-service startup.
- Establish a distinct controlled migration operation and least-privilege migration identity.
- Design and implement RLS/tenant isolation, with independent negative tests.
- Add rate limiting, security headers, abuse controls, monitoring, incident response and DR.

**Exit:** exact runtime target verified; startup is migration/fixture-free; database isolation independently tested; security and recovery acceptance signed.

### Batch 3 — National regulatory authority
- Reconcile official source register and rule versions.
- Build state/ULB/district/facility jurisdiction crosswalk with provenance and effective dates.
- Map each stakeholder obligation to exact statutory clause, authority, deadline, evidence and reporting interface.
- Separate waste-category modules; do not conflate regimes.

**Exit:** independent legal/regulatory review of scope and versioned applicability matrix.

### Batch 4 — Physical material chain and evidence
- Implement complete custody chain and source/destination authority checks.
- Reconcile input, recovered output, rejects, losses and stock.
- Integrate weighbridge and facility evidence with instrument identity and calibration.
- Preserve discrepancies and human adjudication.

**Exit:** witnessed end-to-end material flow with reconciled records and independent audit.

### Batch 5 — MRV and carbon integrity
- Freeze methodology source/version and applicability.
- Independently reconcile equations, factors, baselines, uncertainty, leakage and conservativeness as applicable.
- Verify calibration and measurement lineage.
- Separate platform-prepared project evidence from independent validation, verification and registry issuance.

**Exit:** reproducible independent calculation and eligible project evidence package.

### Batch 6 — National processing architecture
- Approve hybrid national-ingestion/tenant-scoped-processing ADR.
- Complete control-plane/data-plane contracts and authority mapping.
- Implement queue permissions, idempotency, retries, quarantine, replay controls and audit.
- Enforce RLS and tenant-bound identities before worker activation.

**Exit:** cross-tenant adversarial suite passes; independent security approval; explicit operational activation approval.

### Batch 7 — Commercial and national operations
- Validate customer value and commercial willingness to pay.
- Establish service ownership, support, SLOs, monitoring, backups and restore.
- Expand by jurisdiction only with repeatable onboarding and statutory acceptance.

**Exit:** repeatable deployments, real customers and sustained operational evidence.

### Batch 8 — TRL qualification and continuous assurance
- Assess each component separately.
- Obtain independent technical, regulatory, security and operational reviews.
- Record residual risks and formal acceptance.
- Claim TRL 9 only after sustained operational proof.

## 10. Immediate execution decisions

1. **Keep production HOLD.**
2. **Keep worker and scheduler OFF.**
3. **Do not merge/deploy migration-bearing PRs until provenance and full-chain rehearsal are independently accepted.**
4. **Do not claim Render uses the authoritative Neon main until safe runtime identity verification succeeds.**
5. **Do not claim tenant isolation while RLS is absent.**
6. **Do not seed acceptance data in production.**
7. **Do not certify or claim TRL 9 without independent operational evidence.**

## 11. Review-branch changes in this audit batch

The following proposed changes are recorded on the existing cleanup review branch only:
- Docker web-service startup changed to start only the production API server; migration runner and acceptance seed are no longer implicit startup commands.
- API package start script changed to start only the production API server.
- Acceptance seed now rejects `NODE_ENV=production`.
- This audit and runtime security assessment are documented here and in the append-only execution log.

These changes are not merged, deployed or applied to the live database. Review-branch code head `88ce5125ff658c4401d892d0b501d89d3a07eb03` passed GitHub Actions run [#41211914512](https://github.com/vishaltradewinds/rupaykg/actions/runs/41211914512); independent reviewer validation remains required.

## 12. Open evidence requests

- Safe Render runtime identity check for actual database/project/branch.
- Full CI status for exact deployed main commit, including workflow runs not limited to PR-triggered events.
- Complete current migration tree and ordered migration provenance diff against both live ledger and worker PR stack.
- RLS policy design and adversarial tenant-isolation test plan.
- Full official regulatory source and jurisdiction audit.
- Real facility operating evidence, calibrated measurement evidence and independent MRV review.
- Backup/restore and disaster-recovery test reports.

## 13. Audit conclusion

RupayKg has substantial application, database, compliance, carbon, evidence, verification, field-sync, registry and settlement foundations. It is not starting from zero.

The inspected evidence does not establish a complete national regulatory operating system, database-enforced tenant isolation, verified live database binding for Render, sustained real-world material-chain operations or TRL 9. The highest-value next work is to establish canonical truth, remove risky deployment side effects, close security boundaries, validate statutory authority and demonstrate real end-to-end operations.

**Final status: engineering foundation exists; national infrastructure qualification remains in progress; production HOLD; worker OFF; scheduler OFF; certification OFF; TRL 9 not claimed.**


## 14. Tenant isolation catalog and role finding — 2026-10-31

A second read-only catalog pass enumerated all 67 public base tables, direct organization columns, multi-party organization references and foreign-key relationships. The provisional table-by-table classification and RLS security model are recorded in [Tenant Isolation and PostgreSQL RLS ADR — Draft](engineering/RUPAYKG_TENANT_ISOLATION_RLS_ADR_DRAFT_2026-10-31.md).

A significant additional finding: the inspected Neon session role rupaykg has rolbypassrls=true, rolcreaterole=true, rolcreatedb=true, rolsuper=false and rolcanlogin=true. This is the inspection login; it does not establish that Render uses the same login. The actual Render runtime principal remains unverified. This role is privileged and cannot be treated as a least-privilege web or worker identity.

The ADR rejects plain caller-controlled PostgreSQL custom settings as sole identity proof, because a database session can set arbitrary custom GUC values. A signed short-lived request context or tenant-specific database identities must be evaluated in a disposable rehearsal with adversarial SQL-injection and pool-reuse tests. No production role, grant, policy or schema changes were made.
