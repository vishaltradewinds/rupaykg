# National Stakeholder Work-and-Reporting Matrix — RupayKg — 2026-10-31

**Purpose:** controlling product acceptance contract for complete environmental work, evidence, reporting and hand-offs. This is a national reference model; state, local body, waste-stream and statutory applicability remain configurable and versioned. It does not itself determine legal obligations or imply regulatory acceptance.

## 1. Product operating principle

RupayKg must represent the real work performed by every participant in the environmental value chain. It is not merely a portal for EPR returns or carbon credits.

The same physical activity and material movement must be recorded once, with linked role-specific views and reports. A generator, transporter, facility, recycler, municipality, producer, buyer and verifier must see the records they are authorized to see—not separately re-enter the same facts into disconnected dashboards.

**National scope:** all states and Union Territories, urban and rural jurisdictions, municipal and Panchayat systems, industrial/commercial/institutional generators, household and community flows, informal and formal workers, multiple waste/resource streams, languages and connectivity conditions.

**Generator is a first-class stakeholder.** Bulk Waste Generators (BWGs) are a regulated subtype where applicable; not every waste generator is a BWG. Household, commercial, institutional, industrial, agricultural and community generators need their own suitable workflows and reporting rules.

## 2. Shared physical and evidence lifecycle

`Obligation/Plan → Generation → Segregation → Storage → Collection Request/Schedule → Pickup → Weigh/Handover → Transport → Facility Receipt → Inspection/Sorting → Aggregation → Processing/Treatment → Recovered Output/By-product/Reject/Residual → Buyer/Offtake or Authorized Disposal → Verification → Reporting/Recognition`

Every stage must preserve:
- stable activity, lot, batch and custody-transfer identifiers;
- sender, receiver, accountable organization and relevant person/device;
- event time, capture time, server receipt time and authorized geography;
- material/waste stream, grade/quality, contamination and declared vs measured quantity;
- unit, measurement method, instrument/device, calibration/quality state and source;
- linked evidence, hash/URI, provenance, reviewer and decision;
- applicable jurisdiction, rule/methodology/source version and reporting period;
- exception, dispute, correction, reason, actor and immutable history.

The data model must distinguish declared, measured, received, reconciled, independently verified, eligible, officially accepted and settled quantities/statuses. Never silently overwrite one with another.

## 3. Stakeholder work-and-reporting matrix

| Stakeholder | Real work and end-to-end journey | Required evidence and records | Operational and management reports | Current repository evidence / gap |
|---|---|---|---|---|
| **Household / citizen generator** | Identify household/community; choose stream; segregate; store safely; request/receive collection; hand over material; receive collection receipt; report missed pickup or unsafe handling; track destination where available | Capture time/location, stream, declared quantity where feasible, pickup event, collector identity, receipt, complaint and resolution | Collection calendar; missed/late pickup; stream-wise collection; household participation; complaint status; receipt history | Citizen/farmer guided panel and multilingual experience exist; field capture supports GENERATION. Household collection scheduling, service receipts, complaint lifecycle and downstream traceability need full proof |
| **Commercial / institutional / industrial generator** | Register site and responsible operator; classify streams; record generation; segregate/store; schedule pickup; verify collector; weigh and hand over; track facility receipt and destination; reconcile monthly records | Site profile, stream-wise daily/period totals, weighment, handover manifest, collector/transporter, destination acknowledgement, evidence and exceptions | Site-wise generation; segregation; pickup compliance; handover vs receipt variance; destination; rejected loads; waste inventory; periodic management report | BWG reporting UI and statutory applicability foundations exist. General non-BWG generator and complete site-to-destination reconciliation are not established |
| **Bulk Waste Generator (BWG)** | All generator work plus threshold/applicability review, four-stream controls where legally applicable, wet/horticulture processing or authorized arrangements, registration evidence, applicable Extended BWG Responsibility and annual/periodic return preparation | Site area, water use, waste generation, measurement source, evidence and approved verification, applicability basis, official registration proof, stream records, on-site processing, handover and return documents | Applicability/threshold report; stream-wise generation/segregation/processing; onsite processing; handover and destination; annual return readiness; registration/acknowledgement/correction status | `bwg-reporting-panel.ts` and all six UI/API paths are implemented in `apps/src/value-routes.ts`, registered by `registerValueRoutes()` in `apps/src/server.ts`, and backed by canonical BWG tables from migrations 036–038. External registration is deliberately unasserted/user-reported. The corrected audit found a missing explicit `reports:read` gate on the workspace GET (now added in the current engineering branch with unit coverage); the reporting-period trigger requires a verified `APPLICABLE` BWG profile, while profile intake remains `REVIEW_REQUIRED/PENDING` and statutory assessment is stored separately. Route-level HTTP acceptance, verified determination linkage, external filing evidence and production migration reconciliation remain outstanding. |
| **Waste picker / collector / SHG / collection worker** | Onboard with consent and suitable identity; receive route/task; collect assigned stream; capture pickup/weight; issue receipt; hand over to next custodian; report unsafe conditions, rejected loads and payment/quantity disputes | Worker/task identity, route/geography, device, capture time, photos where appropriate, weighment source, recipient acknowledgement, payment records where in scope | Assigned work; pickups; quantity by stream; missed tasks; rejected/contaminated loads; earnings/payment status where lawful; safety incidents | Field capture, device binding, offline sync and multilingual citizen/farmer UI exist. Dedicated worker/collector task management, wage/benefit safeguards, safety and dispute workflows need proof |
| **Collection contractor / operator** | Accept service contract; plan routes and resources; allocate crews; complete scheduled pickups; monitor missed service; hand over loads; reconcile work against SLA | Contract, route/vehicle/crew, geotag/time, pickup evidence, weighment, handover, service exception and supervisor approval | Route completion; coverage; service-level performance; missed/late pickups; tonnes by stream; cost/unit; complaints; contractor invoice support | Field/operation capture foundations exist. Contract, dispatch, route optimization, SLA, invoice and grievance lifecycle not established as one complete journey |
| **Transporter / vehicle operator** | Accept dispatch; verify manifest/seal where applicable; record departure; carry load; record route/incident; arrive; weigh/receive; obtain receiver acknowledgement; reconcile dispatch and receipt | Vehicle/driver, trip/manifest, source and destination, dispatch and receipt weights, times, GPS, seals, incidents, weighbridge tickets and custody signatures | Trip register; in-transit loads; turnaround; route exceptions; weight loss/gain; delivery success; fuel/emissions where measured | Resource-flow and field-device foundations exist. Dedicated trip/manifest/vehicle and dispatch-to-receipt custody acceptance needs proof |
| **Aggregator / scrap dealer / collection centre** | Receive material; inspect and grade; weigh; accept/reject; segregate; maintain stock; aggregate lots; dispatch to processor/buyer; reconcile inventory | Inward ticket, source lot, grade/contamination, weighment, stock movement, split/merge lineage, dispatch and receiver acknowledgement | Inward/outward stock; grade-wise inventory; quantity balance; contamination/rejection; supplier/customer; ageing; loss and discrepancy | Resource-flow model and custody concepts exist. Full inventory, split/merge, quality, stock ledger and reconciliation screens need proof |
| **MRF / transfer station / material recovery facility** | Receive vehicle; weigh and inspect; unload; sort; classify recovered materials; record rejects/residuals; maintain stock; dispatch recovered fractions; report throughput and downtime | Inbound/outbound weighbridge, batch, sorting fractions, reject/residual destination, equipment/process records, calibration, staff and operating hours | Daily/monthly input-output mass balance; recovery rate; rejects; inventory; contamination; plant capacity/utilization; downtime; destination and contractor performance | CPCB SWM stakeholder workspace lists WASTE_FACILITY; resource flows and evidence/MRV foundations exist. Operational MRF plant ledger and verified mass balance need proof |
| **Recycler / processor / compost / biomethanation / RDF / co-processing facility** | Register authorization/capacity; receive and inspect input; weigh; process by batch; record parameters and outputs; quantify by-products/rejects/emissions; store and dispatch outputs; reconcile material balance | Authorization, input batch and receipt, process logs, energy/water/chemicals where relevant, output quality, by-product/reject/residual and destination, instrument/calibration and independent sampling | Input/output yield; recovery; process efficiency; residue; quality; capacity; energy/water; emissions; downtime; supplier and buyer performance | Processor is a CPCB SWM stakeholder type; MRV/evidence and material flow foundations exist. Facility-specific process ledger, output quality, mass balance and external authorization validation need proof |
| **Composting / biomethanation / landfill / disposal operator** | Receive eligible feed/residual; inspect and weigh; operate treatment/disposal; record process conditions, gas/leachate/emissions and rejects; maintain permits; close out loads | Gate weighment, waste acceptance criteria, process monitoring, methane/leachate/flare or treatment records, environmental monitoring, permits and incidents | Inward tonnes; treatment/disposal; methane captured/destroyed; residuals; environmental exceedances; capacity; permit and incident report | MRV and landfill methane methodology foundations exist. Live sensor/instrument validation, complete facility operational reporting and independent site evidence remain external gates |
| **Producer / importer / brand owner (PIBO)** | Determine applicable EPR category; register; calculate obligations; contract eligible processors/recyclers; obtain verified credits/evidence; reconcile obligation and fulfilment; prepare return; submit via official route; track acknowledgement, query, correction and closure | Product/category and market data, obligation source/version, eligible credit certificates, recycler/processor evidence, invoices, returns, submission receipt, authority query and response | Obligation vs fulfilment by category/year; eligible vs pending evidence; certificate/credit ledger; shortfall; due dates; filing status; authority acknowledgement and corrections | EPR applicability, obligation, evidence binding, assessment and BWG reporting foundations exist. Actual official portal submission/acceptance is not established; current registration claims are explicitly unverified |
| **PRO / EPR service provider** | Contract with PIBO; plan collection/recycling capacity; allocate partners; verify source and destination; assemble eligible evidence; manage service-level and return package | Contract, network, collection/recycling proofs, partner authorization, invoice, evidence and reconciliation | Client obligation coverage; network performance; material flow; evidence gaps; service cost; filing support | EPR data structures and marketplace direction exist. Dedicated PRO service and multi-client authorization/reporting not established |
| **Buyer / offtaker / manufacturer using recovered material** | Publish demand/specification; qualify supplier; place order; confirm grade/quantity; arrange dispatch; inspect/accept; resolve quality/quantity disputes; invoice and pay | Purchase order, specification, test certificate, dispatch/receipt weighment, inspection, rejection, invoice and payment confirmation | Procurement by material/grade; supplier reliability; quality; delivery; price; recycled content evidence; dispute and payment ageing | Value/registry/settlement workspaces exist downstream for environmental credentials. Complete physical material commerce and invoice/payment acceptance needs proof |
| **Verifier / auditor / validation body** | Accept scoped engagement; check independence/conflict; define sampling; inspect source evidence; reproduce calculations; record findings; request correction; approve/reject within authorized scope; sign report | Engagement, independence declaration, sampling plan, raw evidence, source/methodology version, calculation trace, findings, response and signed decision | Evidence completeness; sampled population; exceptions; corrections; material balance; methodology reconciliation; final assurance statement | Evidence vault, verification authorization, self-verification guard and provenance exist. Independent third-party operation, conflict management, appeals and accredited assurance acceptance remain unproven |
| **ULB / municipal corporation / ward authority** | Plan services; map wards and generators; procure/monitor contractors; schedule collection; monitor MRF/processing; inspect; handle complaints; enforce local requirements; prepare returns | Ward coverage, contractor, route, vehicle, facility, weighment, complaints, inspections, notices, service logs, processing/disposal and official reports | Ward-wise generation/collection; segregation; door-to-door coverage; processing/disposal; contractor SLA; complaints; facility capacity; statutory return; exceptions | CPCB SWM workspaces and ULB stakeholder type exist; urban operating context and geography controls exist. Full ward command centre, contractor lifecycle, complaints/enforcement and official return acceptance need proof |
| **Gram Panchayat / district / rural cluster authority** | Map villages/households/SHGs; organize collection and aggregation; support decentralized processing; coordinate regional transport; monitor open dumping/burning; report village/cluster outcomes | Village/cluster map, local operator, collection/aggregation, processing, disposal, incidents, community participation and field evidence | Village coverage; collection; segregation; decentralized processing; open dumping/burning; cluster throughput; service provider and district summaries | Rural context, geography hierarchy and citizen/farmer panel exist. Full Panchayat work queue, local contractor, cluster asset, complaint and district reporting need proof |
| **State / central regulator and government authority** | Publish/maintain source/rules; receive authorized reports; inspect; query/correct; acknowledge submission; monitor jurisdictions; issue orders/recognitions; audit compliance | Official source/version, authority identity, jurisdiction, submission receipt, signed acknowledgement, inspection, notice, response, order and immutable event | Jurisdictional compliance; submitted vs accepted; overdue; exceptions; inspection; corrective action; trends; source change impact | Statutory source catalog, CPCB/SWM and national government inbox worker foundations exist. Production official interfaces, authority identities, acceptance and enforcement integrations not established |
| **Carbon project developer / participant** | Define project boundary and baseline; establish additionality/eligibility; monitor activity; apply approved methodology; quantify; compile monitoring report; arrange independent validation/verification; submit to registry | Boundary, baseline, monitoring plan, methodology version, source data, evidence, calculation trace, uncertainty, leakage, safeguards, verifier and registry evidence | Monitoring-period report; baseline/project emissions; reductions/removals; uncertainty; leakage; safeguards; validation/verification; registry status | MRV, CCTS methodology and carbon workspaces exist. Approved method-specific eligibility, full safeguards, independent validation and official registry issuance not established |
| **Environmental attribute / credit registry and trust rail** | Accept authorized project/issuance; issue unique units; track ownership; transfer; retire/cancel; expose external status | Registry account, issuance/serials, external reference, consensus proof where used, transfer/retirement confirmation and reconciliation | Issued/active/transferred/retired units; double-counting controls; discrepancies; external confirmation | Internal registry lifecycle and Hedera/Guardian provenance paths exist. External live acceptance/consensus and registry confirmations must be independently proven |
| **Funder / lender / insurer / CSR or impact investor** | Evaluate project/facility; diligence permits, contracts and operating history; define financing/insurance terms; disburse; monitor covenants, risks and outcomes; handle claims | Due diligence, permits, audited records, cashflows, contracts, insurance, incidents, verified impact and disbursement evidence | Portfolio performance; milestones; exposure; operational risk; incidents; covenants; verified impact and repayment/claim status | No complete finance/insurance operating workflow established. Do not expose confidential stakeholder data by default |
| **Platform operator / support / administrator** | Onboard institutions; verify organizations/roles; manage jurisdiction/source catalogs; monitor jobs and queues; respond to incidents; support users; manage retention and access reviews | Approval trail, identity proof, permission change, source version, deployment, incident, backup/restore, support ticket and access log | Service health; user onboarding; queue lag; failures/quarantine; security events; support resolution; data quality; audit and recovery metrics | Platform admin, onboarding hierarchy, intelligence and worker foundations exist. Separation of duties, production runtime roles, operations SLOs and recovery are not proven |

## 4. Reporting architecture — one event record, multiple reports

Reports must be projections from shared, versioned source records, not separate user-entered copies.

### A. Operational reports
- Daily activity register by site, ward, village, route, facility and stream.
- Collection schedule, pickup, missed service, contractor and transporter performance.
- Inward/outward weighment, custody transfer, inventory and mass-balance reconciliation.
- Facility input/output, quality, rejects, residuals, capacity, downtime and incidents.
- Complaints, inspections, corrective actions, disputes and closure.

### B. Statutory and compliance reports
- Generator/BWG applicability and supporting evidence.
- Generator stream-wise generation, segregation, processing and handover.
- ULB/Panchayat jurisdictional service and waste management reports.
- Producer/importer/brand-owner obligation, eligible fulfilment and return readiness.
- Submission package, official receipt, authority query, correction and final acceptance state.
- Rule source, effective period, jurisdiction and report-definition version.

### C. Environmental/MRV reports
- Project boundary and baseline.
- Monitoring data by source, instrument, time and method.
- Material/activity and emission-factor/methodology lineage.
- Gross/net calculation, uncertainty, leakage and safeguards.
- Evidence completeness, independent verification and external registry state.
- Environmental outcomes only at the status justified by evidence.

### D. Commercial and financial reports
- Supplier/buyer order, quality, dispatch, receipt and invoice reconciliation.
- Service contract, contractor SLA, cost per tonne and payment state.
- EPR service/provider fees, credit/attribute ownership and transaction reconciliation.
- Financing milestones, disbursement, covenants and risk—only where separately authorized.

### E. Governance and assurance reports
- User/organization/device access and permission history.
- Evidence lineage, corrections and audit trail.
- Data quality, duplicate/replay/conflict and reconciliation exceptions.
- Source/methodology changes and affected reports.
- Incident, backup/restore, availability, queue lag and service performance.

## 5. Shared reporting rules

1. **Every report has a definition:** owner, audience, purpose, legal/contractual basis, fields, units, period, timezone, geography level, filters, calculation version and retention.
2. **Every number has a state:** declared, measured, received, reconciled, verified, eligible, officially accepted or settled.
3. **Every quantity has a unit and method.** Do not sum incomparable units or mix wet and dry weights without explicit conversion and basis.
4. **Every material balance is explicit:** opening stock + receipts − dispatches − processing/residual adjustments = closing stock, with documented tolerances and exceptions.
5. **Every custody handoff is bilateral:** sender dispatch and receiver acknowledgement must reconcile; one party cannot silently assert both sides.
6. **Every report is permission-scoped** by organization, jurisdiction, role, bilateral relationship and sensitive-data classification.
7. **Every statutory output is source-versioned.** A template or internal report is not a filed return; user-reported submission is not authority acknowledgement.
8. **Every MRV outcome is method-versioned and reproducible.** A calculation is not issuance.
9. **Every correction is additive/auditable** with actor, reason, previous value and evidence; preserve immutable history.
10. **Every national dashboard is aggregatable without exposing private row-level data** beyond the viewer's authority.

## 6. Canonical data contract required

The canonical model must support these entities or equivalent governed records:
- Party / Identity / Organization / Membership / Role / Permission.
- Site / Facility / Asset / Vehicle / Device / Jurisdiction / Geography.
- Waste stream / Material / Grade / Unit / Conversion rule.
- Obligation / Contract / Service plan / Schedule / Task / Complaint.
- Activity / Event / Lot / Batch / Manifest / Custody transfer.
- Measurement / Instrument / Calibration / Quality observation.
- Evidence object / hash / provenance / verifier engagement / decision / finding.
- Facility receipt / inventory movement / process run / output / residual / destination.
- Reporting period / report definition / report instance / submission / acknowledgement / correction.
- Regulatory source / rule version / applicability determination / methodology version.
- MRV monitoring record / calculation / validation / verification / environmental outcome.
- Credential / registry event / ownership / transfer / retirement / settlement.
- Invoice / payment / dispute / financing milestone where enabled.
- Exception / incident / corrective action / audit event.

## 7. Repository reconciliation — verified current implementation evidence

The following is based on source files inspected on branch `shakti/atomic-inbox-claim-2026-10-31`, not inferred from product labels:

- `apps/web/src/bwg-reporting-panel.ts`: dedicated BWG interface for applicability/registration profile, reporting period, waste report, EPR report and ESG report. It explicitly says external submission/acceptance is not inferred.
- `apps/src/statutory-routes.ts`: `/api/v1/statutory/applicability`, `/api/v1/statutory/bwg/assess`, EPR applicability and user-reported external-registration recording. The BWG thresholds and source reference are code-level implementation inputs, not a substitute for legal review.
- `apps/src/value-routes.ts`: BWG profile review basis and EPR assessment/evidence checks; official CCTS methods are blocked from generic calculation without reviewed method-specific adapter.
- `apps/src/cpcb-swm-routes.ts`: CPCB/SWM stakeholder workspace supports BWG, waste facility, ULB, district/Gram Panchayat, collector/transporter and processor; reported statuses remain user-reported/unverified.
- `apps/src/sync-routes.ts`: field device enrollment/verification, identity/org binding, offline envelope, idempotency, sequence collision, apply and conflict paths.
- `apps/web/src/citizen-farmer-guided-panel.ts`: guided citizen/farmer capture with national language options.
- `apps/web/src/field-capture-experience.ts`: generation, aggregation, measurement, transport and processing capture, with authorized geography and verified device requirement for authoritative sync.
- `apps/src/workspace-routes.ts`: resource-flow, MRV, compliance, carbon, registry, settlement and ESG read workspaces; organization/geography-scoped query patterns.
- `apps/web/src/operating-workflow-experience.ts`: cross-stage view from capture through MRV/provenance, registry and settlement; stage statuses distinguish pending/verified/confirmed/unavailable.
- `apps/web/src/ulb-command-center.tsx`, `resource-flow-panel.ts`, `compliance-panel.ts`, `epr-return-panel.ts`, `esg-panel.ts`, `mrv-provenance-panel.ts`, `registry-settlement-panel.ts`: role/domain interface components are present.

### Specific gaps or questions surfaced by reconciliation
1. Generator is represented in the product, citizen/farmer capture and BWG reporting; **general generator lifecycle** (all generator types, site-level stream ledger, storage, pickup scheduling, bilateral handover, destination acknowledgement and reconciliation) is not proven as one complete tested journey.
2. BWG UI requests `GET /api/v1/workspaces/bwg` plus five `/api/v1/bwg/*` writes. Inspection of `server.ts` registration and all 14 route-family modules confirmed these paths are absent. The existing statutory BWG assessment and EPR return endpoints do not satisfy this reporting-panel contract. Tracked in [issue #176](https://github.com/vishaltradewinds/rupaykg/issues/176); do not treat the panel as operational until all six paths and HTTP acceptance tests exist.
3. CPCB/SWM workspace stakeholder enum has BWG, WASTE_FACILITY, ULB, DISTRICT_PANCHAYAT, GRAM_PANCHAYAT, COLLECTOR_TRANSPORTER and PROCESSOR; it does not separately represent household, ordinary generator, recycler, PRO, buyer, verifier or funder.
4. Field capture currently records a declared quantity in activity metadata. This is not the same as a calibrated measurement or receiver-accepted weighment.
5. Resource-flow workspace is organization/geography scoped but a full sender-to-receiver bilateral custody and reconciliation report has not been evidenced.
6. BWG and ESG forms allow optional evidence references in some capture stages. Downstream verified/approved evidence must be required wherever the report makes a verified or statutory claim.
7. Workspace APIs expose capped recent rows (for example 100/200); reporting-period aggregation, export pagination, reproducible report snapshots and large-scale reporting performance need explicit design and tests.
8. Finance, insurance, invoice/payment for physical material trade, complaints, contractor SLAs, facility operations and worker protections are not yet complete stakeholder journeys.
9. No report may label an internally prepared return as submitted/accepted unless the official submission and acknowledgement evidence is attached.

## 8. Mandatory acceptance tests by journey

- Generator: record each stream; compare generated/segregated/handed-over/received quantities; support no-pickup and rejected-load exceptions; produce a period report with evidence state.
- BWG: threshold evidence and review; registration state remains unknown until authority proof; all required streams and processing/handover; annual return package; submission receipt/correction lifecycle.
- Collector: assignment → pickup → receipt → handover; offline replay; identity/device binding; duplicate prevention; worker cannot falsify receiver acknowledgement.
- Transporter: dispatch manifest → vehicle/trip → destination weighment → bilateral acceptance; weight variance and incident workflow.
- MRF/aggregator: inward → grade/sort → stock → dispatch; mass balance; split/merge lineage; contamination and residuals.
- Processor: input → process batch → outputs/by-products/residuals → destination; process evidence, calibration and mass balance.
- ULB/Panchayat: geography hierarchy → service coverage → contractor performance → facility outputs → complaint/inspection/corrective action → statutory report.
- PIBO: obligation → eligible evidence/credits → fulfilment assessment → return → official receipt → query/correction/acceptance.
- Buyer: order/specification → dispatch → receipt/quality → dispute → invoice/payment reconciliation.
- Verifier: engagement/independence → sample → source evidence → reproducible calculation → findings → correction → signed decision; deny self-verification and out-of-scope access.
- Regulator: source publication/version → authorized jurisdictional report → acknowledgement → inspection/query → response/correction → order/closure.
- MRV: boundary/baseline → monitoring → methodology calculation → uncertainty/safeguards → independent verification → external registry status.
- National reporting: state/UT/ULB/Panchayat roll-up; reconcile aggregates to source rows; protect confidential organization/person data; prove pagination, reproducibility and source versions.

## 9. Priority implementation sequence

**P0 — Prove existing product paths before adding features**
- Trace and test `/api/v1/workspaces/bwg` UI-to-handler path.
- Build route-to-screen-to-table-to-report crosswalk for all existing route families.
- Add generator general-purpose operating journey and stream-wise reporting contract.
- Identify all places where declared, measured, received, verified and accepted states are collapsed or ambiguous.
- Keep production tenant-isolation and migration gates ahead of all live execution.

**P1 — Complete physical operating chain**
- Bilateral handover and receiver acceptance.
- Trip/manifest and weighment reconciliation.
- Facility inward/outward stock and process mass balance.
- Complaints, exceptions, corrective actions and contractor SLAs.

**P2 — Reporting and compliance assurance**
- Versioned report definitions and reporting-period snapshots.
- Role-specific dashboards and exports backed by shared event records.
- Statutory source/version validation and official submission/acknowledgement adapters.
- Independent verifier workflow and report reproducibility.

**P3 — Commercial and national assurance**
- Material marketplace, order/quality/invoice/payment.
- Funder/insurer/CSR views with explicit data permissions.
- National aggregation, language/accessibility, capacity, support, privacy and recovery tests.

## 10. Release rule

A stakeholder journey is not complete because a UI panel or database table exists. It is complete only when the real actor can perform the work, the next actor can acknowledge the handoff, quantities reconcile, evidence is traceable, permissions are enforced, exceptions can be resolved, the report can be reproduced, and a real user/site has accepted the workflow.

This matrix is the product acceptance contract to be mapped to route code, schema, UI, tests, statutory source and field evidence. It is not proof that all listed workflows are implemented today.
