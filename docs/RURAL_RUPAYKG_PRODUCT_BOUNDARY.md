# Rural-first product boundary: KrishiKendra and RupayKg

**Decision status:** Product/architecture direction for the agricultural-residue pathway. This is not a regulatory eligibility decision and does not authorize carbon-credit issuance.

## 1. Product boundary

- **KrishiKendra is the farmer-facing rural service layer.** Its active user journeys remain Farm Mechanization Services and Machinery/Partner Network. Farmers, FPOs, custom-hiring centres, machinery operators, village aggregators and processors interact through simple, mobile-first workflows aligned to the agricultural calendar.
- **RupayKg is the evidence, circular-economy and environmental-value layer.** It consumes permissioned operational records from KrishiKendra and other authorized parties to establish material provenance, custody, processing, end use and MRV evidence.
- Biomass inventory, residue buyer matching and environmental value remain largely backend capabilities rather than extra farmer-facing verticals.
- Industrial CCTS workflows remain a separate, reusable compliance capability. They must not dictate the rural product's primary navigation, data model or onboarding experience.

## 2. Rural operating journey

1. Identify farmer/FPO, village, field/parcel, crop, season and consent/authority to record data.
2. Record the relevant baseline and residue-management plan with evidence provenance and review status.
3. Arrange mechanization/collection through the KrishiKendra partner network.
4. Record measured residue lots, units, moisture/basis where relevant, scale/ticket evidence and time/location.
5. Track custody transfers with sender and receiver acknowledgement, transport and weighment evidence.
6. Record processor intake, processing outputs, losses and documented final use; reconcile input/output mass.
7. Build a traceable MRV evidence package. Only then assess applicability against the complete, current, authoritative methodology and its monitoring requirements.
8. Keep operational payment/market transactions, estimated environmental benefit, independently verified reductions, project registration and officially issued credits as separate states.

## 3. Rural usability requirements

- Ordinary-phone-first, low-bandwidth and assisted workflows; avoid requiring a farmer to understand carbon terminology.
- Local-language labels and guided steps; capture only the data needed for the current task.
- Permit offline/delayed synchronization only with explicit timestamps, source identity and conflict handling; never silently treat unsynced data as verified.
- Support assisted onboarding by authorized FPO/partner staff while retaining attribution, consent and audit history.
- Design for village-level aggregation and practical field evidence, not only corporate facility records.

## 4. Evidence and integrity controls

- Every important record should retain source, actor/organization, event time, location where relevant, evidence hash/reference, review status and correction history.
- A satellite/fire anomaly is an evidence signal, not by itself a conclusive legal finding or automatic credit deduction. Methodology-specific treatment must be documented and independently reviewed.
- Do not infer carbon reductions from tonnes of residue alone. Calculations require a specifically applicable methodology, its approved parameters, baseline, additionality, leakage, uncertainty, monitoring and verification rules.
- Keep voluntary standards and CCTS pathways separate unless authoritative project-specific documentation establishes a lawful interaction. Prevent duplicate environmental claims.
- RupayKg must not mint or represent an estimated amount as an officially issued Carbon Credit Certificate. Issuance is an external registry outcome.
- A reviewer attestation that a source URL/hash was recorded is not proof that the underlying source is authoritative or that a project is eligible.

## 5. Release gates

Before describing this as a live rural MRV service, require:
- End-to-end tests for farmer/field intake, lot measurement, custody transfer, processor receipts, corrections and cross-organization reconciliation.
- Realistic field trials with farmers/FPOs, collection partners and processors.
- Verified geospatial intersection and documented satellite/provider data provenance where those sources are used.
- Independent weighing-device and evidence-source validation appropriate to the use case.
- A methodology applicability decision supported by the full current official methodology and project-specific review.
- Security, privacy/consent, retention, audit, recovery and role-separation checks.
- Independent validation/verification and registry reconciliation where required by the selected pathway.

**Current implementation note:** The agricultural-residue APIs and schema on this feature branch are an evidence-layer foundation only. They are not a complete farmer-facing product, a validated carbon calculation engine, a registered project, an independently verified reduction, or a deployed service.
