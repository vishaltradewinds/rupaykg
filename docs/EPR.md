# EPR Compliance

EPR workflows connect obligated entities with eligible collection/recycling/processing evidence.

## India applicability catalog

The production regulatory catalog is versioned and must be evaluated against the applicable authority, material, stakeholder, jurisdiction and reporting period. Current national regimes represented in the catalog include:

- Plastic packaging — Plastic Waste Management Rules, 2016 and amendments; CPCB plastic EPR portal.
- E-waste — E-Waste (Management) Rules, 2022 and amendments; CPCB E-Waste EPR portal.
- Batteries — Battery Waste Management Rules, 2022 and amendments; CPCB Battery EPR portal.
- Waste tyres — Hazardous and Other Wastes (Management and Transboundary Movement) rules and the waste-tyre EPR regime; CPCB Waste Tyre EPR portal.
- Used oil — Hazardous and Other Wastes (Management and Transboundary Movement) Second Amendment Rules, 2023, effective from 1 April 2024; CPCB Used Oil EPR portal.
- End-of-life vehicles — Environment Protection (End-of-Life Vehicles) Rules, 2025, effective from 1 April 2025, with separate handling for waste streams governed by their own EPR rules.
- Construction and demolition waste — Environment (Construction and Demolition) Waste Management Rules, 2025 and the CPCB C&D compliance system.
- Solid waste — Solid Waste Management Rules, 2026, which came into force on 1 April 2026 and define the applicable municipal/rural solid-waste operating boundary and exclusions for separately regulated waste streams.

This catalog is an implementation boundary, **not a statutory registration or compliance certificate**. RupayKG must retain the applicable rule/version, external registration or submission reference, authority response state, reporting period and evidence lineage. Statutory acceptance remains with the competent authority/portal.

## Core entities

- obligation
- obligated organization
- material/category
- compliance period and jurisdiction
- applicable regulatory requirement
- eligible activity
- evidence package
- authorized recycler/processor
- verifier/reviewer
- submission
- external authority reference

Compliance status is derived from persisted obligation rules, eligible evidence and approval decisions. The UI must never default an obligation to compliant.

## Truth model

An internally assessed obligation is not the same as statutory acceptance. The lifecycle must distinguish:

`OPEN → EVIDENCE_PENDING → ASSESSED → SUBMITTED → AUTHORITY_PENDING → ACCEPTED / REJECTED`

Only an authoritative external acceptance or an explicitly defined statutory evidence rule may establish the corresponding regulatory status. If the external authority is unavailable, the record remains explicitly unavailable/pending rather than being marked successful.

## MRV dependency

EPR quantities must be traceable to authoritative activities, measurements, evidence and verification. Where the value/credential lifecycle requires it, Guardian MRV verification and Hedera HCS consensus provenance are upstream gates and cannot be bypassed by an EPR UI action.

## External systems

Government/regulator integration must retain both the external reference and response state. RupayKG may prepare, validate, reconcile and report compliance data, but must not impersonate CPCB, SPCB/PCC, MoEFCC, ULBs or other statutory authorities.