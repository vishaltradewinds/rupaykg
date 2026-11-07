# RupayKg National Capability and Gap Matrix — Initial Repository Review

**Review date:** 2026-11-07  
**Repository reviewed:** `vishaltradewinds/rupaykg`, `main`  
**Architecture priority:** National deployment objectives first; SITE-JBP-01 Kathonda is the first deployment/validation instance of the same architecture.  
**Review type:** Initial review of canonical architecture/production documents and their stated readiness evidence. This is not a fresh source-code audit, production penetration test, field acceptance, statutory opinion or independent certification.

## 1. Executive assessment

The canonical repository already documents the correct national product direction: one authoritative data model, geography-aware authorisation, urban/rural operating hierarchies, offline field capture, evidence-backed MRV, compliance/EPR, environmental credentials, registry operations, governed settlement and reporting.

The product's documented core is therefore broader than a standalone Jabalpur pilot. The main remaining question is not whether to design a separate national platform; it is whether the current implementation, external integrations, security/operations and field evidence are sufficient to deploy that shared product repeatedly across jurisdictions.

**Initial decision:** retain the national-first architecture; do not create a Jabalpur-only technical branch or a separate pilot database. Focus the next engineering cycle on independently proving the existing foundations, closing the external trust and field-instrumentation gates, validating government/enterprise customer use cases and demonstrating repeatable multi-jurisdiction deployment.

## 2. Evidence reviewed

| Canonical main file | Blob SHA | What it establishes |
|---|---|---|
| `docs/PRODUCTION_TARGET.md` | `da9e128235b0a89f34512d1a6b054713b18372ea` | National data-model target, operational lifecycle, trust boundary, production configuration, offline operation, geography and stakeholder model |
| `docs/MRV.md` | `288ae4f28cb1f9a4cf4fd1202bb0cd62a1875270` | Activity → measurement → evidence → verification → calculation → credential chain and measurement provenance fields |
| `docs/REGISTRY.md` | `2d88e5ede1f86cd4f02cb669e73c52a88954c30d` | Credential issuance gates and registry lifecycle |
| `docs/PRODUCTION_READINESS_MATRIX.md` | `0cb8b7a817903e3faffce253bf1b2f67c453498b` | Repository-stated test coverage and remaining runtime/external gates |
| `docs/PLATFORM-CORE-OBJECTIVES-AND-REGULATORY-ALIGNMENT-2026.md` | `b048679fd81b99953c39b4a78be0e32eed01dbfa` | Regulatory-first product objectives and urban/rural/enterprise/carbon operating surfaces |

The readiness matrix is a repository-authored evidence record. Its recorded GREEN/AMBER/NOT_VERIFIED statuses are not independently re-run or certified by this document. Latest CI results must be checked against the exact commit under review.

## 3. Capability assessment

Status meanings:
- **DOCUMENTED / REPO-CLAIMED GREEN:** current canonical documentation describes the capability and the readiness matrix records tests or database controls. Re-run current CI and inspect implementation before relying on it for a deployment.
- **AMBER / PARTIAL:** the software contract exists but external configuration, data, approvals, hardware or runtime acceptance is still required.
- **NOT VERIFIED / OPEN:** no adequate current proof was identified in the documents inspected.

| National capability | Current repository evidence | Initial status | Remaining proof for national deployment |
|---|---|---|---|
| One authoritative operating data model | Production target states one authoritative national data model and server-side truth lifecycle | DOCUMENTED | Source-code and migration audit; one authoritative live database; real production data lineage |
| National geography and organisation hierarchy | India → State/UT → District → Sub-district → ULB/Gram Panchayat → Ward/locality or village/cluster is documented | DOCUMENTED | Verify complete real-world jurisdiction/reference data, delegation model and cross-jurisdiction tests |
| Tenant, organisation and geography authorisation | Readiness matrix records organisation and geography authorization as GREEN with server-side tests | REPO-CLAIMED GREEN | Re-audit RLS, runtime role privileges, BYPASSRLS, tenant-scoped queries and isolation with independent negative tests; deploy verified policies in controlled change |
| Urban, rural and enterprise workflows | Platform core objective documents separate operating surfaces on a common trust core | DOCUMENTED | Prove each customer segment's end-to-end workflows and legal applicability; field and customer acceptance |
| Offline field capture and synchronisation | Production target defines stable device identity, monotonic sequence, timestamps, idempotency, conflict handling and server authority; readiness matrix records offline sync GREEN | REPO-CLAIMED GREEN | Test with real devices/connectivity constraints, field-user workflows, attachment recovery, device revocation and SITE-JBP-01 acceptance |
| Resource-flow lineage | End-to-end lifecycle covers generation, aggregation, measurement, transport and processing | DOCUMENTED | Verify physical process records, calibrated equipment, real organisation/site participants and quantity reconciliation |
| Digital MRV and evidence | MRV document defines source activity, method/unit, timestamp, actor/device, geography, evidence and review state | REPO-CLAIMED GREEN for core chain | Verify real measurement sources, uncertainty/quality methods, methodology-specific acceptance, independent verifier workflow and external audit |
| Regulatory applicability and compliance | Core objectives require jurisdiction/entity/framework/obligation/evidence/methodology/authority checks; current platform documents SWM 2026 as baseline | AMBER | Maintain authoritative source register and local-body/SPCB/CPCB applicability; obtain legal/regulatory review for each customer context |
| Carbon methodology execution | Readiness matrix marks generic calculation and methodology governance AMBER | AMBER | Source-locked method versions, numerical reconciliation, independent regression, regulatory acceptance and external methodology/registry evidence |
| External Guardian/Hedera trust rail | Production target requires external execution IDs and fail-closed behavior; readiness matrix records external trust rails NOT_VERIFIED | NOT VERIFIED / P0 | Prove real authenticated Guardian workflow, Hedera transaction/consensus and Mirror Node verification; retain correlation and provenance evidence |
| Credential/registry lifecycle | Registry document specifies issuer identity, source/evidence verification and ISSUED → ACTIVE → TRANSFERRED → RETIRED | REPO-CLAIMED GREEN for internal state controls | Verify asymmetric W3C credential signing, issuer trust roots, external verification and real registry/depository acceptance |
| Governed settlement | Production target requires external reference, authority confirmation and reconciliation before SETTLED; readiness matrix records database/runtime controls GREEN | REPO-CLAIMED GREEN for workflow controls | Prove one lawful real settlement integration and reconciliation in a controlled customer environment; internal state is not proof funds moved |
| External APIs / DPG integrations | Production target describes external integration boundaries; no DPGA candidate has been approved for production in current DPG sourcing record | NOT VERIFIED / no approved DPG dependency | Identify a customer-backed gap, select one replaceable adapter, verify licence/SBOM/security and pass integration/quarantine tests |
| Physical instrumentation and IoT | Production readiness matrix marks physical instrumentation AMBER; telemetry candidates are now in research | AMBER | Calibrated weighbridge/device, edge identity, protocol tests, tamper/clock controls, site acceptance and support ownership |
| National performance and scale | National deployment is target; no multi-state load/capacity result was identified in reviewed documents | NOT VERIFIED | Define national workloads; run load, capacity, resilience, availability, failover and recovery tests using stated assumptions |
| Operational continuity | SHAKTI production gate lists monitoring, backup/restore and rollback evidence as open | OPEN | Prove alerting, incident response, backup retention, restore drill, disaster recovery, rollback and on-call ownership |
| Government-led ecosystem deployment | Product target permits integration with authoritative external systems but does not confer government authority | NOT VERIFIED | Named sponsoring institution, data-sharing/legal authority, procurement/contract, security acceptance, API permission and deployment acceptance |
| Commercial product-market validation | Commercial strategy defines packages and revenue streams | STRATEGY DOCUMENTED | Buyer interviews, named budget owners, procurement route, paid pilot/contract, delivery margin, recurring cost and renewal evidence |
| DIGICORE INFRASYS IP and operating role | Strategy identifies the intended engineering/IP/commercialisation role | INTENDED, RIGHTS UNVERIFIED | Legal entity/name evidence, assignments, contributor rights, trademarks, third-party notices, SBOM, customer contracts and insurance/legal review |

## 4. Priority gaps and next execution sequence

### P0 — prove the platform before extending it

1. **Database and tenant isolation:** reconcile migration history, authoritative Neon/PostgreSQL database, production connection role, RLS state/policies, BYPASSRLS and service-level authorization. No production policy/role mutation without a reviewed plan, backup and acceptance tests.
2. **External trust rail:** establish real Guardian/Hedera acceptance; no simulated or fabricated transaction, consensus, credential or mirror-node proof.
3. **Physical field anchor:** confirm the actual Jabalpur weighbridge and device interfaces, identity, calibration, timestamping, offline behavior, duplicate handling and failure/recovery evidence.
4. **Operational recovery:** monitoring/alerts, backup, restore, rollback, incident process and owner evidence.
5. **National scope tests:** validate cross-organisation, cross-jurisdiction, delegation, data export and isolation; define workload and test capacity before calling the platform nationally deployable.

### P1 — targeted reuse and commercial validation

6. **ODK connector assessment:** compare ODK import with existing RupayKg field capture; test only on synthetic/non-personal data in an isolated quarantine path.
7. **Sunbird Obsrv telemetry assessment:** evaluate whether event ingestion/monitoring can reduce custom edge/device engineering; no production dependency until build, security and operations are proved.
8. **FarmStack / OpenFn integration review:** validate real partner data-sharing and connector needs; resolve exact component and licence first.
9. **National master data and registry review:** check if GeoPrism or Sunbird RC solves a gap not already served by RupayKg; maintain one system of record.
10. **Buyer validation:** validate one public-sector/ULB use case and one enterprise/project use case with budget owner, procurement route, service scope and cost-to-serve.

### P2 — prepare repeatable government deployment

11. Prepare a government deployment pack: reference architecture, data-sharing schedule, API catalogue, threat model, security evidence, hosting/operations model, SLA, disaster recovery and exit/portability.
12. Validate deployment and support playbooks across a second jurisdiction only after SITE-JBP-01 acceptance and national readiness gates are passed.
13. Complete DIGICORE INFRASYS company/IP prerequisites before representing it as legal IP owner or contracting operator.

## 5. Required national acceptance test suite

The next national-level acceptance plan must include at least:

- tenant A cannot read/write tenant B records through direct API, background jobs, exports, analytics or database access;
- a user delegated to one State/UT or ULB cannot operate outside the assigned geography;
- national/state/district/ULB/GP/enterprise hierarchy changes are auditable and do not silently broaden permissions;
- offline envelopes with duplicate, out-of-order, revoked-device, altered identity, stale clock and conflicting payloads are handled deterministically;
- measurement/evidence/verification/calculation states remain separate, with no value eligibility on missing evidence or unauthorized decisions;
- external Guardian/Hedera timeout, rejection, duplicate submission and consensus delay fail closed and recover idempotently;
- credential issue/transfer/retirement uses the correct issuer, signature and external registry result;
- settlement cannot finalize without external confirmation and reconciliation;
- integrations preserve source identifiers, schema versions, data purpose, geography, provenance and quarantine states;
- backup restoration, service recovery and rollback meet explicit RTO/RPO targets;
- load tests use national operating assumptions and publish measured capacity/limits;
- Jabalpur field acceptance confirms the shared product under real site conditions, with device and operator evidence.

## 6. Commercialisation translation

The first commercial offers should be sold as measurable engineering and operations services, not as access to a DPG or a promise of regulatory approval:

1. Government/ULB environmental operations implementation.
2. Enterprise resource-flow and compliance operations SaaS.
3. Digital MRV onboarding and managed evidence/measurement operations.
4. Data exchange, connector and interoperability engineering.
5. Device/weighbridge/telemetry integration and managed operations.
6. Data quality, reconciliation and audit-pack preparation.
7. Managed hosting, support, security operations, backup and SLA.
8. Public environmental-data portal as an optional separately licensed service.

Each offer requires a named buyer, valid operating authority, price/cost evidence and acceptance criteria. A verification outcome, statutory approval or regulator decision is never a billable success fee.

## 7. Evidence control and limitations

- This matrix derives from the current canonical main documents identified in Section 2 and their stated readiness evidence.
- A repository readiness status is not an independent audit; inspect source code and execute CI/runtime acceptance at the commit being released.
- No source code was changed as part of this assessment.
- No DPG was integrated and no external production service was called by the platform.
- No field operation, site equipment, government programme, customer or national deployment was newly validated by this review.
- GDPIR's requested `dpicatedata` page remains inaccessible (HTTP 403 from this research environment on 2026-11-07); its exact records and schema remain unverified.
- Production, SHAKTI certification, statutory, external trust, national readiness and TRL gates remain separately controlled.

**Decision:** proceed with national-first engineering. Complete P0 proof and buyer validation before expanding the integration portfolio or representing RupayKg as nationally deployable.


## 8. Fresh read-only Neon production and rehearsal audit — 2026-11-07

**Source:** Neon project `rupaykg-production-fresh` (`steep-mud-79906940`), default branch `main` (`br-restless-base-b44cip2h`), database `rupaykg`. All queries in this section were read-only catalog/metadata SELECTs. No production DDL, DML, role/grant change, migration, branch mutation or deployment was performed.

### 8.1 Production main — verified database facts

| Control | Observed value | Determination |
|---|---:|---|
| Public base tables | 67 | Confirms the current production application table count |
| Tables with RLS enabled | 0 / 67 | **BLOCKED** |
| Tables with FORCE RLS | 0 / 67 | **BLOCKED** |
| Rows in `pg_policies` for `public` | 0 | **BLOCKED** |
| Owners of public tables | 67 / 67 owned by `rupaykg` | One login identity owns all application tables |
| `schema_migrations` rows | 92 | Production schema ledger count |
| Maximum migration version | `20261021` | Latest applied ledger version observed |

Observed login/superuser roles on this branch:

| Role | Login | Superuser | Create role | Create database | BYPASSRLS | Observation |
|---|---:|---:|---:|---:|---:|---|
| `cloud_admin` | Yes | Yes | Yes | Yes | Yes | Administrative/superuser identity |
| `neon_service` | Yes | No | Yes | Yes | Yes | Neon service identity; member of Neon-managed `neon_superuser` |
| `rupaykg` | Yes | No | Yes | Yes | Yes | Owns all 67 public tables and is a member of `neon_superuser` |

The inspected `rupaykg` role has grantable `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` privileges across all 67 public tables (469 table-privilege entries marked grantable). It is not an acceptable least-privilege application runtime identity.

No separate `rupaykg_app_runtime` or `rupaykg_auth_runtime` login role was present in the production-main role inventory at this snapshot.

A read-only `pg_stat_activity` summary showed four sessions via `pgbouncer` under `rupaykg` (one active, three idle). The query cannot attribute each session to the Render application versus other clients, so this is **not** independent proof of the deployed service's exact runtime identity. The Render service's actual `DATABASE_URL` role remains unverified. The lack of a separate application role on production main nevertheless makes the privileged `rupaykg` account a critical cutover concern.

The Neon default `main` branch was reported as not protected in branch metadata. This is a Neon branch setting, not a finding about GitHub branch protection; it should be reviewed separately.

### 8.2 Existing rehearsal branches — separate from production

| Branch | Public tables with RLS | FORCE RLS | Policies | Ownership / role finding | Scope |
|---|---:|---:|---:|---|---|
| `rupaykg-tenant-isolation-lab-20261101` (`br-blue-tooth-b4kvuut7`) | 22 / 67 | 4 | 88 | All 67 tables remain owned by `rupaykg`; includes a distinct `rupaykg_app_runtime` login with `BYPASSRLS=false` and role-targeted tenant policies | Partial policy rehearsal; 45 public tables still have RLS disabled |
| `rupaykg-role-split-rehearsal-20261106` (`br-dry-base-b42zrepz`) | 0 / 67 | 0 | 0 | All 67 tables are owned by `rupaykg_owner_model_20261106`; non-admin runtime-role prototypes exist with restricted table privileges | Ownership/privilege split rehearsal only; no RLS/policy set |
| `rupaykg-rls-assurance-lab-20261101` (`br-red-salad-b4oqb4nx`) | 1 / 67 | 1 | 1 | One `epr_returns` policy targets `rupaykg_app_runtime`; no complete runtime/table coverage | Narrow RLS mechanics experiment only |

The tenant-isolation lab's 88 policies are explicitly scoped to its rehearsal runtime identity. The lab is not production and its database table ownership still resolves to `rupaykg`. Do not infer that the existence of policies in this branch enables policies or changes privileges on production main.

### 8.3 Reconciliation with the existing Shakti engineering work

- [PR #321 — Batch C FK-path RLS rehearsal](https://github.com/vishaltradewinds/rupaykg/pull/321) is a draft validation-only PR whose exact-head CI run #5867 completed successfully. Its disposable PostgreSQL rehearsal derives predicates from FK paths, tests SELECT/INSERT/UPDATE/DELETE using distinct non-owner `NOBYPASSRLS` roles, and covers 18 single-owner tenant paths. It deliberately excludes nine multi-party tables pending explicit domain authorization semantics. This is useful engineering evidence, not production RLS activation.
- [PR #323 — G-002 primary-repository authority reconciliation](https://github.com/vishaltradewinds/rupaykg/pull/323) adds a startup guard that blocks superuser, CREATEROLE, CREATEDB, replication and BYPASSRLS runtime roles, plus migration/live-schema authority guards and a controlled runtime-role cutover runbook. It is open and not deployed; its associated workflow was reported as `action_required` in the observed run. G-002 remains open because the deployed service identity and production RLS/A/B proof are not yet established.
- The PR #321 rehearsal uses disposable policy fixtures and simple transaction-local organization test context. Its results must not be treated as proof that the production authenticated-session context, every protected application route, worker path or external service uses the same identity/context correctly.
- Nine multi-party tables remain excluded from single-owner policy assumptions: `bwg_waste_reports`, `chain_of_custody_links`, `credentials`, `epr_credit_allocations`, `epr_credit_transfers`, `epr_credits`, `registry_events`, `settlements`, and `settlement_events`. Each requires its own actor/counterparty/business-operation authorization model.

### 8.4 Corrected P0 order

1. Complete the G-002 production migration/source authority reconciliation on the canonical repository; do not replay historical migration 096.
2. Establish, independently, the exact database role used by the deployed application. The application must not run as `rupaykg`, a superuser, a role with CREATEROLE/CREATEDB/REPLICATION, or any `BYPASSRLS` identity.
3. Complete non-production role cutover and startup-guard validation with least-privilege grants. Do not put owner/migrator credentials in the application runtime.
4. Finish the full application request/worker/context coverage and policy-family mapping before enabling RLS. Keep global/reference, identity/control-plane and multi-party records outside blanket policy generation.
5. Extend FK-path policy rehearsal to every approved single-owner table and complete dedicated multi-party policy design. Include transaction-pool context, revocation/suspension, concurrency, worker/system actor, export, analytics and negative cross-tenant tests.
6. Complete rollback/restore rehearsal and independent DBA/security review.
7. Only then submit a separately approved, staged production change plan for runtime-role cutover and table-by-table RLS activation. Production remains READ-ONLY/HOLD until the change is authorised and evidence gates pass.

**Current production tenant-isolation decision: FAIL / BLOCKED.** Application-layer checks and successful disposable tests do not compensate for zero production RLS policies and a table-owning BYPASSRLS role. No nationwide multi-tenant security/readiness claim is permitted on this basis.
