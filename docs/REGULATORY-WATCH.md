# Regulatory and Government Source Watch

## Purpose

RupayKg operates in regulated waste, environmental, carbon, compliance and public-sector workflows. Regulatory facts must therefore come from authoritative Indian government sources and be versioned rather than hard-coded as permanent assumptions.

## Source hierarchy

1. Gazette of India / e-Gazette notifications and competent statutory notifications.
2. Ministry of Environment, Forest and Climate Change (MoEFCC).
3. Bureau of Energy Efficiency (BEE) and Ministry of Power for the Indian Carbon Market / CCTS.
4. Central Pollution Control Board (CPCB) and applicable State Pollution Control Boards / Pollution Control Committees.
5. Other competent ministries, departments, statutory authorities and official government portals relevant to a specific workflow.
6. Secondary sources may provide discovery context only; they are not the authority for an implemented regulatory rule.

## Product rule

A regulatory requirement is not considered active in RupayKg merely because a draft, consultation, news report or policy proposal exists. Each requirement must record:

- authority
- instrument type (Act, Rule, Regulation, Notification, Circular, Order, Guideline, Draft, Consultation)
- official title and reference number where available
- publication date
- effective/commencement date where applicable
- jurisdiction
- affected waste/material/activity
- affected stakeholder and role
- affected RupayKg module
- source URL
- verification date
- implementation status: `DRAFT | PROPOSED | NOTIFIED | IN_FORCE | SUPERSEDED | WITHDRAWN`
- reviewer/approval record before changing production behavior

## Current verified baseline (2 September 2026)

### Solid waste

MoEFCC has published the **Solid Waste Management Rules, 2026**, notified as S.O. 388(E) dated 27 January 2026. The official notification states that the rules come into force on 1 April 2026 and apply to urban bodies as well as rural local bodies and entities within their jurisdictions. The rules also distinguish waste streams covered by separate regulatory regimes.

**RupayKg impact:** the common urban/rural waste domain must be designed around the 2026 rules as the current baseline, with rule versions and jurisdiction-specific applicability stored as data rather than embedded in UI logic.

Official sources:
- https://moef.gov.in/rules-regulations-3
- https://moef.gov.in/new_releases/update?archive=1

### Indian Carbon Market / CCTS

BEE's current Carbon Market material describes the Indian Carbon Market framework and the Carbon Credit Trading Scheme (CCTS), including compliance and offset mechanisms. BEE states that Carbon Credit Certificates represent one tonne of CO2 equivalent reduction or removal, subject to the scheme's applicable requirements. BEE also maintains procedures for the compliance mechanism, offset mechanism, and accreditation of carbon verification agencies.

The Ministry of Power reported in March 2026 that BEE's Detailed Procedure for Compliance Mechanism establishes the MRV framework, with BEE acting as administrator and the Indian Carbon Market institutional framework operating with registry and trading components. The Ministry's 2025-26 annual report states that GEI targets for seven energy-intensive sectors had been notified as of January 2026, covering 490 obligated entities.

**RupayKg impact:** carbon workflows must model methodology/version, MRV evidence, verifier/ACV status, eligibility, issuance and registry state separately. A completed calculation must never be represented as an issued Carbon Credit Certificate.

Official sources:
- https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=189
- https://beeindia.gov.in/show_content.php?lang=1&level=2&lid=495&ls_id=461
- https://powermin.gov.in/

### Accredited carbon verification

BEE maintains an official register of Accredited Carbon Verification Agencies and publishes accreditation procedures and eligibility criteria. BEE's 2026 material includes agencies accredited/provisionally accredited for compliance and/or offset mechanisms and sectors including waste handling and disposal and agriculture.

**RupayKg impact:** verifier selection and verification authority must be represented as governed data. The platform must not label a party as an accredited verifier based solely on user-entered text.

Official source:
- https://beeindia.gov.in/view_content.php?lang=1&lid=568

### Other waste streams

MoEFCC's rules and orders include separate regimes for e-waste, battery waste, plastic waste/EPR, hazardous and other wastes, and end-of-life vehicles. These must remain separate regulatory modules even when their operational flows share common collection, measurement, evidence and processing concepts.

Official source:
- https://moef.gov.in/rules-regulations-3

### Article 6 / international cooperation

MoEFCC publishes official material relating to India's Article 6 mechanisms, including the National Designated Authority framework and lists/procedures for Article 6.2 and Article 6.4 activities. These should be modeled separately from domestic CCTS issuance and must not be conflated with ordinary platform carbon calculations.

Official source:
- https://moef.gov.in/orders/update?archive=1

## Change-control workflow

`DISCOVER -> VERIFY OFFICIAL SOURCE -> CLASSIFY LEGAL STATUS -> ASSESS IMPACT -> REVIEW -> VERSION RULE -> IMPLEMENT -> TEST -> AUDIT`

No automatic regulatory change should silently alter compliance outcomes. A rule update should create an explicit versioned configuration change and an auditable implementation decision.

## Monitoring

A recurring regulatory watch is configured outside the application to monitor official Indian government sources. The watch prioritizes MoEFCC, BEE, Ministry of Power, CPCB, State Pollution Control Boards / Pollution Control Committees, Gazette notifications and other competent authorities. Material findings should be reviewed before they change production behavior.
