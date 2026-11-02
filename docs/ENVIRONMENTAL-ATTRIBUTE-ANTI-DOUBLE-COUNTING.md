# Environmental attribute anti-double-counting control

## Purpose

RupayKG treats physical activity as the root provenance record, but does not assume that one activity can automatically become multiple environmental value claims.

The platform therefore distinguishes:

- **Reporting reference** — may be reused in EPR, carbon and ESG reporting when the respective framework permits it; it does not consume an environmental asset.
- **Value claim** — consumes an explicitly identified environmental-attribute basis and must be traceable to its framework, mechanism, evidence and verification.

The database ledger is `environmental_attribute_claims`.

## Control rule

A `VALUE_CLAIM` must declare a `basis_key`. Two active value claims with different claim types cannot consume the same basis. If a governing framework permits multiple attributes from the same physical activity, RupayKG must represent those as **distinct authorized basis allocations**, rather than silently reusing the same claim basis.

This is intentionally stricter than blocking an activity from appearing in multiple reports. A single verified activity may legitimately support ESG disclosure while also supporting a separate EPR or carbon process; the reporting reference is not itself a credit or environmental asset.

## Framework separation

- **EPR:** certificates and compliance quantities remain tied to the applicable CPCB/SPCB framework and authoritative processor/obligated-entity state.
- **Carbon:** compliance and offset mechanisms remain separate policy pathways. Local calculations are not official Carbon Credit Certificates; eligibility, verification, issuance and registry state remain authority-backed.
- **ESG/BRSR:** reporting metrics are treated as disclosures/references unless an applicable framework explicitly makes them an environmental value claim.
- **Registry:** an issued credential must have a distinct authoritative value basis and provenance; registry status is not inferred from a calculation or report.

## Implementation sequence

1. Record authoritative activity/evidence/verification provenance.
2. Create the explicit environmental-attribute basis allocation.
3. Create the framework-specific value claim against that allocation.
4. Prevent incompatible active value claims from consuming the same basis.
5. Allow ESG/reporting references without consuming the value basis.
6. Carry the allocation/provenance identity into registry, transfer, retirement and settlement records.

The control is deliberately framework-aware: it prevents silent double claiming without preventing legitimate cross-reporting.
