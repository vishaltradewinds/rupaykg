# Dual DPI Ecosystem Execution Roadmap — DIGICORE INFRASYS / RupayKg

**Effective:** 2026-11-07  
**Authority:** Execution backlog supporting the dual-DPI ecosystem strategy  
**Priority:** National RupayKg deployment and commercial sustainability first; Jabalpur is the first deployment/validation site of the same national architecture.  
**Status:** Planned execution baseline. A backlog item is not evidence of completion, customer demand, government acceptance or production readiness.

## 1. Execution objective

Convert the DPGA Registry and Global DPI Repository research streams into product and revenue outcomes for RupayKg, with DIGICORE INFRASYS as the intended engineering, implementation and managed-services company.

The work must answer four separate questions:

1. **What can be reused?** Use DPGA to identify software and digital technology; verify exact versions, licences, security and cost.
2. **What can be learned?** Use GDPIR to study at-scale DPI architecture, governance, maturity, institutional arrangements, rollout and sustainability.
3. **What should RupayKg build or integrate?** Translate relevant evidence into national architecture decisions and customer-valued environmental capabilities.
4. **What can DIGICORE INFRASYS sell?** Define priced implementation, integration, software and managed-service offers supported by real buyer, contract, cost and acceptance evidence.

## 2. Source-grounded research baseline and limitations

### DPGA Registry

The official DPGA API documentation describes a public catalogue API, including:
- `GET /dpgs/` to list digital public goods;
- `GET /dpg/{id}/` to retrieve an individual listing;
- `GET /nominees/` and `GET /nominee/{id}/` for nominees;
- static JSON files generated from the publicgoods-candidates source repository and hosted via GitHub Pages;
- trailing slashes on individual endpoints because of the static hosting structure.

Source: https://github.com/DPGAlliance/dpg-api

The API is appropriate for a curated, cached research/catalogue feed. It must not be a synchronous runtime dependency of the production environmental platform. The registry record is not a substitute for verifying the actual upstream release, source code, licence, notices, dependencies, security, maintenance and support terms.

**Snapshot actually retrieved on 2026-11-07:** `DPGAlliance/dpg-api/docs/dpgs/index.json` contained 165 DPG records (blob SHA `dae0a0a8706c5d45f4acb8bc23738c4cdd3b920d`). `docs/nominees/index.json` contained 63 nominee records (blob SHA `f848cdafd11c28299f69ab91886a56826022a5b1`). These are timestamped snapshots, not permanent counts. A broad keyword search produced 54 potential environmental/climate/agriculture/geospatial/registry/data-exchange/field-data matches; each needs manual relevance assessment.

The snapshot confirms entries such as ODK (Apache-2.0), FarmStack (Apache-2.0), Sunbird Obsrv (MIT), Sunbird RC (MIT), GeoPrism Registry (LGPL-3.0), X-Road (MIT), DiCRA (MIT), Open Foris Collect (MIT), OpenLitterMap (GPL-3.0), and Cloud Carbon Footprint (Apache-2.0). It also exposes component-boundary questions: the OpenFn API record identifies `OpenFn/core` under GPL-3.0, whereas the separate DPGA OpenFn profile identifies OpenFn Lightning/`OpenFn/lightning` under LGPL-3.0. Do not treat these as the same component or collapse their licences.


### Global DPI Repository (GDPIR)

The Government of India's 23 November 2023 announcement describes GDPIR as a MeitY-developed resource hub pooling lessons and expertise from G20 members and guest nations. It says the standardised information includes DPIs developed at scale, maturity scales, source code where available and governance frameworks; the launch announcement reported 54 DPIs from 16 countries.

Source: https://www.pib.gov.in/PressReleasePage.aspx?PRID=1979113

**Access limitation observed on 2026-11-07:** the requested page `https://www.dpi.global/globaldpi/dpicatedata` returned HTTP 403 in the research environment. The exact page records, current catalogue count, field schema, download options, API availability, source-code links and reuse/licensing terms therefore remain **NOT VERIFIED**. The 2023 launch announcement must not be represented as a current inventory count.

First GDPIR task: obtain the actual page contents or an official export through an accessible channel, preserve source/date/provenance, then inspect each record. Do not fabricate dataset fields or infer that every entry contains open code or APIs.

### Important distinction

The two sources are complementary, not interchangeable:
- DPGA: discover reusable technology.
- GDPIR: learn from infrastructure implementations and governance.
- RupayKg: productise validated capabilities.
- DIGICORE INFRASYS: engineer, lawfully own/control, implement and commercialise the resulting products and services.

## 3. Priority workstreams

| Priority | Workstream | Execution objective | Required output | Exit condition |
|---|---|---|---|---|
| P0 | WS-01 Source acquisition and evidence register | Establish a reproducible DPGA/GDPIR research corpus with provenance | Timestamped source register, official URLs, snapshots/exports where permitted, schema notes and evidence gaps | Every analysed record has exact source, retrieval date and evidence status |
| P0 | WS-02 National capability and gap map | Compare current RupayKg architecture against target national environmental operations | Capability map, current-repo evidence, gap register, target architecture decision records | Every proposed integration maps to a proven gap and national reusable capability |
| P0 | WS-03 Commercial buyer/use-case validation | Identify paid government, ULB, PSU and enterprise problems | Buyer/use-case cards, budget owner, procurement route, measurable outcome, cost-to-serve and pricing hypothesis | At least one named customer/use case is validated before an integration becomes a product commitment |
| P1 | WS-04 DPGA component due diligence | Rank and technically evaluate reusable candidates | Candidate scorecards, exact upstream version and licence findings, SBOM, security/support/cost decision | Reject/watch/prototype/adopt decision is signed for every candidate |
| P1 | WS-05 GDPIR implementation pattern research | Extract governance, maturity and deployment patterns from actual GDPIR entries | Reference implementation cards, comparative pattern matrix and India adaptation risks | Each adopted pattern has original source evidence and a RupayKg architecture decision |
| P1 | WS-06 National interoperability architecture | Turn validated patterns into deployable contracts and adapters | Versioned API/data contracts, integration reference architecture, trust/data governance controls | Cross-organisation and cross-jurisdiction conformance tests pass |
| P1 | WS-07 DIGICORE commercial operating model | Establish repeatable product and service delivery | Service catalogue, delivery playbooks, IP/right register, costing, support/SLA model | Legal rights and delivery economics are evidenced for each offer |
| P1 | WS-08 Jabalpur field validation | Validate the national product at SITE-JBP-01 without a local code fork | Field test evidence, operator acceptance, equipment and data-source records, incident/reconciliation outcomes | Tested site scope is accepted; limitations and residual risks are recorded |
| P2 | WS-09 Government ecosystem readiness | Prepare controlled deployment into authorised government-led programmes | Government integration pack, security/data-sharing/contract checklist, deployment and exit plan | Sponsor, authority, contract, security acceptance and data-sharing permissions exist |
| P2 | WS-10 Repeatable national rollout | Prove deployment across additional jurisdictions and customer organisations | Multi-jurisdiction deployment playbook, capacity/resilience evidence, support and unit-cost data | Multiple independent deployments meet defined readiness and acceptance criteria |

**Execution rule:** P0 items must produce the decision-quality evidence needed to stop wasteful integrations. P1 technical discovery and governance research can run in parallel once source acquisition starts. P2 deployment is not authorised merely because documents are complete.

## 4. DPGA component portfolio — current snapshot and initial queue

The following are candidate assessments, not integration approvals. The DPGA API records them as DPGs in the retrieved snapshot unless explicitly stated otherwise. Their registry licence metadata does not replace exact source/release and dependency review.

| Candidate | Snapshot evidence | Potential RupayKg use | Priority / decision |
|---|---|---|---|
| ODK | DPG; Apache-2.0; `getodk/central`; DPGA profile last evaluated 09.01.2025 | Offline forms and partner/contractor field data import | P1 connector discovery; retain RupayKg's own authoritative field/evidence workflow; PII controls required |
| FarmStack | DPG; Apache-2.0; API points to `farmstack-open`; DPGA profile lists backend/frontend repositories and last evaluated 07.02.2025 | Secure agricultural ecosystem data transfer | P1 data-sharing use-case review; profile notes SendGrid can be replaced by SMTP; reconcile assessed repository scope |
| Sunbird Obsrv | DPG; MIT in API record; multiple telemetry/pipeline/analytics/reporting repos | Device/IoT event capture, validation and telemetry aggregation | P1 technical discovery for weighbridge/sensor observability; synthetic isolated spike only after source and operations review |
| OpenFn Integration Toolkit / OpenFn Lightning | API record identifies `OpenFn/core` GPL-3.0; separate profile identifies OpenFn Lightning/`OpenFn/lightning` LGPL-3.0; profile last evaluated 09.01.2025 | ETL, webhooks and API orchestration | P1 due diligence; get maintainer clarification on exact product, components and licence before selecting runtime |
| Sunbird RC | DPG; MIT; registry/credential framework; profile last evaluated 26.08.2025 | External participant/facility/asset registry or credentials | P2; only if existing RupayKg registry lacks a specific ecosystem interoperability function |
| GeoPrism Registry | DPG; LGPL-3.0; geographic master lists/hierarchies; profile last evaluated 09.01.2025 | Federated jurisdiction/facility reference data | P2; only after a clear national geography/facility authority gap is proven |
| X-Road | DPG; MIT; profile last evaluated 28.07.2026; shown in DPI collection | Secure government-to-government exchange | P2 conditional; requires named government programme, institutional operator and counterparts |
| Open Foris Collect | DPG; MIT; Agriculture/Climate metadata | Forest, bamboo, biomass and land-inventory surveys | P2 for a defined forestry/Aranya or biomass use case; not core MRV |
| DiCRA | DPG; MIT; India/UNDP; geospatial climate-resilient agriculture | Contextual geospatial data for agriculture/biomass planning | P2 data enrichment; not measurement, verification or regulatory evidence |
| OpenLitterMap | DPG; GPL-3.0 | Litter and plastic pollution observations | P2 research/lead map only; not authoritative quantity or carbon data |
| Cloud Carbon Footprint | DPG; Apache-2.0 | Cloud infrastructure carbon and cost monitoring | P2 internal cloud footprint/FinOps, not waste or landfill MRV |
| Global Open Facility Registry | DPG; Apache-2.0; health-oriented facility reconciliation | Reusable facility matching and duplicate-resolution pattern | P3 learn the pattern first; domain adaptation required |
| Climate Information Platform | DPG; CC-BY-SA-4.0; data/content type, no source repo URL in API record | Climate/weather/water context information | P3 data/content use only after terms, geographic relevance and attribution/share-alike analysis |
| Productive Forests | DPG; three MIT records for separate repositories | Forest inventory and satellite imagery processing | P3; assess each repository/model/data right separately |
| Scottish Environment Protection Agency Hydrometric Data | DPG; OGL-UK-3.0; hydrometric API/data | Example of water-monitoring time-series APIs | P3 reference pattern; UK data itself is not India site evidence |
| DHIS2 | DPG; BSD-3-Clause; health MIS | Indicator exchange if customer public agency already uses DHIS2 | P3 connector only where a customer/agency requires it |
| CKAN | Not found as a DPG in the retrieved `/dpgs/` snapshot | Separate data portal technology option | Separate open-source review only; AGPL-3.0 legal review; do not label DPGA-recognised based on this snapshot |
| CREDEBL | Not found as a DPG in the retrieved `/dpgs/` snapshot | Separate credential technology option to research if required | Separate status/licence/collection verification; do not label DPGA-recognised based on this snapshot |
| WaPOR / Hand-in-Hand Geospatial Platform | DPG entries; CC-BY-NC-SA-3.0 in API | Agriculture/water/geospatial content | Do not use for paid/commercial product/service without specific permission or other valid rights |

**Selection rule:** do not add a candidate to product architecture merely because it is listed. Require a proven capability gap, named buyer/use case, component/version/rights review, data protection and security assessment, operating cost, fallback/exit plan and evidence-based acceptance.

## 5. GDPIR reference implementation research — record template

Do not rank or recommend any GDPIR entry until the source record is accessible and reviewed. For each DPI, create one evidence card with these fields where available; mark unavailable fields explicitly:

| Field | What to capture |
|---|---|
| Record identity | Official title, country, sector, record URL, date accessed and any GDPIR identifier |
| Public purpose | Problem, target population and core public service |
| Institutional model | Sponsor, operator, legal mandate, accountable agency, governance bodies and independent oversight |
| Ecosystem model | Participants, onboarding, participation rules, private vendors and dispute resolution |
| Architecture | Building blocks, interfaces, data exchange, trust, identity, payments, registries and interoperability standards |
| Data governance | Data controller/processor roles, consent or lawful basis, data sharing, access, retention and sovereignty |
| Security | Threat controls, authentication, authorisation, audit, incident handling and assurance |
| Maturity and rollout | GDPIR maturity scale as defined by source, deployment stage, jurisdictions and verified adoption measures |
| Source availability | Source code, specification, API, documentation, open licence and exact source links (do not presume availability) |
| Operating model | Hosting, operations, maintenance, service levels, support and continuity |
| Funding and sustainability | Public funding, procurement, operating costs, revenue/financing and long-term ownership |
| Outcomes and lessons | Evidence of public value, implementation challenges, known limitations and transferable lessons |
| RupayKg relevance | Potential environmental use case, national architecture mapping, local legal/institutional changes |
| Commercial opportunity | Buyer, budget owner, implementation package, recurring service, cost-to-serve and delivery partners |
| Decision | Reject / Watch / Prototype / Customer-validate / Approve for implementation; rationale and approver |

Create a separate pattern comparison across records only after at least two primary-source cards are complete. Avoid false comparisons where source records use different maturity definitions or non-equivalent metrics.

## 6. RupayKg target capability map to investigate

These are target capability areas to test against the live repository and customer needs, not claims that every capability is complete:

1. **Participant and facility identity:** organisation, ULB, district, facility, project, equipment and actor identifiers with governed hierarchy and access.
2. **Resource-flow operations:** generators, collection, transport, processing, recycling, disposal and material lineage.
3. **Environmental compliance:** applicability, obligations, evidence, reporting and accountable sign-off.
4. **Digital MRV:** activity data, measurement, factors/methodology versions, calculations, evidence, uncertainty, reconciliation and audit trail.
5. **Interoperability/data exchange:** versioned APIs, partner connectors, controlled ingestion, schema mapping, provenance and export.
6. **Trust and credentials:** authenticated participants, evidence integrity, verifier roles and verifiable credentials only where the use case and authority are established.
7. **Geospatial reference:** jurisdiction/facility/site geometry and mapping using reusable standards.
8. **Field operations:** offline capture/synchronisation, weighbridge/lab/device adapters and exception handling.
9. **Registry and reporting:** traceable records, report generation, public/private views and customer data portability.
10. **Commercial service plane:** organisation subscriptions, implementation scope, API tiers, managed service, billing, SLA, support and renewal operations.

For each capability: identify current repository implementation and test evidence; classify as PASS / PARTIAL / MISSING / NOT VERIFIED; add a measurable gap and design decision; do not infer from documentation alone.

## 7. Commercial service catalogue to validate

| Service offer | Paying customer hypothesis | Billable work | Evidence required before pricing |
|---|---|---|---|
| DPI / ecosystem integration assessment | Government department, ULB, PSU or programme SI | Discovery, architecture, security/data-flow mapping and implementation plan | Named sponsor, defined scope, procurement route, staff effort and delivery risks |
| Government / ULB environmental platform deployment | State, ULB, PSU or public programme | Configuration, onboarding, authorised interfaces, deployment, training and support | Written requirements, authorised data access, contract, acceptance criteria and hosting model |
| Enterprise environmental operations SaaS | Multi-site enterprise, generator, processor or recycler | Subscription, facility tiers, reporting, evidence and compliance workflows | Validated user demand, operating cost, data volumes, buyer budget and price tests |
| Digital MRV implementation and managed operations | Project developer or programme owner | Project onboarding, data ingestion, measurement/evidence workflows, reporting support and managed monitoring | Applicable methodology, buyer responsibilities, verifier independence and no guarantee of credit issuance |
| API / connector integration | Public/enterprise systems, OEMs and system integrators | Connector build, integration tests, version support and usage/maintenance fees | API permissions, version lifecycle, security review and maintenance cost |
| Data quality and audit-pack service | Organisations and programme managers | Reconciliation, exception analysis, evidence organisation and export | Clear responsibility boundaries; no claim of independent certification |
| Managed hosting and operations | Contracted enterprise/public-sector customers | Hosting, monitoring, backups, incident support and SLA | Hosting/data-location needs, security approval, unit economics and recovery testing |

Pricing must be based on cost-to-serve and buyer validation. Never charge for a favourable verification outcome, statutory approval, official certificate, regulator acceptance or access to public entitlements.

## 8. DIGICORE INFRASYS prerequisites

Before presenting the company as the legal owner/operator of products, close the following evidence:

- legal entity identity and current corporate records;
- confirmation of the exact legal/trading name and relevant trademark position;
- founder, employee, contractor and contributor IP assignments;
- third-party open-source/commercial licence register and software bill of materials;
- code and asset provenance, domain/brand ownership and customer contract terms;
- product security, privacy, support, incident and business continuity responsibilities;
- revenue recognition, tax, procurement eligibility and insurance/legal review as applicable.

Until documented, describe DIGICORE INFRASYS as the **intended** engineering/commercialisation company, not as the proven legal owner of every repository asset.

## 9. National deployment and Jabalpur sequencing

1. Maintain one national architecture and authoritative product codebase.
2. Complete the target capability map and identify the smallest high-value reusable feature gaps.
3. Select DPGA candidates only for those proven gaps; keep integrations replaceable and separately governed.
4. Translate applicable GDPIR patterns into documented architecture decisions only where original evidence is available and locally adaptable.
5. Deploy/validate the common architecture at Jabalpur SITE-JBP-01 using governed site configuration.
6. Record real field acceptance, data quality, equipment integration, offline/synchronisation, user operations and support evidence.
7. Complete separate national readiness tests: tenant isolation, multi-jurisdiction configuration, capacity, resilience, security, backup/restore, external integrations and operating economics.
8. Expand to additional jurisdictions only through approved customer/programme arrangements and repeatable deployment controls.

Jabalpur success does not by itself establish national readiness, statutory applicability across India, multi-state acceptance or TRL 9.

## 10. Decision and release gates

Every candidate or integration must pass all applicable gates:

- source and provenance verified;
- rights and licence reviewed;
- customer problem and buyer/budget validated;
- national architecture fit demonstrated;
- privacy, security and data-sharing basis reviewed;
- owner, operating model, support and exit path assigned;
- implementation and recurring economics measured;
- prototype and conformance tests passed;
- customer/field acceptance obtained;
- production and SHAKTI gates separately passed.

Allowed statuses: **RESEARCH**, **WATCH**, **PROTOTYPE**, **CUSTOMER-VALIDATION**, **APPROVED-FOR-IMPLEMENTATION**, **LIVE**, **RETIRED**. A status change requires evidence and a named decision owner.

## 11. Immediate ordered actions

| Order | Action | Owner role | Deliverable |
|---|---|---|---|
| 1 | Obtain a usable official GDPIR `dpicatedata` export/page record and record its actual schema, date, source links and reuse terms; preserve the 403 access blocker if access remains unavailable | Research lead / CTO | GDPIR source acquisition note and schema register |
| 2 | Complete the DPGA snapshot analysis: base snapshot and 165 DPG / 63 nominee counts have been retrieved; now deepen exact records for the ranked short-list and verify component/version/licence scope | Integration research lead | Curated, source-linked DPGA candidate register |
| 3 | Resolve OpenFn and other licence/source discrepancies against exact upstream release artefacts; confirm ODK component selection and contracts | Engineering + legal review | Versioned candidate due diligence cards |
| 4 | Audit the current RupayKg repository against the ten capability areas in Section 6 and cite files/tests for each status | CTO / architecture lead | Repository-backed capability and gap matrix |
| 5 | Select the highest-value one or two customer problems and prepare buyer validation, procurement path, delivery scope and cost-to-serve | Product/commercial lead | Validated offer cards; no invented prices |
| 6 | Map only verified GDPIR patterns to national architecture decisions and Jabalpur acceptance criteria | Architecture lead | Evidence-linked architecture decision records |
| 7 | Plan prototypes only after source, licence, architecture and buyer gates are clear | Engineering lead | Prototype plans with tests and exit criteria |

Parallel work is permitted for actions 1–3 and buyer discovery. Do not start production integrations or deployment changes before their gates pass.

## 12. Evidence and control rules

- Keep source URL, exact record/artifact identifier, retrieval date, version/commit, reviewer and evidence hash where practical.
- Preserve the difference between reported, independently verified, planned and inferred information.
- Never present GDPIR launch-era counts as current counts.
- Never assume a GDPIR entry has downloadable source code, an API or an open licence.
- Never assume a DPGA profile licence applies to all code, data and dependencies.
- Do not create a production runtime dependency on either research registry.
- Do not change tenant isolation, RLS, production DB, credentials, deployment, statutory logic or release gates as a side effect of catalogue research.
- Maintain the existing SHAKTI and national-first architecture gates.
- Reassess this roadmap whenever source availability, customer demand, law, licence, security or cost evidence changes.

## 13. Success definition

This strategy is working only when it produces measurable commercial and delivery outcomes:

- selected upstream components reduce build cost or improve a contracted deliverable;
- verified DPI patterns reduce institutional/deployment risk;
- RupayKg's shared national architecture remains interoperable and reusable;
- DIGICORE INFRASYS can quote, deliver and support repeatable integration and implementation services;
- real customers pay for measurable software and service value;
- Jabalpur generates evidence for the same national product, while national readiness is separately proven;
- IP, public-interest boundaries, privacy, security, data rights and statutory decision authority remain respected.

**Controlling rule:** research both ecosystems; verify before reuse; build one national environmental platform; sell measurable product, implementation and managed-service value; prove every deployment claim with evidence.
