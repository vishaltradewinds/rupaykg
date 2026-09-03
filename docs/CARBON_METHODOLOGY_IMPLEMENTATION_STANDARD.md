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

### Current BM WA03.001 source lock

The Bureau of Energy Efficiency (BEE) currently publishes **BM WA03.001 — Landfill Methane Recovery, Version 1.0**, publication/effective date **27 March 2025**, under the Waste Handling and Disposal sector. The official methodology states that it refers to the latest approved UNFCCC CDM AMS-III.G version and identifies BM-T-001, BM-T-002, BM-T-003, BM-T-004, BM-T-006, BM-T-011 and BM-T-012 as referenced tools/methodologies.

Canonical external source:
`https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf`

The current code records this source reference and version in `BM_WA03001_SOURCE`. A cryptographic source-document hash is deliberately **not** fabricated; production eligibility still requires the source artifact to be captured and hashed through the controlled provisioning/reconciliation process.

## 2. Applicability gate

Before calculation, establish:

`Sector → Activity → Methodology → Applicability → Boundary → Baseline → Monitoring feasibility`

The internal eligibility result is an internal assessment. It must never be represented as regulator approval.

For BM WA03.001, the official source states that the methodology covers capture and combustion of methane from landfills and includes applicability restrictions concerning recycling and deliberate changes intended to increase methane generation. These conditions must be represented as an explicit applicability assessment before production eligibility.

The Carbon package now exposes `evaluateBmWa03001Applicability()`. It is a fail-closed software gate for the explicitly modeled restrictions. It intentionally does not claim to establish additionality, baseline methane potential, monitoring-system acceptance, instrument calibration, or regulatory approval; those remain controlled dependencies/evidence requirements.

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

## 5. BM WA03.001 Equation 4 implementation

The current Carbon package now implements the core annual Equation 4 using independently established inputs:

`ERy,calculated = (FCH4,PJ,y − FCH4,BL,y) × GWPCH4 × (1 − OX) − PEy − LEy`

The implementation is exposed as `calculateBmWa03001()` and emits deterministic intermediate trace steps for methane delta, oxidation adjustment, and project/leakage deduction.

This is an implementation of the core equation only. It does **not** claim to implement or replace the referenced BM-T tools. In particular, BM-T-011 baseline methane-emission-potential calculation, BM-T-004 flaring emissions, BM-T-003 electricity procedures, additionality, monitoring-system acceptance, instrument calibration, or regulatory validation remain explicit dependencies.

The official BEE methodology specifies GWPCH4 = **29.8 tCO2e/tCH4** in its monitoring parameter table and describes monitored landfill-gas flow, methane fraction, temperature and pressure requirements. Those monitored inputs must be evidence-backed in production; they must not be silently fabricated by the calculation package.

## 6. Independent reconciliation

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

The current package contains a deterministic BM WA03.001 Equation 4 regression fixture and applicability-gate tests. These are intentionally treated as software implementation coverage, not as production eligibility evidence.

## 7. Evidence boundary

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

## 8. Verification freeze

When a calculation enters formal verification, freeze the reviewed dataset, calculation inputs, methodology version, evidence set and generated reporting package. A substantive change creates a new version/audit event rather than silently altering the reviewed result.

## 9. Certificate boundary

The platform may calculate, verify and prepare submission material, but an official external certificate/credit must not be claimed solely because an internal state transitioned.

Where an external authority assigns an official identifier, preserve that identifier as external evidence.

## 10. Methodology adapter lifecycle

Use these statuses:

`SOURCE_LOCKED → IMPLEMENTATION_MAPPED → NUMERICALLY_RECONCILED → REGRESSION_VERIFIED → PRODUCTION_ELIGIBLE`

A methodology should not be described as production-reconciled merely because CI passes.

The current BM WA03.001 adapter has reached **IMPLEMENTATION_MAPPED for the core Equation 4 calculation**, with deterministic regression and applicability-gate coverage. It remains below `PRODUCTION_ELIGIBLE` until the dependent tools, complete parameter/evidence mapping, independently captured source hash, monitored evidence chain and independent reconciliation/regression package are all established and verified.

## 11. Legacy BM WA03 references

The old AI Studio repository contains detailed BM WA03.001 and BM WA03.002 documentation. Those files are reference material for methodology discipline.

In particular, the WA03.002 implementation mapping demonstrates the desired structure: exact source/version retention, equation mapping, parameter classes, reusable calculation tools, urban/rural/mixed lineage, deterministic trace and independent acceptance gates.

The current repository should apply that structure to any methodology adapter actually implemented here. Legacy numerical examples must not be copied into production output unless their source, version, inputs and applicability are independently established for the current calculation.

## 12. External submission boundary

Submission adapters must distinguish:

- `NOT_CONNECTED`;
- `MANUAL_CONTROLLED`;
- `CONNECTED_TESTED`;
- `PRODUCTION_CONNECTED`.

No mock external API response may be represented as a real government or registry acceptance.

## 13. Audit package target

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

This document is an implementation standard and current-status record, not a regulatory approval or a claim that every dependency above is already implemented in the current repository.
