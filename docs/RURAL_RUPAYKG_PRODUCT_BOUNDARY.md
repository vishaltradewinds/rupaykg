# RupayKg rural operating model

**Decision status:** Product and architecture direction for RupayKg. This is not a regulatory eligibility decision and does not authorize carbon-credit issuance.

## 1. Product purpose

RupayKg is a rural-first waste-to-value and environmental MRV infrastructure platform. It should help rural participants turn waste and biomass streams into traceable material, commercial and environmental outcomes, while preserving evidence needed for legitimate reporting and any applicable carbon-credit pathway.

Rural users and operating partners may include farmers and farmer groups, village waste collectors, aggregators, self-help groups, rural entrepreneurs, local bodies, transporters, recyclers, biomass processors, composting/biogas operators, industrial buyers, project developers, auditors and authorized verifiers.

RupayKg is its own platform. Its product scope, identity, roadmap and user journeys must not depend on or be presented as a module of another platform.

## 2. Rural operating journey

1. **Discover the local waste stream:** identify the source, material type, geography, seasonality, approximate quantity, current handling/disposal practice and responsible parties.
2. **Register the source and baseline evidence:** record relevant source/parcel or facility identifiers, permissions/consent where applicable, baseline practice, evidence provenance and review status.
3. **Organize collection and aggregation:** register collectors, collection points, schedules, transport and agreed material specifications; support assisted and low-bandwidth data entry.
4. **Measure the material:** record quantity, unit, measurement method, time, moisture/basis when relevant, weighing ticket or device reference and supporting evidence.
5. **Maintain custody:** capture each handover with sender and receiver, time, location, transport reference, quantity and evidence; identify missing acknowledgements and discrepancies.
6. **Verify processing and final use:** record processor intake, process type, outputs, losses, rejects and end-use evidence; reconcile incoming and outgoing mass and investigate unexplained differences.
7. **Record commercial outcomes:** connect material transactions, service charges, buyer receipts and settlements where in scope. Keep commercial settlement separate from environmental claims.
8. **Build the MRV evidence package:** link source, baseline, activity, measurement, custody, processing and end-use records. Assess the full current methodology and project-specific eligibility before making a regulated or crediting claim.
9. **Track independent assurance and external outcomes:** keep internal review, validation, verification, project registration, submission and official registry issuance as separate states.

## 3. Rural usability requirements

- Design for ordinary Android phones, low bandwidth, intermittent connectivity and assisted use at village collection points.
- Use guided workflows and local-language-ready labels; do not require a rural participant to understand carbon accounting.
- Capture the minimum data required at each step, with clear explanations of why it is needed.
- Support delayed synchronization only with original event time, sync time, source/actor identity, idempotency and conflict handling. Unsynced records must not silently become verified evidence.
- Support multiple operating models: individual source, group/FPO, village aggregator, local body, independent collector and processor.
- Make exceptions visible: missing weighment, unmatched custody handover, quantity mismatch, duplicate ticket, rejected load or missing end-use proof.
- Provide an assisted operator path without hiding who entered or attested to a record.

## 4. Evidence and integrity controls

- Important records should retain source, actor and organization, event time, location where relevant, evidence reference/hash, review status and correction history.
- A photograph or satellite/fire anomaly is a supporting signal, not automatically a conclusive legal finding. Apply only the consequence specified by the applicable methodology and review process.
- Do not infer carbon reductions from tonnes collected or processed alone. Calculation requires a specifically applicable methodology, baseline, additionality, approved parameters, leakage and uncertainty treatment, monitoring rules and the required independent assurance.
- Keep CCTS and voluntary crediting pathways distinct unless authoritative project-specific documentation establishes a lawful interaction. Prevent duplicate environmental claims.
- Never represent an application estimate or internal ledger entry as an officially issued Carbon Credit Certificate. Issuance is an external registry outcome.
- A stored source URL or hash proves what was recorded, not that the source is authoritative or that a claim is eligible.
- Preserve an auditable trail for corrections, disputed measurements, custody breaks, rejected evidence and reviewer decisions.

## 5. Platform capability boundaries

RupayKg may provide:
- Rural source and waste-stream onboarding.
- Material lot, measurement, custody and processing records.
- Aggregation and buyer/processor traceability.
- Mass-balance and exception management.
- Evidence collection, provenance, review and audit trail.
- Methodology applicability controls and versioned MRV evidence packages.
- Commercial reconciliation where explicitly implemented.
- Interfaces to authorized validation, verification and registry workflows when supported by verified integrations.

Do not describe a capability as operational merely because a database table, API route, user interface or mock integration exists. Distinguish implemented, tested, externally integrated, independently validated and production-deployed states.

## 6. Release gates

Before describing RupayKg as a live rural MRV service, require:
- End-to-end tests for source registration, measurement, custody handover, processing, correction and cross-organization reconciliation.
- Field trials with representative rural participants and operating partners.
- Geospatial and external-data provenance validation wherever those data are used.
- Independent weighing-device and evidence-source validation appropriate to the use case.
- A methodology applicability decision supported by the complete current authoritative methodology and project-specific review.
- Security, privacy/consent, access control, retention, audit and recovery checks.
- Independent validation/verification and registry reconciliation where required by the selected pathway.

**Current implementation note:** The agricultural-residue APIs and schema on the feature branch are an evidence-layer foundation only. They are not a complete rural product, a validated carbon calculation engine, a registered project, an independently verified reduction or a deployed service.
