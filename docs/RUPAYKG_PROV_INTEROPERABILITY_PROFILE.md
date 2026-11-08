# RupayKg W3C PROV Interoperability Profile

## Status

**Engineering status: PARTIAL — deterministic PROV-compatible export mapping implemented.**

RupayKg retains its existing authoritative evidence, MRV and calculation provenance. This profile adds an interoperability representation using the W3C PROV concepts of Entity, Activity and Agent and relations such as `used`, `wasGeneratedBy`, `wasDerivedFrom`, `wasAssociatedWith` and `wasAttributedTo`.

## Canonical lineage

`Raw Evidence → Activity → Observation → Validation/Verification → Calculation → Claim/Report → Registry Event`

The PROV representation is an interoperability view of that lineage. It is not a second source of truth and must not be used to overwrite authoritative RupayKg records.

## Implementation

`apps/src/prov-interoperability.ts` provides deterministic mapping from existing RupayKg identifiers to PROV identifiers under the `rupaykg:` namespace.

The mapper does not invent optional observations, calculations, verifications or identities when the source record does not contain them.

## Acceptance boundary

A production interoperability claim still requires:

1. mapping coverage for every authoritative provenance path intended for export;
2. conformance tests against the target PROV serialization/profile;
3. round-trip or semantic-equivalence tests where import is supported;
4. field/production evidence for the consuming system;
5. privacy and tenant-boundary validation before external export.

Therefore this control remains **PARTIAL** until an actual consuming integration is validated.

**Shakti rule:** reuse the existing provenance system; expose interoperable views; never create a competing provenance authority.
