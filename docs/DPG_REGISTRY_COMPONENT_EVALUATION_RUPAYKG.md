# DPGA Registry — RupayKg Component and Commercial Integration Evaluation

**Assessment date:** 2026-11-07  
**Canonical implementation repository:** vishaltradewinds/rupaykg (main)  
**Purpose:** Evaluate DPGA-listed digital goods for integration into RupayKg and identify monetisable implementation services.  
**Decision:** Use the registry as a discovery and sourcing catalogue; shortlist selected components for controlled evaluation. No software is approved for production integration by this document.

## 1. Executive decision

The DPGA Registry is a source of existing open digital goods that may reduce duplicate engineering and accelerate interoperability. It is not a guarantee that a listed product is suitable for RupayKg, secure in our deployment, legally compatible with every integration model, production-ready for our workload, or approved by an Indian regulator.

**Commercial direction:** RupayKg remains a proprietary commercial platform. Use existing DPGs as separately governed dependencies or external services where they solve a verified customer problem. Monetise RupayKg's own value through product subscriptions, integration engineering, managed hosting/operations, customer configuration, support, SLAs, implementation and assurance services.

Do not:
- open-source the RupayKg application or private workspaces merely to use DPGs;
- fork, embed, redistribute, modify or host a DPG until its exact component licence and obligations are reviewed;
- replace existing authoritative RupayKg registries, workflows, identity, evidence, field capture or databases without a proved requirement and migration plan;
- describe an integration as DPGA-certified, government-approved or regulator-accepted;
- use an external DPG as a replacement for RupayKg statutory applicability, tenant/geography controls, verification, MRV, or evidence truth model.

## 2. Registry discovery and data access

The DPGA website states that registry-listed products have been reviewed against the DPG Standard. Recognition is time-limited and subject to reassessment. The live registry displayed 256 listed DPGs at the time of this review; counts and filters are dynamic.

The DPGA's public API project documents these endpoints:

| Endpoint | Purpose | RupayKg use |
|---|---|---|
| GET https://api.digitalpublicgoods.net/dpgs/ | List recognised DPGs | Discover possible integration components |
| GET https://api.digitalpublicgoods.net/dpg/{id}/ | Fetch an individual DPG profile | Display details, website, licence, SDGs, owner and stage |
| GET https://api.digitalpublicgoods.net/nominees/ | List nominees separately from recognised DPGs | Research only; never display as recognised DPGs |

API implementation notes:
- The API is a static JSON interface generated from the DPGA public-goods repository and hosted via GitHub Pages.
- Endpoints may redirect to a trailing-slash URL; use the documented slash to avoid redirect assumptions.
- The Registry API is a discovery/catalogue source, not a production transaction dependency.
- Cache a timestamped snapshot, retain the source URL and last-checked date, and refresh periodically. If the API is unavailable, the catalogue should continue to function from the last valid snapshot.
- Separate DPG from nominee status. Do not show nominees as recognised DPGs.
- Show source attribution, licence and last-evaluated/expiry information where available. Re-check the live DPGA profile before deployment or procurement.
- Follow the DPGA Brand Guide before using its logo or visual identity. A catalogue entry must not imply DPGA partnership or endorsement of RupayKg.

## 3. Current RupayKg capabilities that must not be duplicated casually

The canonical repository already documents:
- an authoritative organisation/geography/activity/resource-flow operating model;
- offline field capture and server-authoritative synchronisation;
- activity, measurement, evidence and verification lifecycle;
- registry and credential lifecycle controls;
- carbon mechanism/methodology gates and separation of internal calculation from official issuance;
- API, audit, security and production-control boundaries.

Relevant current repository references:
- docs/PRODUCTION_TARGET.md
- docs/MRV.md
- docs/REGISTRY.md
- docs/PRODUCTION_READINESS_MATRIX.md
- docs/PLATFORM-CORE-OBJECTIVES-AND-REGULATORY-ALIGNMENT-2026.md

A DPG should fill a genuine gap or connect an external participant. It should not become a second source of truth for the same authoritative RupayKg business records.

## 4. Ranked component shortlist

Ratings are internal fit assessments, not DPGA ratings or partner commitments.

| Priority | DPG | Registry licence / DPGA status evidence | Potential RupayKg use | Decision |
|---|---|---|---|---|
| P1 | OpenFn | Registry profile reports LGPL-3.0; DPGA DPI collection, Data Exchange; September 2026 collection assessment 14/18 | Orchestrate external APIs, ETL, webhooks and partner-system synchronisation | Evaluate a bounded integration pilot; resolve licence metadata discrepancy first |
| P1 | ODK | Apache-2.0; recognised DPG | Ingest field survey data from contractors/partners into existing RupayKg validation workflows | Build an optional import/connector; do not replace RupayKg offline field app |
| P2 | Sunbird RC | MIT; DPGA DPI collection, Registries; September 2026 collection assessment 15/18 | Optional external entity/facility/asset registry or W3C credential interoperability | Technical proof-of-fit only; avoid duplicating existing authoritative registries |
| P2 | CREDEBL | Apache-2.0; DPGA DPI collection, Trust Infrastructure; September 2026 collection assessment 15/18 | Wallet/DID/credential issuance and external credential verification | Compare with Sunbird RC; choose at most one for a defined trust-rail gap |
| P2 | CKAN | AGPL-3.0; recognised DPG | Publish customer-approved, aggregate non-PII environmental datasets and open data catalogues | Potential paid managed open-data portal, deployed separately after AGPL review |
| P3 | X-Road | MIT; DPGA DPI collection, Data Exchange; September 2026 collection assessment 18/18 | Federated, secure inter-organisation exchange for government/PSU networks | Strategic only; evaluate when a government integration partner or programme requires it |
| P3 | GeoPrism Registry | LGPL-3.0; recognised DPG and Climate Action collection | Geographic master-data and spatial hierarchy exchange | Do not replace LGD/geography model; consider only for a demonstrated authoritative geospatial gap |
| P3 | Global Open Facility Registry (GOFR) | Apache-2.0; recognised DPG; facility registry profile is health-sector oriented | Reconcile facility lists and duplicate site records | Relevance uncertain outside health; inspect schema and extension cost before any pilot |
| P3 | DHIS2 | BSD-3-Clause; DPGA DPI collection, Data Exchange; September 2026 collection assessment 17/18 | Large-scale aggregate reporting and indicator exchange where a public agency already uses DHIS2 | Prefer an API connector to the deployed instance; do not deploy a parallel MIS without a buyer |
| P3 | Open Foris Collect | MIT; recognised DPG; Agriculture/Climate sectors | Forest, bamboo and biomass inventory data ingestion; particularly relevant to Aranya | Consider as an Aranya/forest-inventory connector, not RupayKg's core MRV system |
| P3 | DiCRA | MIT; recognised DPG; agriculture/climate geospatial data | Contextual geospatial/climate-resilience datasets for rural biomass project planning | Data enrichment only; not an MRV measurement source or legal evidence |
| P3 | farmOS | GPL-2.0; recognised DPG | Farm/producer operational data connector for biomass and agricultural residues | Consider only where an actual FPO/producer customer uses farmOS; separate service boundary |
| P3 | KoboToolbox | Registry profile reports Apache-1.1 and AGPL-3.0; recognised DPG | Third-party field data import where partners already use Kobo | ODK is the cleaner first candidate; resolve exact component/licence scope before use |
| P3 | OpenLitterMap | GPL-3.0; recognised DPG | Public litter observations and civic intelligence | Supplementary leads/map only; never authoritative quantity, compliance or carbon evidence |

### 4.1 Highest-priority evaluation: OpenFn

DPGA describes OpenFn as a data-exchange building block for workflow automation, ETL, API orchestration and webhooks. Its DPGA DPI collection page reports 14 of 18 checks met (September 2026).

Potential integration pattern:

Partner System → OpenFn Workflow → RupayKg Ingestion API → Validation/Quarantine → Authoritative RupayKg Workflow

Controls:
- OpenFn must call supported RupayKg APIs; it must not write directly to the production database.
- Incoming records remain untrusted until schema, source, organisation, geography, idempotency, timestamp and evidence checks pass.
- Failed or ambiguous records go to an exception queue; no automatic promotion to verified/value-eligible.
- Credentials are scoped to a dedicated integration identity and least-privilege API permissions.
- Workflow retries must be idempotent and observable.
- Contractual data-processing, retention and hosting boundaries must be approved.

**Licensing discrepancy:** the DPGA profile page reports LGPL-3.0 for OpenFn, while the DPGA API registry record available during this review reports GPL-3.0 for the OpenFn Integration Toolkit. Resolve the exact repository/component and current licence directly against the upstream source and owner before deployment, modification, distribution or managed hosting.

### 4.2 Field collection: ODK before adding another field application

ODK's DPGA profile reports Apache-2.0 and export/import in CSV, API, JSON and XML. Its value is strongest where a municipality, contractor, auditor or field partner already collects data using ODK.

Recommended approach:
- create a read-only connector or controlled import;
- map ODK form IDs and question versions to RupayKg measurement schemas;
- retain original submission IDs, capture timestamps, source identity and attachments/evidence hashes;
- quarantine missing, duplicate or out-of-scope records;
- retain RupayKg's own authoritative device, organisation/geography and verification controls.

Do not replace RupayKg's current offline workflow until a comparative field test proves lower total cost and equal or stronger controls.

### 4.3 Registry and credential layer: Sunbird RC versus CREDEBL

**Sunbird RC** is a configurable registry framework with schema-driven APIs, attestation workflows, consent management and W3C verifiable credentials. DPGA's September 2026 DPI assessment reports 15 of 18 checks met.

**CREDEBL** provides ledger-agnostic verifiable credential issuance, DIDs, wallets and verification. Its registry profile reports Apache-2.0; its September 2026 DPI assessment reports 15 of 18 checks met.

They are not interchangeable:
- Sunbird RC is the stronger candidate when an independent, schema-driven registry is the primary requirement.
- CREDEBL is the stronger candidate when wallet/DID/credential lifecycle interoperability is the primary requirement.

RupayKg already has registry/credential and verification boundaries. Therefore, neither should replace the core platform by default. First identify an external participant workflow that cannot be supported adequately by the existing implementation. If a pilot is justified, choose one candidate and use a separate bounded service with explicit trust and failure semantics.

### 4.4 Public environmental data: CKAN and open datasets

CKAN can support a customer-facing catalogue of datasets that the customer has approved for public release. Potential paid service:
- managed CKAN instance;
- dataset curation, metadata and publication workflow;
- scheduled updates and API delivery;
- access controls for pre-publication/private datasets;
- uptime, backup, support and integration SLA.

CKAN is AGPL-3.0. Keep it in a distinct deployment and obtain legal review of network-use, modification, distribution and source-availability obligations before commercial operation.

DiCRA, climate datasets and OpenLitterMap may provide supplementary context or public observations. Their data must be validated for provenance, licence, geographic fit, freshness, completeness and fitness for purpose. None should be substituted for calibrated measurements, verified field evidence, approved methodology inputs or authoritative regulatory records.

## 5. Business model: sell integration and outcomes, not the DPG itself

The commercial opportunity is to make complex DPGs useful, supported and connected for RupayKg customers.

| Offer | Paying customer | Chargeable value |
|---|---|---|
| DPG integration assessment | ULB, PSU, enterprise, system integrator | Fixed-scope architecture, security, licensing and fit assessment |
| Connector implementation | Enterprise, ULB, data provider, integrator | One-time integration/setup plus annual maintenance |
| Managed integration operations | Enterprise, state/ULB, ecosystem partner | Monthly/annual workflow monitoring, exceptions, retries and SLA |
| Registry/credential deployment | Government programme, consortium, enterprise | Configuration, deployment, onboarding, support and integration |
| Managed environmental data portal | ULB, PSU, programme owner | Hosting, dataset curation, API, publication workflow, backup and SLA |
| Field-data integration package | Waste contractors, verifiers, ULBs, project developers | Form design/mapping, device onboarding, data validation and reporting |
| Data exchange/API service | Public agency, platform partner, enterprise | API integration, access governance, throughput tier and support |
| Training and implementation | All customer segments | Training, migration, configuration and operational handover |

Do not charge for favourable verification decisions, statutory approvals, certificates or regulator acceptance. Charge for real software, implementation, operations, support and integration deliverables.

## 6. Proposed RupayKg integration catalogue

A curated catalogue can be added later as a commercial discovery feature.

Proposed fields:
- product name and DPGA registry ID;
- recognised DPG versus nominee state;
- owner/steward;
- licence and source URL;
- DPGA last-evaluated and expiry dates where published;
- capability/domain tags;
- RupayKg use-case mapping;
- integration status: RESEARCHED, LAB_TESTED, PILOTED, SUPPORTED, DEPRECATED;
- evidence link, version tested and last review date;
- internal support owner and commercial service offer.

The DPGA Registry API can supply discovery metadata, but RupayKg should cache a timestamped snapshot and link back to DPGA. The catalogue's internal integration status is RupayKg's own assessment, not the DPGA's endorsement.

## 7. Integration sequencing

### Batch 1 — Low-risk discovery

1. Validate the DPGA API snapshot and selected profile details.
2. Confirm OpenFn licence/component scope and run a disposable, non-production connector spike.
3. Define an ODK-to-RupayKg mapping contract and prove import into a test/quarantine path using non-personal synthetic data.
4. Conduct capability and cost comparisons against existing RupayKg field and integration services.

### Batch 2 — One paid use-case pilot

Choose the first connector only when a named prospective customer, data source, budget owner, value case and acceptance criteria exist. Prefer the integration that solves a real procurement or operations problem, not the one with the largest feature list.

### Batch 3 — Trust/registry proof-of-fit

Only if a real partner needs interoperable external credentials, compare Sunbird RC and CREDEBL against the existing RupayKg registry/credential model. Do not run both in production without a separate architecture decision.

### Batch 4 — Managed data services

Test a CKAN-based, separate public-data portal only when a ULB/PSU/programme sponsor wants a managed dataset publication service and the licensing/hosting boundary is approved.

### Batch 5 — Government-scale interoperability

Evaluate X-Road only when a government programme, institutional operator and integration counterpart establish a concrete federation requirement, operating governance and funding.

## 8. Mandatory technical, legal and operational controls

Before adopting any DPG:
1. Confirm exact upstream repository/component, release and licence.
2. Generate SBOM and transitive dependency/licence inventory for the version to be used.
3. Review source code activity, maintainer governance, security advisories, vulnerability response and support options.
4. Document deployment footprint, database, queue, identity, key management, backup/restore, monitoring and patch process.
5. Establish data controller/processor roles, purpose, geography, retention, deletion, residency and contractual obligations.
6. Use least-privilege service identities and tenant/geography-scoped RupayKg APIs.
7. Prohibit direct DPG writes into the authoritative RupayKg database.
8. Keep external data unverified until the existing evidence and verification lifecycle accepts it.
9. Define fallback, export, vendor exit and data portability.
10. Record the tested version, integration owner, cost-to-serve, customer value and rollback path.

## 9. Final recommendation

| Decision | Status |
|---|---|
| Explore DPGA Registry as a sourcing catalogue | ADOPT |
| Use DPGA API for cached discovery metadata | APPROVE FOR DESIGN |
| OpenFn integration spike | PRIORITY 1 — licence clarification first |
| ODK controlled import connector | PRIORITY 1 — do not replace existing field app |
| Sunbird RC production deployment | HOLD — duplication risk |
| CREDEBL production deployment | HOLD — credential use case not yet proven |
| CKAN managed data portal | COMMERCIAL OPTION — separate deployment and AGPL review |
| X-Road national federation | STRATEGIC / LATER |
| Adopt every DPG listed in Registry | REJECT |

**Business rule:** RupayKg sells the trusted operational platform and the work required to integrate, configure, manage and support the wider ecosystem. It does not need to own every DPG building block, and it must not give away its proprietary commercial core to obtain recognition.

---

## Primary references

- DPGA Registry: https://www.digitalpublicgoods.net/registry
- DPGA Registry API source and endpoint documentation: https://github.com/DPGAlliance/dpg-api
- DPGA DPGs for DPI collection: https://www.digitalpublicgoods.net/dpgs-for-dpi
- Sunbird RC profile: https://www.digitalpublicgoods.net/r/sunbird-rc
- OpenFn profile: https://www.digitalpublicgoods.net/r/openfn
- X-Road profile: https://www.digitalpublicgoods.net/r/x-road
- CREDEBL profile: https://www.digitalpublicgoods.net/r/credebl
- ODK profile: https://www.digitalpublicgoods.net/r/odk
- CKAN profile: https://www.digitalpublicgoods.net/r/ckan
- GeoPrism Registry profile: https://www.digitalpublicgoods.net/r/geoprism-registry
- Global Open Facility Registry profile: https://www.digitalpublicgoods.net/r/global-open-facility-registry
- DiCRA profile: https://www.digitalpublicgoods.net/r/dicra
- DHIS2 profile: https://www.digitalpublicgoods.net/r/dhis2
- farmOS profile: https://www.digitalpublicgoods.net/r/farmos

**Status:** Internal sourcing and commercial integration assessment. Not a supplier agreement, security approval, production integration decision, DPGA partnership or regulator endorsement.
