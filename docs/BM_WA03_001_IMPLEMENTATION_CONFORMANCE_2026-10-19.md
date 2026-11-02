# BM WA03.001 Implementation Conformance Matrix — 2026-10-19

## Authority and scope

Controlling methodology: Bureau of Energy Efficiency, *BM WA03.001 — Landfill Methane Recovery*, Version 1.0, published 27 March 2025.
Official source: https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf

This matrix records software implementation evidence and gaps. It is not project eligibility approval, ACVA validation, BEE approval, or evidence of issued Carbon Credit Certificates.

## Verified code changes in this working tree

- Added a version-pinned official methane GWP constant of 29.8 tCO2e/tCH4 for BM WA03.001 v1.0. Inputs with other values fail closed pending an approved methodology revision.
- Corrected the human-readable Equation 4 definition to: ERy,calculated = (FCH4,PJ,y - FCH4,BL,y) * GWPCH4 * (1 - OX) - PEy - LEy.
- Added an Equation 5 flow-and-composition calculator. It requires non-empty, unique measurement-period IDs; finite non-negative LFG volume; methane volume fraction in [0,1]; positive methane density; consistent dry/same-humidity basis; flow-meter and methane-analyser IDs; calibration evidence references for both; and a valid timestamp. It returns period-level traces and remains CALCULATED_PENDING_VERIFICATION.
- Added a source-versioned monitoring parameter dictionary for PEpower,y, PEflare,y, PEprocess,y, LFGi,y, wCH4,y, T, P, EGy, EEy and GWPCH4.
- Added the official WA03.001 tool dependency list: BM-T-001, BM-T-002, BM-T-003, BM-T-004, BM-T-006, BM-T-011, BM-T-012.
- Added positive and negative-path tests for Equation 5, evidence requirements, official tool dependencies, parameter coverage, and GWP pinning.

## Official parameter and tool mapping

| Official item | Requirement from BEE v1.0 | RupayKg code status |
|---|---|---|
| Equation 4 | (FCH4,PJ,y - FCH4,BL,y) * GWPCH4 * (1 - OX) - PEy - LEy | Implemented as deterministic calculation; pending external validation |
| Equation 5 | FCH4,PJ,y = sum_i DCH4,y * wCH4,y * LFGi,y | Flow/composition aggregation added; density value and measurement records still require evidence/condition validation |
| Equation 6 alternative | Electricity-generation pathway under paragraph 19 | Not implemented by the new flow calculator; keep energy pathway unresolved until separately implemented and validated |
| BM-T-001 | Baseline scenario/additionality when BM-T-012 shortcut is unavailable | Dependency recorded; execution not demonstrated |
| BM-T-002 | Fossil-fuel project/leakage emissions | Dependency recorded; execution not demonstrated |
| BM-T-003 | Electricity consumption/generation | Dependency recorded; execution not demonstrated |
| BM-T-004 | Flare emissions | Dependency recorded; execution not demonstrated |
| BM-T-006 | Baseline thermal/electricity efficiency where applicable | Dependency recorded; execution not demonstrated |
| BM-T-011 | Solid waste disposal site methane emission potential; methodology-specific settings apply | Dependency recorded; full inputs, output, version and evidence lineage not demonstrated |
| BM-T-012 | Positive list of technologies | Dependency recorded; current approved list and applicability evidence not demonstrated |

## Monitoring controls to retain

- Flow volume is continuous, with accumulated volume records; retain instrument identity, calibration, timestamp, raw source evidence and reference conditions.
- Methane fraction must be directly measured by an appropriate methane analyser; inferring it from CO2 or other constituents is not permitted. Continuous measurement is preferred/required per the methodology's stated route, or periodic measurement must meet the stated 90/10 confidence/precision level.
- Flow volume and methane composition must share a humidity basis (dry or same/known/corrected humidity).
- Temperature and pressure are required near the flow measurement point when the meter does not provide normalized flow using those measurements.
- Electricity generation and equipment efficiency are conditional inputs for the paragraph 19 power-generation alternative. That pathway must not be silently mixed with the flow/composition pathway.
- Project emissions must distinguish power/fuel, flaring/combustion, and upgrading/process emissions where applicable.
- Calculation outputs remain provisional until baseline, measurement, calibration, source lineage, uncertainty/confidence treatment, and verifier review are evidenced.

## Remaining Guardian bundle blockers

The repaired Guardian policy ZIP is a local structural candidate only. It is not ready for publication:
1. Its top-level tools list remains empty even though RupayKg code now records the seven official dependencies.
2. Its monitoring schema still accepts aggregate values and does not yet model the complete official parameter paths with evidence metadata.
3. The calculation block has an unresolved cross-schema binding for fch4BL from the baseline form.
4. Conditional branch logic is needed to select the flow/composition path versus electricity-generation alternative.
5. Fail-closed validation/rejection, evidence lineage, independent verifier approval/signature and final provenance transition blocks need implementation and Guardian validation.
6. An authorized Guardian session is still required to import the candidate, validate it, run Dry Run and preserve the resulting evidence. No import/publication was performed by this code change.

## Validation record

- Carbon workspace TypeScript build: passed.
- Carbon workspace tests: 26 passed, 0 failed, 0 skipped.
- Root build: running at the time this record was written; check final process output before treating it as passed.
- No production deployment, database migration, Guardian import/publication, Hedera submission or CCC issuance was performed.


## Follow-up implementation increment — 2026-10-19

The code now also requires raw flow-measurement evidence and raw methane-measurement evidence per period, in addition to flow-meter and methane-analyser calibration evidence. Each Equation 5 trace carries all four evidence references. The flow calculator still does not infer the methane density from temperature/pressure; the density and its reference conditions must be supplied from validated measurement/calculation evidence. The electricity-generation alternative remains intentionally unimplemented and must fail closed rather than silently approximate it.

Latest carbon workspace result after these changes: TypeScript build passed; 26 tests passed, 0 failed, 0 skipped. Root build and root workspace test rerun were in progress during the checkpoint update; their final output must be checked before claiming completion.


### Evidence hashing extension

Each Equation 5 period now also receives deterministic SHA-256 hashes for its normalized input record and calculated result. The aggregated output includes hashes for the complete period input set and result payload. These hashes support integrity checks but do not replace a controlled evidence vault, signed measurement sources, or persistent provenance. Carbon workspace build and tests still pass: 26/26.
