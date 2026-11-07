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
