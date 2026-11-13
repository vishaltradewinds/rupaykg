# RupayKg Pan-India Enterprise Architecture Gap Audit

**Audit date:** 2026-11-13  
**Repository:** `vishaltradewinds/rupaykg`  
**Audited baseline:** `main` at `385c75174579ba35e5f0bdd928be690e78f03438`  
**Audit branch:** `audit/cto-enterprise-gap-20261113`  
**Scope:** Repository structure, application modules, migrations, tenant-isolation design, evidence/MRV, Guardian/Hedera, regulatory workflows, integrations, deployment manifests, CI and documented operational gates.

## 1. Executive assessment

RupayKg is a substantial modular environmental-compliance and circular-economy platform foundation, not a blank-slate prototype. The repository contains domain packages for carbon, compliance, ESG, intelligence and shared domain logic; an API and web application; 96 SQL migration files; evidence, field-sync, regulatory, registry and settlement workflows; Guardian/Hedera adapters; operational runbooks; and automated CI.

**Architecture direction: retain and harden the existing Environmental Operating System. Do not rebuild it around Kafka, Kubernetes or a microservices rewrite.**

**Release position: NOT APPROVED for pan-India production expansion yet.** The main blockers are tenant-isolation activation and transaction ordering, production role/ownership readiness, external trust-rail acceptance, evidence-storage scale, and unresolved deployment-target governance.

This is a repository-level audit. It does not establish production database state independently, prove live Guardian/Hedera execution, validate physical hardware, or establish field TRL.

## 2. Evidence baseline

- Repository default branch: `main`.
- Audited main SHA: `385c75174579ba35e5f0bdd928be690e78f03438`.
- Repository tree: 449 entries; 96 SQL migration files.
- Main-branch GitHub Actions CI run #6774 on the audited SHA completed successfully on 2026-11-12.
- PR #348 (`cto/20261112-mrv-provenance-rls`) head: `456857bed9d51353564f394adb60ef338d424154`; draft, open, not merged. Its CI run #6943 passed on 2026-11-13 according to the PR record.
- PR #348 explicitly states production Neon was not changed and production remains on HOLD. It also records that migration 101 is not yet in the production ledger and that the current production role cannot SET ROLE to `rupaykg_ddl`.
- No production migrations, role changes, RLS activation, deployment or secret changes were performed during this audit.

## 3. Architecture mapping

| Target capability | Repository evidence | Audit status |
|---|---|---|
| Domain and canonical environmental model | `packages/domain`, carbon, compliance and ESG packages; resource-flow and lifecycle models | IMPLEMENTED FOUNDATION |
| EPR / SWM workflows | CPCB SWM routes, BWG reporting, EPR return routes, scheme and obligation migrations | IMPLEMENTED; official external submission not accepted |
| Carbon dMRV | Carbon calculations, methodology governance, provenance, CCTS methodology registry | IMPLEMENTED FOUNDATION; methodology/registry acceptance gated |
| Evidence vault | Evidence-vault routes, upload/review tests, artifact migration | IMPLEMENTED, bounded storage only |
| Offline field operations | Offline queue, field-sync routes, device enrollment/provenance, sync tests | IMPLEMENTED FOUNDATION |
| Urban/rural operating model | Shared lifecycle with distinct urban and rural workflows documented | ARCHITECTURE IMPLEMENTED; field validation outstanding |
| Generator / Aggregator / Recycler | Stakeholder docs and CCTS entity mapping | DOCUMENTED / PARTIAL WORKFLOW COVERAGE |
| Guardian policy integration | Guardian MRV adapter, policy files, tests and live acceptance runbook | CODE IMPLEMENTED; live policy acceptance pending |
| Hedera HCS provenance | HCS anchor module, Mirror Node verification and tests | CODE IMPLEMENTED; independent live consensus acceptance pending |
| Enterprise integration boundary | External integration contract, mediator, adapter registry | FRAMEWORK IMPLEMENTED; provider-specific production connectors not accepted |
| Agentic AI Swarm | Intelligence package and advisory intelligence route | NOT IMPLEMENTED as a multi-agent runtime |
| National-scale event streaming | No Kafka/event-stream runtime found in repository tree | NOT FOUND / DEFER |
| Object storage | Evidence vault currently stores bytes in PostgreSQL; no production object-storage adapter found | NOT IMPLEMENTED |
| Kubernetes / IaC | No Kubernetes, Helm or Terraform deployment assets found | NOT FOUND / DEFER |
| Observability | OpenTelemetry bootstrap, exporter conformance, runtime and failure-isolation tests | IMPLEMENTED FOUNDATION |
| CI/CD and container | GitHub Actions, Dockerfile, Cloud Build and Render manifest | IMPLEMENTED; deployment target is ambiguous |

## 4. Findings and severity

### P0 — Tenant transaction establishes context too late

**Files:** `apps/src/tenant-db.ts`, `migrations/097_shakti_tenant_isolation_runtime_contract.sql`, `migrations/099_shakti_rls_policy_foundation.sql`.

The current `withTenantTransaction()` sequence queries `organization_memberships` before calling `app.set_request_context()`. The RLS policy for `organization_memberships` is scoped by `app.current_identity_id()` and `app.current_organization_id()`. Before the context is set, the direct membership query can return no rows once RLS is enabled.

The SECURITY DEFINER function `app.set_request_context(identity_id, organization_id)` already validates verified membership before setting transaction-local context. Therefore the safe sequence is:
1. Authenticate the bearer session and resolve verified membership through the governed bootstrap function.
2. Begin the tenant transaction.
3. Call `app.set_request_context(identity_id, organization_id)`; it performs the privileged membership check.
4. Revalidate organization/membership state under the now-active tenant context.
5. Execute the operation and commit.

Add regression tests that execute through the actual non-SUPERUSER, non-BYPASSRLS runtime role with RLS enabled. Include verified membership, revoked membership, suspended identity, wrong organization, and no-context cases.

**Gate:** Do not activate production RLS until the application transaction sequence and tests pass.

### P0 — Production RLS is not yet an evidenced live control

**Files:** `docs/RUPAYKG_ENVIRONMENTAL_OPERATING_SYSTEM_CONTROL_MATRIX.md`, `docs/SHAKTI_TENANT_ISOLATION_ACTIVATION_RUNBOOK.md`, `ops/tenant-isolation/ACTIVATE_RLS.sql`, PR #348.

Main contains the 17-table RLS foundation and controlled activation scripts. PR #348 adds the 18th protected table, `mrv_provenance_events`, through migration 101 and updates the activation/coverage controls. PR #348 remains draft and explicitly says production Neon was not changed.

The PR records that the production migration identity currently cannot SET ROLE to `rupaykg_ddl`; migration 101 is absent from the production ledger. It requires a separately authorized DBA role change, controlled migration, revocation of temporary membership, and a separate reviewed RLS activation with rollback evidence.

**Gate:** Keep production HOLD. Do not merge/deploy code that requires all 18 tables to have RLS enabled until production role provisioning, migration 101, RLS activation, policy coverage and negative cross-tenant acceptance are completed through the approved change process.

### P1 — Main branch protection requires remediation

PR #348 records a 2026-11-13 check showing `main` as unprotected, with protection disabled and no repository rulesets. The GitHub connection could not access the branch-protection administration endpoint, so this finding is recorded as PR-reported rather than independently re-verified in this audit.

**Action:** An authorized repository administrator should enable branch protection/rulesets, require CI checks and review, block force-push/deletion, and restrict direct pushes to `main`. Confirm with a fresh read-only check after configuration.

### P1 — Deployment target is ambiguous

**Files:** `render.yaml`, `cloudbuild.yaml`, `docs/PRODUCTION_TARGET.md`, `docs/PRODUCTION_OPERATIONS.md`, `Dockerfile`.

The repository contains conflicting operational signals:
- `render.yaml` defines a service named `rupaykg-production`, free plan, Singapore region, and automatic deployment after checks pass.
- `docs/PRODUCTION_OPERATIONS.md` describes Render health checks, backups and rollback.
- `docs/PRODUCTION_TARGET.md` describes Cloud Run as the production target.
- `cloudbuild.yaml` builds and pushes an image to Artifact Registry but does not deploy it to Cloud Run.

This is a release-governance and operational-recovery risk, not merely a documentation preference.

**Action:** Select one authoritative production compute/deployment target. Mark the other manifest as non-production/reference or remove it after owner review. Define one deploy pipeline, one health/readiness contract, one backup/restore owner, one rollback procedure and one source of production configuration. Keep Neon as the authoritative database regardless of compute choice.

### P1 — Evidence vault is not national-scale object storage

**Files:** `apps/src/evidence-vault-routes.ts`, `docs/MRV_EVIDENCE_VAULT.md`.

The current implementation stores evidence bytes in PostgreSQL `bytea`, limits files to 5 MiB, supports a narrow media allowlist, performs basic signature/content checks and computes SHA-256. The documentation explicitly says this is a bounded functional foundation, not large-scale object storage, malware scanning, legal-admissibility certification or a complete retention solution.

**Action:** Preserve PostgreSQL as the system of record for metadata, permissions, hashes, versions and review events. Add a tenant-scoped object-storage adapter for binary payloads, with private buckets, short-lived signed access, checksum verification, malware scanning/quarantine, lifecycle/retention rules, backup/restore evidence and immutable audit linkage. Do not store large binary payloads directly in the main transactional tables at national scale.

### P1 — Guardian and Hedera are code-integrated but not externally accepted

**Files:** `apps/src/guardian-mrv.ts`, `apps/src/hedera-anchor.ts`, `docs/GUARDIAN_LIVE_ACCEPTANCE.md`, `docs/ops/GUARDIAN_HEDERA_PRODUCTION_ACCEPTANCE_RUNBOOK.md`.

The repository has a Guardian provider contract, policy-bound native DMRV checks, bounded provider responses, response digest metadata, HCS anchoring, Mirror Node verification and automated tests. The live acceptance document correctly distinguishes CI from external acceptance and requires an actual Guardian execution ID, HCS transaction ID, consensus timestamp and independent Mirror Node retrieval.

**Action:** Complete the disposable MRV evidence demo, then a real authenticated Guardian policy run, HCS anchor, Mirror Node retrieval and exact payload/hash comparison. Keep registry eligibility fail-closed until these proofs are persisted. Do not infer Guardian verification or statutory issuance from a local test.

### P1 — Government and enterprise connectors are boundaries, not accepted integrations

**Files:** `apps/src/external-integration-contract.ts`, `apps/src/external-integration-mediator.ts`, `docs/RUPAYKG_EXTERNAL_INTEGRATION_MEDIATOR_CONTRACT.md`.

The generic mediator has tenant authorization, envelope validation and idempotency. Its own contract says provider-specific authentication, remote execution, response validation and field/production acceptance remain separate gates.

**Action:** Build and accept connectors one at a time against official documentation and authorized credentials. Start with controlled import/export and evidence packages where official APIs are unavailable. Never claim CPCB, BEE, ICM registry, SAP or Oracle connectivity merely because an adapter interface exists.

### P2 — Agentic AI Swarm is not implemented

**Files:** `packages/intelligence/src/index.ts`, `apps/src/intelligence-routes.ts`.

The current intelligence package contains advisory helper functions for material classification, anomaly flags and carbon forecasts. They accept a supplied confidence value and source record IDs; the package explicitly states AI cannot mutate authoritative state. No model provider, agent orchestrator, durable agent runtime, tool registry, evaluation harness or multi-agent execution system was found in the audited tree.

**Action:** Keep the current advisory boundary. Design the Agentic AI Swarm as controlled, auditable services with scoped tools, model/version provenance, prompt/input/output audit, evaluation, budgets, human approval and no direct authority to verify evidence, issue credits or settle value. Do not represent the present helper package as an operational AI swarm.

### P2 — IoT/edge integrations are partial

**Files:** field-device enrollment/provenance, SensorThings interoperability, offline sync and mobile capture modules.

The repository supports device identity/provenance, field sync and offline workflows. The repository does not establish physical acceptance of weighbridges, meters, RFID gates, GPS fleet devices, drone/GIS feeds or SCADA. No Kafka or MQTT runtime integration was found in the audited tree.

**Action:** Define versioned device and measurement contracts. Validate one real weighbridge/device path at a controlled site, including calibration, device identity, clock integrity, offline replay, duplicate prevention, location and evidence. Add MQTT/streaming only after real device and throughput requirements are measured.

### P2 — Horizontal scaling technologies should be demand-led

No Kafka, Kubernetes, Helm or Terraform implementation assets were found in the audited repository. This is not a defect by itself. The current modular monolith, PostgreSQL and asynchronous boundaries should be load-tested before adding distributed infrastructure.

**Action:** Add transactional outbox/reliable worker semantics and measurable queue/latency/back-pressure metrics where required. Introduce Kafka, partitioning, Kubernetes or sharding only when benchmarks demonstrate a need and the team can operate them securely.

### P2 — Migration integrity needs stronger drift detection

**Files:** `scripts/validate-migrations.mjs`, `apps/src/migrate.ts`, `migrations/README.md`.

The validator checks duplicate numeric prefixes and duplicate table/type declarations. The migration runner records version and filename and rejects a filename mismatch for an already-applied version. The ledger does not record a content checksum, so editing an already-applied migration without changing its filename is not detected by this mechanism. Main has 96 migration files; gaps after 087 are not inherently an error, but the authoritative migration ledger and staging/production schema parity must be reconciled.

**Action:** Add SHA-256 checksums to migration ledger verification for new migrations and a controlled baseline/reconciliation process for historical migrations. Never rewrite an applied migration; use forward-only corrective migrations.

### P2 — Readiness documentation is not fully synchronized

`docs/PRODUCTION_READINESS_MATRIX.md` references an older CI run #315 and older trust-rail status wording, while the audited main SHA has a newer successful CI run #6774 and current Guardian/Hedera implementation files. The separate Environmental Operating System control matrix is more current about RLS and external trust acceptance.

**Action:** Establish one generated or maintained status source that references exact branch/SHA, CI run, migration count, external acceptance evidence and production gate. Reconcile duplicate status matrices before using them for investor, government or TRL claims.

## 5. Recommended implementation sequence

| Batch | Priority | Work | Exit evidence |
|---|---|---|---|
| 1 | P0 | Fix tenant context ordering and add RLS-enabled runtime regression tests | Tests pass as non-BYPASSRLS runtime role |
| 2 | P0 | Complete all 18-table RLS inventory and production role/migration/activation plan | DDL preflight, runtime preflight, policy coverage and negative tests |
| 3 | P1 | Protect main and settle deployment target | Required checks/rules and one approved production deploy path |
| 4 | P1 | Upgrade evidence storage architecture | Private object store, malware scan, retention, restore and hash acceptance |
| 5 | P1 | Complete Guardian/Hedera live acceptance | Real Guardian execution + HCS consensus + Mirror Node proof |
| 6 | P1 | Accept regulatory and enterprise connectors individually | Provider-specific conformance and authorized field evidence |
| 7 | P2 | Validate one physical IoT/edge workflow | Real device-to-evidence-to-MRV acceptance |
| 8 | P2 | Build controlled Agentic AI Swarm | Evaluated advisory agents with scoped tools and human approvals |
| 9 | P2 | Run workload and resilience benchmarks | Evidence-based scaling decisions for queues, partitions and orchestration |

## 6. Five-layer blueprint decision

Retain the proposed five logical layers, but implement cross-cutting security/governance and platform operations as mandatory controls across every layer. The immediate target architecture should be:

1. Ingestion and edge adapters.
2. Core environmental data, normalization and event processing.
3. Regulatory and digital MRV engine.
4. Trust, provenance and registry-integrity services.
5. Enterprise, stakeholder and regulatory applications.

Cross-cutting:
- Tenant security, identity, permissions, privacy and audit.
- CI/CD, observability, backups, recovery, performance and cost governance.

Do not add Kafka, Kubernetes, database sharding, HTS tokenization or direct government portal automation as prerequisites to the next release.

## 7. TRL and field-validation position

Repository completeness and passing CI do not establish TRL 9. The current repository supports a software foundation and controlled acceptance tests. Physical instrumentation, Guardian/Hedera live acceptance, actual regulatory workflows, multi-site operational evidence, disaster recovery and independent field verification remain separate evidence gates.

For SITE-JBP-01, retain pre-validation status until official site authority, operator permission, device calibration, real transaction evidence, stakeholder acceptance and operational performance are documented.

## 8. CTO decision

**Proceed with hardening, not architectural expansion.** The next code change should be the P0 tenant transaction ordering fix on an isolated feature branch, followed by RLS-enabled integration tests. Do not activate production RLS or deploy the draft PR #348 until its explicit production prerequisites and separate approval gates are satisfied.

**Truth labels:** IMPLEMENTED = current repository code and tests; PARTIAL = some code exists but external or runtime acceptance is outstanding; NOT FOUND = no implementation found in the audited tree; UNVERIFIED = requires production, hardware, external provider or field evidence.
