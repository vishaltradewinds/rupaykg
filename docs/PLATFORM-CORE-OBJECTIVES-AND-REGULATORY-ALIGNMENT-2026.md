# RupayKg — Core Objectives & Regulatory Alignment (2026)

## 1. Purpose

RupayKg is the **operating system for trusted environmental resource flows**: it records real-world waste and biomass activity, establishes regulatory applicability, preserves measurement/evidence lineage, runs controlled MRV and verification, and prepares only eligible outcomes for environmental-value, registry and governed settlement workflows.

The platform must optimize for **trust, compliance, auditability and operational utility**, not for the number of screens or the number of environmental credits displayed.

This document is the product/engineering alignment gate for the next implementation cycle.

## 2. Regulatory-first position

As of 2026, the platform must not continue treating the Solid Waste Management Rules, 2016 as the primary urban/rural baseline. The Ministry of Environment, Forest and Climate Change notified the **Solid Waste Management Rules, 2026**, effective 1 April 2026, superseding the 2016 Rules.

The SWM 2026 operating model therefore becomes the statutory baseline for applicable solid-waste workflows, while other waste streams remain governed by their own current rules and competent authorities.

RupayKg is a technology platform and **does not itself confer statutory registration, environmental authorization, verification accreditation, carbon-credit issuance, EPR certificate issuance or government approval**.

## 3. Core objectives

### Objective A — Record reality

Every authoritative environmental record must represent a real actor, organization, geography, activity, time, material/resource and quantity. Synthetic production data is prohibited.

### Objective B — Establish applicability before obligation/value

The system must answer, in order:

1. Which jurisdiction applies?
2. Which actor/entity is responsible?
3. Which statutory framework applies?
4. What obligation/eligibility does that framework create?
5. What evidence is required?
6. What measurement/MRV methodology applies?
7. What external authority action is required?

No generic "waste = carbon" or "activity = credit" shortcut is permitted.

### Objective C — Make evidence auditable

Measurement, evidence, verification, methodology, provenance and external references must remain linked to the originating activity and organization/geography authorization.

### Objective D — Separate trust layers

The UI and API must never collapse these states:

`Captured → Authoritative → Measured → Evidenced → Verified → Guardian MRV → HCS Consensus → Value Eligible → Registry State → Settled`

A successful database write is not external consensus. HCS consensus is not government issuance. Internal eligibility is not an official certificate.

### Objective E — Serve both government/local operations and enterprise compliance

RupayKg should operate as one common trust core with context-specific operating surfaces:

- **Urban:** ULB/Municipal Corporation → Ward → Facility → MSW activity.
- **Rural:** Gram Panchayat → Village → Producer/FPO/Facility → biomass activity.
- **Enterprise:** BWG/EPR/statutory applicability → evidence → reporting/obligation management.
- **Carbon:** mechanism eligibility → methodology → MRV → verification → authority-governed issuance/registry boundary.

## 4. 2026 SWM statutory alignment

The SWM Rules 2026 apply to urban and rural local bodies and a broad range of generators/entities. They mandate four-stream source segregation and introduce a clearer Bulk Waste Generator regime and Extended Bulk Waste Generator Responsibility.

For platform purposes, a BWG assessment must evaluate all three statutory criteria independently:

- floor area: **20,000 sq m or more**;
- water consumption: **40,000 litres/day or more**;
- solid waste generation: **100 kg/day or more**.

The assessment must preserve the underlying measurements and supporting evidence rather than storing only a yes/no result.

BWG workflows should support, where applicable:

- registration/application tracking;
- four-stream segregation evidence;
- collection and handover records;
- decentralised wet/horticulture waste processing evidence;
- EBWGR certificate/reference tracking;
- authorised agency/facility relationships;
- compliance reporting and audit trail;
- environmental-compensation/non-compliance tracking when applicable.

The platform must treat local-body bye-laws, SPCB/PCC requirements and CPCB procedures as additional applicability inputs rather than assuming the central rule alone is sufficient.

## 5. EPR is a family of regulated mechanisms, not one generic credit

RupayKg must keep EPR schemes distinct by waste stream and competent authority. At minimum, the architecture must distinguish applicable mechanisms such as:

- plastic packaging;
- e-waste;
- waste batteries;
- used oil;
- waste tyres;
- other notified waste streams.

An EPR record must retain the scheme, rule reference, applicability basis, registration status/reference, obligation period, quantity basis, evidence, verification and external certificate/reference where applicable.

The platform must not present an internal EPR record as an official CPCB certificate.

## 6. Indian Carbon Market alignment

The Bureau of Energy Efficiency currently publishes two distinct ICM pathways:

1. **Compliance mechanism** for notified obligated entities against prescribed GHG emission-intensity targets.
2. **Offset mechanism** for eligible project-based GHG reduction/removal/avoidance activity by non-obligated entities.

RupayKg must enforce **mechanism before value**. A carbon record cannot become value-eligible without an explicit mechanism, applicable methodology/version, project/entity eligibility and required evidence.

For the current published offset catalogue, BEE lists waste-handling methodologies including:

- BM WA03.001 — Landfill methane recovery;
- BM WA03.002 — Flaring or use of landfill gas;
- BM AG04.001 — Methane recovery from livestock/manure management;
- other sector methodologies as published by BEE.

These are methodology gates, not generic conversion factors. A waste or biomass activity must never automatically become a carbon credit.

The platform must also preserve the boundary between:

`RupayKg calculated/prepared environmental value` and `official Carbon Credit Certificate / registry status`.

## 7. Golden operating model

The canonical operating chain is:

```text
Actor / Organization
      ↓
Authorized Geography
      ↓
Real Activity / Resource Flow
      ↓
Measurement
      ↓
Evidence
      ↓
Regulatory Applicability
      ↓
Methodology / Obligation Gate
      ↓
Authorized Verification
      ↓
Guardian MRV (when applicable)
      ↓
Hedera Provenance / Consensus (when configured and successful)
      ↓
Eligibility Decision
      ↓
Credential / Registry Boundary
      ↓
Transfer / Retirement (where applicable)
      ↓
Settlement / Reconciliation (where applicable)
      ↓
Reporting / Audit Package
```

The order is intentional. Regulatory applicability is not a decorative dashboard widget; it is a gate in the operating model.

## 8. Urban and Rural are operating contexts, not separate products

Both contexts share the same authoritative trust rail:

`Identity → Organization → Geography → Activity → Measurement → Evidence → Verification → MRV → Provenance → Value/Obligation → Registry → Reporting`

Only the operating vocabulary, actor model, geography hierarchy and resource taxonomy change.

### Urban

`State → District → ULB → Ward → Facility → Activity`

Primary operating examples: MSW generation, collection, aggregation, MRF/recovery, processing, landfill/legacy-waste workflows, BWG compliance.

### Rural

`State → District → Block → Gram Panchayat → Village → Producer/Facility → Activity`

Primary operating examples: agricultural residue, livestock/manure, forestry/biomass and decentralised resource processing.

Rural must not be implemented as a visually renamed Urban workflow. Its actor, evidence, aggregation and measurement semantics must remain appropriate to village/producer/FPO operations.

## 9. Product architecture priorities

### P0 — Trust spine

Keep and strengthen:

- PostgreSQL as authority;
- organization/RBAC authorization;
- geography authorization;
- verified field-device identity;
- offline queue with authoritative replay;
- activity/resource-flow lineage;
- measurement/evidence binding;
- controlled verification;
- Guardian MRV boundary;
- Hedera provenance boundary;
- registry/credential controls;
- settlement authorization and reconciliation;
- append-only/audit protections.

### P1 — Regulatory operating layer

Build one reusable regulatory applicability layer that can answer:

- framework;
- rule/version;
- effective period;
- jurisdiction;
- responsible entity;
- applicability status;
- evidence basis;
- verifier/authority;
- external registration/reference;
- next compliance action.

### P1 — Golden transaction proof

Prove one complete Urban transaction and one complete Rural transaction through the real backend. The proof must use real authorization and real database state; external integrations must remain honestly unavailable when their production credentials are absent.

### P2 — Operating intelligence

Only after the trust spine and transaction proof are stable, add dashboards, recommendations, analytics and AI assistance. Intelligence must read authoritative state; it must not manufacture state.

## 10. UI principles

The old AI Studio repository may be used for **visual/design reference only**. Its architecture must not be copied over the canonical repository.

The new UI should communicate:

- what is happening;
- who is responsible;
- where it happened;
- what evidence exists;
- what has been verified;
- what is still pending;
- what authority is required next;
- whether external provenance is actually confirmed;
- whether the outcome is merely eligible/prepared or officially issued.

Use explicit status labels rather than generic success badges.

## 11. Non-negotiable anti-patterns

Do not:

- fabricate production records;
- create fake carbon quantities to populate dashboards;
- call an internal calculation a CCC/EPR certificate;
- call database persistence "blockchain confirmation";
- bypass organization/geography authorization for demos;
- bypass verified field-device controls;
- allow self-approval where independent verification is required;
- silently use a methodology that is not applicable to the mechanism/activity;
- assume a central rule removes the need for local/SPCB/CPCB requirements;
- create a second production deployment to test a UI change;
- weaken fail-closed external integrations just to make a screen green.

## 12. Regulatory source hierarchy

When product behavior is changed, reconcile sources in this order:

1. **Official Gazette / statutory notification** — legal rule text and effective date.
2. **Competent authority** — CPCB, SPCB/PCC, BEE, relevant ministry/department and official portals/procedures.
3. **Official methodology/procedure/guideline** — operational eligibility, forms and verification requirements.
4. **Court/NGT orders** where they materially affect implementation.
5. Secondary industry material only for interpretation/context, never as the primary authority for statutory behavior.

Current baseline sources reviewed for this alignment include MoEFCC's SWM Rules 2026 notification, CPCB's central SWM portal, BEE's CCTS/offset methodology publications, and CPCB waste/EPR materials.

## 13. Acceptance gates for the next release

A release is not accepted merely because it builds.

### Gate 1 — Build

Production build succeeds and CI remains green.

### Gate 2 — Security

Authorization, organization scope, geography scope, verification permissions and fail-closed integration behavior remain intact.

### Gate 3 — Regulatory correctness

Applicable statutory baseline and mechanism/methodology references are explicit and versioned.

### Gate 4 — Golden transaction

Urban and Rural can each traverse the authoritative lifecycle without synthetic state.

### Gate 5 — Evidence/provenance honesty

Guardian/Hedera status is displayed from actual integration state. Missing external configuration remains clearly unavailable.

### Gate 6 — External boundary

Government-issued registration/certificate/registry identifiers are stored only when actually issued by the competent external authority.

### Gate 7 — Auditability

An independent reviewer can reconstruct what happened, who acted, what evidence supported it, which rule/methodology was used and which external authority state was confirmed.

## 14. Immediate implementation decision

**Do not add another cosmetic workflow layer next.**

The next engineering increment should convert the current Urban/Rural operating-path panel from a navigation aid into an **authoritative transaction-status surface**, backed by existing APIs, while adding the regulatory applicability gate to the same operating narrative.

The implementation sequence is:

1. preserve current security/auth/geography/device controls;
2. expose authoritative transaction state for a selected activity;
3. show measurement/evidence/verification/MRV/provenance state separately;
4. show statutory applicability and required external action;
5. show value/registry/settlement only when their actual preconditions are met;
6. add tests for forbidden shortcuts and false-positive statuses;
7. deploy only to the canonical `rupaykg` Render service using its existing auto-deploy path.

This is the governing direction for the next implementation cycle.

---

## Source notes

- MoEFCC — Solid Waste Management Rules, 2026: notified 27 January 2026; effective 1 April 2026; supersedes SWM Rules 2016.
- CPCB — Centralised Online SWM Portal: BWG registration/compliance and four-stream segregation implementation.
- BEE — Indian Carbon Market / CCTS: compliance and offset mechanisms; current published offset methodologies.
- CPCB — EPR materials for plastic, e-waste and battery waste management.

This document is a product/engineering control standard, not legal advice and not evidence of regulatory approval or external certification.