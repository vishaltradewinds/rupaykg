# RupayKG Carbon Methodology Implementation Standard

## Purpose

The former AI Studio Carbon OS documentation provides a useful standard for methodology-specific implementation: source locking, parameter dictionaries, deterministic equations, intermediate reconciliation, provenance hashing, verification freeze and explicit external-submission boundaries.

This standard brings those practices into the current repository without importing unsupported legacy code or claims.

## 1. Methodology source lock

Every production carbon methodology implementation must record:

- authority/publisher;
- exact methodology code;
- exact version/revision;
- effective date where applicable;
- source document/reference;
- evidence/source hash;
- implementation status.

A calculation must not silently substitute a newer or older methodology version.

## 2. Applicability gate

Before calculation, establish:

`Sector → Activity → Methodology → Applicability → Boundary → Baseline → Monitoring feasibility`

The internal eligibility result is an internal assessment. It must never be represented as regulator approval.

## 3. Parameter dictionary

Every calculation input should have:

| Field | Requirement |
|---|---|
| Parameter code | Stable identifier |
| Meaning | Human-readable definition |
| Value | Normalized numeric/value representation |
| Unit | Explicit unit |
| Source | Measurement/evidence/reference source |
| Methodology version | Exact source lock |
| Time period | Applicable monitoring period |
| Quality/provenance | Evidence and validation information |

No unapproved default may be introduced merely to make a calculation complete.

## 4. Deterministic calculation trace

A methodology implementation should produce a trace equivalent to:

`source_version → input_id → normalized_parameter → intermediate_value → equation_id → result → evidence_hash`

The same frozen input snapshot and methodology version must produce the same result.

## 5. Independent reconciliation

For each production methodology, maintain at least one independently reviewable reference calculation containing:

1. equation definitions;
2. input dataset;
3. units and conversions;
4. intermediate calculations;
5. final result;
6. rounding rules;
7. source/reference provenance;
8. expected output;
9. regression test linkage.

A reference case proves numerical reproducibility only. It does not prove regulator acceptance or external certification.

## 6. Evidence boundary

Required evidence must exist before a result can become value-eligible. Evidence quality should cover, where applicable:

- completeness;
- continuity;
- unit validity;
- duplicate detection;
- outlier handling;
- instrument/calibration provenance;
- source record lineage;
- timestamp and monitoring-period integrity.

Missing mandatory evidence must fail closed.

## 7. Verification freeze

When a calculation enters formal verification, freeze the reviewed dataset, calculation inputs, methodology version, evidence set and generated reporting package. A substantive change creates a new version/audit event rather than silently altering the reviewed result.

## 8. Certificate boundary

The platform may calculate, verify and prepare submission material, but an official external certificate/credit must not be claimed solely because an internal state transitioned.

Where an external authority assigns an official identifier, preserve that identifier as external evidence.

## 9. Methodology adapter lifecycle

Use these statuses:

`SOURCE_LOCKED → IMPLEMENTATION_MAPPED → NUMERICALLY_RECONCILED → REGRESSION_VERIFIED → PRODUCTION_ELIGIBLE`

A methodology should not be described as production-reconciled merely because CI passes.

## 10. Legacy BM WA03 references

The old AI Studio repository contains detailed BM WA03.001 and BM WA03.002 documentation. Those files are reference material for methodology discipline.

In particular, the WA03.002 implementation mapping demonstrates the desired structure: exact source/version retention, equation mapping, parameter classes, reusable calculation tools, urban/rural/mixed lineage, deterministic trace and independent acceptance gates.

The current repository should apply that structure to any methodology adapter actually implemented here. Legacy numerical examples must not be copied into production output unless their source, version, inputs and applicability are independently established for the current calculation.

## 11. External submission boundary

Submission adapters must distinguish:

- `NOT_CONNECTED`;
- `MANUAL_CONTROLLED`;
- `CONNECTED_TESTED`;
- `PRODUCTION_CONNECTED`.

No mock external API response may be represented as a real government or registry acceptance.

## 12. Audit package target

For an independently reviewable calculation, the eventual audit package should contain:

- project/activity identifiers;
- methodology source/version;
- input snapshot;
- normalized parameters;
- intermediate trace;
- final calculation;
- evidence identifiers/hashes;
- verification records;
- relevant registry/submission references;
- generation timestamp/version;
- integrity manifest/hash.

This document is an implementation standard, not a claim that every item above is already implemented in the current repository.