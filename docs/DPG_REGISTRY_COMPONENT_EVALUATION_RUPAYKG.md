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

The DPGA website states that registry-listed products have been reviewed against the DPG Standard. Recognition is time-limited and subject to reassessment. On 2026-11-07, the official DPGA API repository snapshot contained **165 DPG records** in `docs/dpgs/index.json` (blob SHA `dae0a0a8706c5d45f4acb8bc23738c4cdd3b920d`) and **63 nominee records** in `docs/nominees/index.json` (blob SHA `f848cdafd11c28299f69ab91886a56826022a5b1`). Counts are dynamic; these are timestamped source snapshots, not a permanent registry total. A broad keyword screen produced 54 possible environment, climate, agriculture, geospatial, registry, field-data or data-exchange matches; this is only a discovery filter, not 54 approved candidates.

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

## 4. Ranked component shortlist — reconciled to the 2026-11-07 API snapshot

Ratings are internal fit assessments, not DPGA ratings or partner commitments. "DPG" below means the candidate appears in the retrieved official `/dpgs/` snapshot. A registry-level licence is metadata for the submitted/assessed component and is not blanket permission for every related repository, add-on, dataset or hosting arrangement.

| Priority | DPG / component | Official DPGA API metadata on 2026-11-07 | Potential RupayKg use | Decision |
|---|---|---|---|---|
| P1 | ODK | DPG; Apache-2.0; API record points to `getodk/central`; DPGA profile last evaluated 09.01.2025 | Controlled import of offline forms and partner/contractor field data | First field-data connector candidate; preserve RupayKg's own authoritative field/evidence workflows |
| P1 | FarmStack | DPG; Apache-2.0; API record points to `digitalgreenorg/farmstack-open`; profile's assessed repositories list backend and frontend repositories; profile last evaluated 07.02.2025 | Secure data exchange with agriculture/biomass ecosystem participants | Evaluate only for a named partner data-sharing use case; inspect component/repository scope and dependencies (profile notes SendGrid dependency replaceable with SMTP) |
| P1 | Sunbird Obsrv | DPG; MIT in API snapshot; profile/source component detail not independently fetched in this review | Telemetry/event pipeline for devices, measurements and operations | High-value discovery candidate for weighbridge/IoT observability; validate each microservice, security, event semantics and operating footprint before prototype |
| P1 | OpenFn Integration Toolkit / OpenFn Lightning | DPG API record: GPL-3.0 for `OpenFn/core`; separate DPGA profile for OpenFn Lightning: LGPL-3.0 and lists `OpenFn/lightning`; profile last evaluated 09.01.2025 | API/webhook orchestration, ETL and partner-system synchronisation | Priority integration assessment, but treat as two distinct named component scopes until OpenFn/DPGA confirms the exact supported product and licence for the intended deployment |
| P2 | Sunbird RC | DPG; MIT; registry/credential capability; DPGA profile last evaluated 26.08.2025; DPI collection is shown on profile | Optional external entity/facility/asset registry or credential interoperability | Technical proof-of-fit only; do not duplicate RupayKg's authoritative registries |
| P2 | GeoPrism Registry | DPG; LGPL-3.0; master lists, hierarchy and geospatial data; DPGA profile last evaluated 09.01.2025; Climate Action collection is shown on profile | Geographic/facility reference-data federation | Assess only against a proven national geography/facility master-data gap; review LGPL and data ownership |
| P2 | X-Road | DPG; MIT; DPGA profile last evaluated 28.07.2026; DPI collection is shown on profile | Secure inter-organisational data exchange for government ecosystems | Keep conditional until a named government programme, institutional operator and counterpart require federation |
| P2 | Open Foris Collect | DPG; MIT; Agriculture and Climate sectors in API; submitted repository `openforis/collect` | Forestry, bamboo, biomass and land-inventory field capture | Potential Aranya/forest-inventory connector; not a replacement for RupayKg MRV |
| P2 | DiCRA | DPG; MIT; Agriculture sector in API; DPGA profile last evaluated 26.07.2024 | Geospatial/climate-resilience context for agriculture and biomass planning | Data/context enrichment only; not calibrated measurement, compliance proof or MRV evidence |
| P2 | OpenLitterMap | DPG; GPL-3.0 | Citizen litter observations and supplementary pollution mapping | Research/lead generation only; not authoritative waste quantity, regulatory or carbon evidence |
| P2 | Cloud Carbon Footprint | DPG; Apache-2.0 | Measure cloud-computing emissions and cost in DIGICORE/RupayKg operations | Internal sustainability/FinOps candidate, not a waste/landfill MRV engine |
| P3 | Global Open Facility Registry (GOFR) | DPG; Apache-2.0; registry record is health-sector oriented | Facility-list reconciliation pattern | Study its federated matching approach; do not deploy as an environmental facility registry without domain proof |
| P3 | Climate Information Platform | DPG; CC-BY-SA-4.0; type is data/content; API has no source-code repository URL | Climate/weather/water context data | Treat as licensed data/content, not reusable software; assess attribution/share-alike, geography and fitness |
| P3 | Productive Forests | DPG; three MIT entries in API for separate repositories | Forest inventory and satellite-imagery processing | Possible forest/bamboo planning use; verify each repository and model/data rights separately |
| P3 | Scottish Environment Protection Agency Hydrometric Data | DPG; OGL-UK-3.0; data product/API | Example of hydrometric time-series API design | Reference pattern only unless UK data has a valid use case; not India field evidence |
| P3 | DHIS2 | DPG; BSD-3-Clause; API record describes health information management | Aggregate indicator exchange where a public partner already uses DHIS2 | Connector only when a buyer/agency uses DHIS2; not a parallel environmental MIS |

### 4.1 OpenFn — exact component boundary must be resolved

The currently retrieved DPGA profile is titled **OpenFn DPG Profile** and describes OpenFn Lightning. It reports LGPL-3.0, a last-evaluated date of 09.01.2025, and lists `github.com/OpenFn/lightning` as the core repository assessed/included.

The 2026-11-07 DPGA API record is titled **OpenFn Integration Toolkit** and reports GPL-3.0, pointing to `github.com/OpenFn/core`.

These records identify different repository/component scopes. The discrepancy must not be flattened into a single licence assertion. Before any prototype, distribution or hosted deployment:
- identify the exact OpenFn runtime/product offered and the repositories required;
- obtain the maintainer's written clarification of supported components and licences;
- inspect each repository's current licence file, release tag and dependency licences;
- decide whether the planned activity is use, modification, distribution or managed hosting and obtain legal review.

Potential integration pattern:

Partner System → OpenFn Workflow → RupayKg Ingestion API → Validation/Quarantine → Authoritative RupayKg Workflow

Controls:
- OpenFn must call supported RupayKg APIs; it must not write directly to the production database.
- Incoming records remain untrusted until schema, source, organisation, geography, idempotency, timestamp and evidence checks pass.
- Failed or ambiguous records go to an exception queue; no automatic promotion to verified/value-eligible.
- Credentials are scoped to a dedicated integration identity and least-privilege API permissions.
- Workflow retries must be idempotent and observable.
- Contractual data-processing, retention and hosting boundaries must be approved.

### 4.2 ODK — first field-data connector candidate

The DPGA API record identifies ODK as a DPG under Apache-2.0 and points to `getodk/central`. Its DPGA profile reports Apache-2.0, identifies Get ODK Inc as owner and last evaluated 09.01.2025. The profile describes field data collection and lists CSV, API, JSON and XML as extraction/import mechanisms.

Recommended approach:
- create a read-only connector or controlled import;
- map ODK form IDs and question versions to RupayKg measurement schemas;
- retain original submission IDs, capture timestamps, source identity and attachments/evidence hashes;
- quarantine missing, duplicate or out-of-scope records;
- retain RupayKg's own authoritative device, organisation/geography and verification controls.

The profile reports that PII may be collected and stored, though not distributed. Therefore, any ODK deployment/integration requires explicit field-level data classification, purpose, consent/lawful basis where applicable, access, retention and deletion controls. Do not assume an ODK instance is non-PII by default.

Do not replace RupayKg's current offline workflow until a comparative field test proves lower total cost and equal or stronger controls.

### 4.3 FarmStack — ecosystem data exchange candidate

The DPGA API record identifies FarmStack as a DPG under Apache-2.0. Its current DPGA profile identifies Digital Green as owner, last evaluated 07.02.2025, and describes secure data transfer across the agricultural ecosystem. The profile lists backend and frontend repositories among the components assessed and states that a SendGrid dependency can be replaced by an SMTP service.

Potential use is limited to a named agricultural residue, biomass, producer or FPO partner data-sharing requirement. Before a prototype, reconcile the profile's assessed repositories with the API record's `farmstack-open` repository, inspect the exact release and data-sharing model, and assess tenant separation, participant onboarding, PII, transfer permissions, operational cost and maintenance.

FarmStack is not approved as a general RupayKg data exchange backbone based on its DPG status alone.

### 4.4 Sunbird Obsrv — device telemetry discovery

The API snapshot identifies Sunbird Obsrv as a DPG under MIT and lists multiple telemetry, data-pipeline, analytics, reporting and core data-product repositories. Its description covers granular event capture, including events from users and devices/IoT systems, telemetry validation, aggregation and APIs.

This makes it a promising discovery candidate for weighbridge/device events and operational observability. It is not yet an approved IoT ingestion choice. Validate exact repository boundaries, release health, schemas, queue/stream requirements, data retention, security, resource footprint, failure handling and whether it overlaps with existing RupayKg event/measurement pipelines. Start only with synthetic telemetry in an isolated environment.

### 4.5 Registry options — Sunbird RC versus GeoPrism

**Sunbird RC** is a configurable registry and credential framework. The DPGA profile lists MIT, the EkStep Foundation as owner, a last evaluation of 26.08.2025 and two included repositories (`sunbird-rc-core` and `sunbird-rc-ui`). Use only if a specific external ecosystem registry/credential workflow cannot be supported appropriately by the current RupayKg platform.

**GeoPrism Registry** manages master lists, hierarchies and geospatial data. Its DPGA profile lists LGPL-3.0, last evaluated 09.01.2025, and the `terraframe/geoprism-registry` repository. It may be relevant to geography/facility reference-data federation but can overlap with existing RupayKg geography and facility identifiers.

These are distinct product classes, not interchangeable choices. Neither is approved for production; establish the exact data authority and system of record before prototyping.

### 4.6 X-Road — government federation only

The DPGA profile identifies X-Road as MIT-licensed software for secure inter-organisational exchange, lists NIIS as owner and last evaluated 28.07.2026, and shows inclusion in the DPG for DPI collection.

X-Road is a strategic candidate only where a named government programme establishes the participating institutions, operator, trust model, legal authority, funding, service levels and operational governance. RupayKg must not independently present itself as an X-Road public-sector security server or claim government federation authority.

### 4.7 Environmental data/software records — distinct commercial treatment

- **DiCRA:** geospatial climate-resilient agriculture platform and data; useful context for rural biomass planning. Its DPGA profile reports MIT and UNDP ownership. Validate dataset-specific terms, geographic coverage, update cadence, lineage and suitability. It is not a calibrated MRV measurement source.
- **Open Foris Collect:** MIT field-based inventory software for forestry/agriculture/climate; a possible forest/bamboo survey adapter. Verify source and instrument/method compatibility.
- **OpenLitterMap:** GPL-3.0 litter/plastic-pollution observations; useful for supplementary observations only. Crowdsourced observations are not automatically verified quantity or compliance data.
- **Cloud Carbon Footprint:** Apache-2.0 tool for cloud-computing emissions and cost; could inform DIGICORE/RupayKg's own cloud footprint, not replace waste/landfill methodology.
- **Climate Information Platform:** API identifies a CC-BY-SA-4.0 data/content product with no source repository URL. Treat as data/content with attribution/share-alike and geographic suitability checks, not as software.
- **Productive Forests:** API reports MIT across three distinct repositories. Review each repository, any model weights and imagery/data terms independently.

Non-commercial content such as WaPOR and the Hand-in-Hand Geospatial Platform is listed with CC-BY-NC-SA-3.0 in the API snapshot. Do not include such material in a commercial product or paid data service without specific permission or a separate legal basis. A DPG listing does not remove non-commercial restrictions.

### 4.8 Items not found in the 2026-11-07 DPG API snapshot

**CKAN and CREDEBL were not found in the retrieved `/dpgs/` list** under those names/IDs. They must not be described in this register as currently recognised DPGs based on this snapshot. They may be assessed separately as open-source technologies or as items in another DPGA collection only after their exact current status, component scope and sources are verified.

The same verification rule applies to any candidate found through a collection page or secondary source but absent from the DPG API snapshot.

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
