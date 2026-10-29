# GRI Cross-Mapping Schema Extension — RupayKg

**Status:** Draft engineering foundation; not production-certified.  
**Schema version:** 1.0.0  
**Target repository:** `vishaltradewinds/rupaykg`

## Repository audit and integration boundary

The correct canonical repository is `vishaltradewinds/rupaykg`. It already contains ESG/BRSR structured reporting (`packages/esg`, `docs/ESG.md`, `migrations/060_brsr_structured_reporting.sql`), EPR lifecycle/catalog/evidence controls (`docs/EPR.md`, EPR routes and migrations), CPCB/SWM workflows, and MRV/evidence provenance. This extension must integrate with those existing domains, not create a parallel application or duplicate EPR/ESG data models.

## Governing rule

GRI reporting, Indian statutory compliance, EPR portal acceptance, CCTS obligations, independent assurance, and carbon-credit eligibility are separate determinations. A cross-map documents a relationship between requirements; it does not itself establish equivalence, legal compliance, regulator acceptance, GRI certification, assurance, or credit issuance.

## Initial GRI registry candidates

Store exact standard identifiers, versions, effective dates and authoritative URLs. Confirm applicability and materiality before approving a mapping.

| RupayKg source domain | Candidate GRI disclosure family | Relationship | Non-equivalence guard |
|---|---|---|---|
| Waste flows and processing evidence | GRI 306 Waste 2020 | Supports / partial overlap | Indian regulatory categories and GRI definitions may differ. |
| Materials and recycled content | GRI 301 Materials 2016; GRI 306 Waste 2020 | Supports | A waste receipt alone does not prove recycled content. |
| GHG inventory and carbon MRV | GRI 305 Emissions 2016; transition to GRI 102 Climate Change 2025 by effective date | Supports | GRI disclosure does not establish CCTS eligibility or credit issuance. |
| Energy data | GRI 302 Energy 2016; transition to GRI 103 Energy 2025 by effective date | Supports | Energy records alone do not establish compliance with a CCTS target. |
| Water and effluents | GRI 303 Water and Effluents 2018 | Supports | Preserve withdrawal, consumption and discharge distinctions. |
| Governance and reporting practices | GRI 2 General Disclosures 2021; GRI 3 Material Topics 2021 | Supports | Organization-specific governance and materiality evidence is required. |
| EPR obligations and returns | Relevant GRI waste/material disclosures | Partial overlap | Never treat GRI mapping as a CPCB filing, certificate or authority acceptance. |
| ICVCM Core Carbon Principles | Relevant climate/governance disclosures | Contextual | Voluntary integrity benchmarks do not replace Indian law or crediting-program rules. |

GRI 101 Biodiversity 2024 is effective for reporting from January 2026. GRI 102 Climate Change 2025 and GRI 103 Energy 2025 are scheduled to be effective for reporting from January 2027. Implement effective-dated versions; do not rewrite prior reporting periods.

## Record contract

`schemas/gri-cross-mapping.schema.json` defines a mapping record containing:
- Source requirement identity, legal/voluntary authority type, version, official source and effective dates.
- Target framework, GRI standard/disclosure identifier, version and effective date.
- Relationship class and documented rationale/limitations.
- Entity-specific applicability, thresholds, period and reviewer.
- Metric units, calculation method, reporting boundary and disaggregation.
- Evidence IDs, provenance, reporting period, integrity and lineage status.
- Separate double-counting, assurance, statutory compliance and credit-eligibility statuses.
- Owner/approver roles and version/change-log references.

## Integration plan — reuse existing architecture

1. Extend the existing ESG/BRSR framework registry in `packages/esg`; preserve existing framework validation and metric classification.
2. Bind mapping records to existing `esg_reporting_periods`, `esg_metrics`, EPR obligations/returns, evidence-vault records and MRV provenance by stable identifiers; do not copy authoritative measurements into a new competing source of truth.
3. Add an additive database migration only after auditing current migrations and table constraints. Use effective-dated mapping versions and immutable reporting-period snapshots.
4. Expose mapping read/write operations through existing authenticated server routes with organization-scoped RBAC, audit logging and strict validation.
5. Extend existing ESG/reporting panels only after API contracts and stakeholder permissions are confirmed.
6. Export a disclosure index showing mapping version, applicability, source evidence, omissions, estimates, limitations and assurance status.
7. Keep GRI disclosure readiness, EPR statutory state, CCTS state, external authority acceptance and credit issuance as separate state machines.

## Shakti Standards release gates

- **A — Regulatory source:** official source and effective dates checked.
- **B — Applicability:** organization, material/activity, thresholds, jurisdiction and reporting period resolved.
- **C — Mapping review:** clause-level rationale and limitations approved by the relevant reporting/compliance owner.
- **D — Evidence integrity:** lineage, units, boundaries, reconciliation and double-counting controls pass.
- **E — Integration:** existing APIs, migrations, RBAC, UI and exports work without regression.
- **F — Assurance:** external assurance is claimed only when supported by independent evidence.
- **G — Production:** CI, security, regression, rollback and operational readiness gates pass.

## Minimum acceptance tests

- Reject records without source/target versions or a rationale.
- Do not approve a mapping with undetermined applicability.
- Prevent a GRI mapping from setting EPR/CCTS compliance or credit eligibility automatically.
- Preserve historical mapping versions and reporting-period snapshots.
- Reject evidence that is missing, rejected or quarantined for a required disclosure.
- Detect duplicate physical waste quantities across generator/collector/processor custody events.
- Enforce organization-level authorization and immutable audit events.
- Verify effective-dated GRI 102/103 transitions and report version.
- Ensure existing BRSR, EPR, CPCB/SWM and MRV tests remain green.

## Official references

- GRI Standards: https://www.globalreporting.org/standards/
- GRI Universal Standards: https://globalreporting.org/standards/standards-development/universal-standards/
- GRI Standards development/effective dates: https://www.globalreporting.org/standards/standards-development/

**Engineering disposition:** this PR provides the schema/documentation foundation only. Runtime integration, migration, route/UI changes and automated tests are not claimed complete by this change.
