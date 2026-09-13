# RupayKG Carbon Market Mechanism Control Standard

## Purpose

RupayKG treats the **Indian Carbon Market mechanism** as a first-class regulatory control. Carbon activity cannot enter a generic credit workflow without first establishing which statutory or external mechanism governs it.

The current Indian Carbon Market framework has two core pathways published by the Bureau of Energy Efficiency (BEE):

1. **Compliance mechanism — mandatory** for notified obligated entities subject to prescribed GHG emission-intensity targets.
2. **Offset mechanism — voluntary project-based** for eligible non-obligated entities undertaking qualifying GHG reduction, removal or avoidance projects.

Official BEE material describes both mechanisms and the respective compliance/offset procedures. RupayKG therefore keeps their eligibility and issuance pathways separate while sharing common measurement, evidence, MRV, verification and provenance infrastructure.

## Non-negotiable platform rules

### 1. Mechanism before value

Every carbon project, methodology and calculation must identify its mechanism:

`COMPLIANCE | OFFSET | OTHER`

A missing or ambiguous mechanism is a control failure.

### 2. Compliance is not inferred

For `COMPLIANCE`, RupayKG must have authoritative evidence that the entity is a notified/confirmed obligated entity and must bind the applicable target, sector, compliance period and target definition.

Waste activity alone must never create compliance-market eligibility.

### 3. Offset is not automatic

For `OFFSET`, RupayKG must establish project eligibility against the current BEE procedure and the exact approved methodology/version before value calculation can become value-eligible.

A waste transaction alone is not a carbon project and is not automatically a CCC.

### 4. Methodology and mechanism must match

The methodology version is source-locked and carries the same mechanism as the calculation. A compliance calculation cannot silently use an offset methodology, and an offset calculation cannot silently use a compliance methodology.

### 5. MRV is shared, authority is not

The following controls are shared across mechanisms:

`Measurement → Evidence → Provenance → MRV → Independent Verification → Audit Package`

RupayKG may use Hedera Guardian/Hedera provenance for the MRV evidence chain, but blockchain provenance does not itself constitute government approval, verification accreditation or certificate issuance.

### 6. Certificate boundary

The platform may calculate and prepare an auditable value record. It must not represent an internal calculation as an official Carbon Credit Certificate.

Official issuance, registry status, transfer and retirement must retain the competent authority/registry evidence and external identifier where applicable.

## Compliance pathway

```text
Notified obligated entity
        ↓
Applicable sector + compliance period
        ↓
GHG emission-intensity target
        ↓
Monitoring / evidence / MRV
        ↓
Accredited verification process
        ↓
Actual performance vs target
        ↓
Surplus / shortfall
        ↓
Authority-governed CCC issuance / surrender / purchase
        ↓
Registry / transfer / surrender
```

## Offset pathway

```text
Non-obligated project entity
        ↓
Project eligibility
        ↓
Approved methodology + version
        ↓
Baseline / project boundary
        ↓
Monitoring + evidence + MRV
        ↓
Validation / verification as required
        ↓
Quantified GHG reduction / removal / avoidance
        ↓
Eligibility decision
        ↓
Authority-governed CCC issuance
        ↓
Registry / transfer / retirement
```

## Waste-sector control

BEE's published offset material includes waste-handling/disposal methodologies. RupayKG must therefore maintain a **methodology catalogue** and applicability gate rather than a generic waste-to-carbon conversion factor.

The current repository already source-locks BM WA03.001 and treats its implementation as below full production eligibility until all dependent tools, evidence, reconciliation and source-hash controls are established. This mechanism standard extends the same discipline to the market pathway itself.

## Relationship to EPR and ESG

Carbon value must remain a distinct environmental attribute from:

- Plastic EPR certificates;
- other EPR credits;
- waste-processing records;
- ESG/BRSR metrics;
- regulatory registrations;
- financial settlement records.

One physical activity can support multiple reporting or compliance processes only where each applicable framework independently permits it and the platform can preserve allocation, ownership, provenance and anti-double-counting controls.

## Regulatory watch

The mechanism catalogue is versioned through the regulatory source catalogue. Changes published by BEE, MoEFCC, CPCB, SEBI or another competent authority must be reconciled into the relevant regulatory source, methodology and applicability records before production behavior is changed.

This document is an implementation/control standard. It is not itself regulatory approval, legal advice or evidence that a particular organization/project is eligible for issuance.
