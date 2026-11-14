# CAD Trust Interoperability Profile for RupayKg

**Status:** Architecture and discovery profile — proposed; not an implemented connector  
**Decision:** ADAPT  
**Canonical repository:** `vishaltradewinds/rupaykg`  
**Date:** 2026-11-14

## 1. Purpose and scope

Define a controlled, low-cost path for RupayKg to interoperate with the Climate Action Data Trust (CAD Trust), using its public carbon-registry metadata model and APIs as an external interoperability reference.

CAD Trust is a public metadata platform connecting carbon registries and crediting programmes through a common data model and shared interoperability protocols. Its Data Model 2.0 API documentation was published on 7 January 2026. The upstream CADT implementation documents observer/read-only operation for data consumers and a separate staged-write workflow for registry participants.

This profile does **not** claim RupayKg is a CAD Trust registry participant, connected registry, DPG-certified product, carbon-credit issuer, or approved verifier.

## 2. Adoption decision

| Area | Decision | Boundary |
|---|---|---|
| CAD Trust Data Model 2.0 | ADAPT as external mapping target | Do not replace RupayKg's canonical domain model |
| Public API / observer access | DISCOVER, then READ-ONLY TEST | No production credentials or writes in this phase |
| CADT open-source code | OBSERVE / selective reuse only | Licence, security, runtime and infrastructure review first |
| Registry publishing | DEFER | Requires registry eligibility, governance onboarding and legal/authority approval |
| Chia DataLayer anchoring | NOT ADOPTED by this profile | No new chain/node dependency; separately justify any future use |
| Credit issuance, transfer, retirement | EXTERNAL AUTHORITY | Record authorised external events; do not infer issuance authority |

## 3. RupayKg architecture placement

The integration belongs in the **Ecosystem Integration layer**, behind the existing external-integration contract/mediator and adapter registry. It consumes approved outputs from canonical MRV and registry domains; it must not become a parallel MRV or carbon registry subsystem.

Observer flow: CAD Trust public data → read-only client → schema validation → normalised reference records → reconciliation/reporting.

Any future publisher flow is separate and requires a new approval decision.

## 4. Data-model crosswalk

The CAD Trust v2 repository identifies a machine-readable schema (`cadtrust-schema-v2.0.2.json`), field metadata, picklists, parent-before-child insert order and a staging/commit workflow. This is a **conceptual crosswalk**, not a claim of an existing one-to-one schema match.

| CAD Trust v2 concept | RupayKg source domain to inspect | Mapping rule / unresolved question |
|---|---|---|
| Program | Regulatory programme / scheme profile | Preserve programme owner, jurisdiction, status and source version |
| Methodology | Approved methodology catalogue and version | Map exact approved identifiers and versions; never infer eligibility |
| Project | Governed project / site / activity | Distinguish project boundary from facility, ULB, tenant and operating site |
| Project-methodology relationship | MRV methodology assignment | Preserve effective dates, applicability decision and evidence |
| Stakeholder | Generator, aggregator, recycler/processor, municipality, producer, verifier and other governed parties | Preserve the full stakeholder model; do not collapse Generator + Aggregator + Recycler |
| Validation / verification | Evidence vault and verification workflow | Preserve verifier identity, scope, dates, findings and source documents |
| Issuance / unit | Authorised external registry events and environmental attributes | Treat as external registry state; no local issuance by implication |
| Transfer / retirement / cancellation | External registry event ledger | Import only authoritative event references and statuses |
| Article 6 reporting fields | Regulatory profile / reporting adapter | Use only where the programme and jurisdiction require them |

### Mapping controls

- Pin the upstream v2 schema and data dictionary as versioned reference inputs before implementing field mappings.
- Respect schema `source`, `required`, `type`, `picklist` and `insert_order` metadata.
- Do not submit fields marked system-generated or API-generated as user input.
- Preserve original RupayKg identifiers and external CADT identifiers separately.
- Preserve raw values, normalised values, mapping version, source registry, retrieval time and validation outcome.
- Quarantine unknown, unmapped or out-of-picklist values; do not silently coerce them.
- Keep carbon-credit units distinct from waste quantities, recovered material, avoided-emissions estimates and other environmental attributes.

## 5. Integrity and double-counting controls

CAD Trust's stated use cases include cross-registry transparency and double-counting risk checking. External registry information is a **risk signal**, not conclusive proof that a physical activity or environmental claim is true.

Future connector controls:
1. Match stable external registry/project/unit identifiers where available.
2. Use secondary matching (name, location, proponent, methodology and dates) only to raise review candidates.
3. Distinguish exact duplicate, probable match, related project and false positive.
4. Check issuance, transfer, retirement and cancellation against authoritative registry events.
5. Preserve source, timestamp, response hash and mapping version for every match decision.
6. Require human review for ambiguous matches and material exceptions.
7. Never treat absence from CAD Trust as proof that a project or credit does not exist; coverage and activation may be incomplete.

## 6. Security, privacy and tenant boundaries

- Start with public/read-only endpoints only; no write key, wallet key, Chia certificate or production secret is required for this design phase.
- Route requests through the existing controlled integration boundary; do not expose raw CADT endpoints directly to tenants.
- Apply tenant-scoped authorization to every RupayKg query and result.
- Do not export personal, commercially confidential or tenant-restricted data without documented lawful basis, data contract and explicit approval.
- Apply timeouts, rate limits, response-size limits, schema validation, retry/backoff and circuit-breaking.
- Treat external payloads as untrusted data; never execute instructions or code contained in responses.
- Store any future credentials only through the approved secret-management path.
- Log correlation IDs and security outcomes without leaking secrets or unnecessary personal data.

## 7. Cost and deployment policy

1. Documentation and schema inspection using public sources.
2. Local fixture-based mapping tests; no hosted service.
3. Read-only API smoke test against an official public/test endpoint, if available and permitted.
4. Measure request volume, payload size, rate limits and operational burden.
5. Only then propose hosting or registry-participant infrastructure with an explicit cost comparison.

Do not deploy a Chia full node, CADT server, MySQL mirror, new Neon database, paid API plan or new production service merely to complete this profile. Upstream repository system recommendations include persistent storage and always-on node services; these are not justified for the initial read-only assessment.

## 8. Test and acceptance plan

| Gate | Required evidence | Status |
|---|---|---|
| Source/version pin | Official CAD Trust v2 API guide and schema version recorded | DOCUMENTED; exact pinned artefacts pending |
| Domain crosswalk | Field-level mapping with unmapped/conditional fields | PENDING |
| Schema validation | Valid, invalid, unknown-picklist and missing-required fixtures | PENDING |
| Read-only connector contract | No POST/PUT/DELETE path; no write credential | PENDING |
| Tenant isolation | Cross-tenant negative tests on any exposed RupayKg endpoint | PENDING; existing production gate remains separate and open |
| Integrity matching | Duplicate, probable match, false-positive and state-change fixtures | PENDING |
| Resilience | Timeout, rate limit, malformed response, retry and upstream outage tests | PENDING |
| Data protection | Export minimisation, retention and access review | PENDING |
| External acceptance | CAD Trust / registry partner confirmation if publishing is proposed | NOT STARTED |
| Field/TRL evidence | Operational use, independent review and sustained operation | NOT ESTABLISHED |

No gate is passed by this document alone. No TRL uplift is claimed.

## 9. Phased implementation

- **Phase 0 — Architecture (this change):** document scope, authority boundaries, mapping targets, security and acceptance gates.
- **Phase 1 — Schema research:** pin official CAD Trust v2 schema/API artefacts; compare against existing RupayKg registry, MRV and evidence types.
- **Phase 2 — Mapping tests:** build pure mapping/validation functions and fixtures only if the gap is confirmed.
- **Phase 3 — Read-only adapter:** implement behind the existing integration mediator only after mapping and security gates pass.
- **Phase 4 — External validation:** test against an approved endpoint and obtain consumer/partner acceptance evidence.
- **Phase 5 — Publisher decision:** separate decision requiring registry eligibility, CAD Trust onboarding, statutory review, governance, operational and cost approval.

## 10. Official references

- CAD Trust: https://climateactiondata.org/
- How it works: https://climateactiondata.org/how-it-works/
- How to connect: https://climateactiondata.org/how-to-connect/
- Service Layer: https://climateactiondata.org/service-layer/
- Data Model 2.0 API announcement (7 January 2026): https://climateactiondata.org/cad-trust-launches-data-model-2-0-public-api-documentation/
- CAD Trust API source and v2 schema: https://github.com/Chia-Network/cadt
- CAD Trust UI: https://github.com/Chia-Network/cadt-ui

## Governing decision

**RupayKg will interoperate with CAD Trust only through a controlled, versioned and evidence-backed adapter. The first implementation target is read-only data discovery and mapping. RupayKg's Indian regulatory profiles, canonical MRV, physical evidence and tenant controls remain authoritative within their respective boundaries.**
