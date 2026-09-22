# RupayKg Methodology Interoperability Map — WA03.001 Guardian Policy

## Authority hierarchy

1. **Primary regulatory methodology:** BEE BM WA03.001 — Landfill Methane Recovery, Version 1.0, published 27 March 2025.
2. **Referenced methodological lineage:** UNFCCC CDM AMS-III.G — Landfill methane recovery. BM WA03.001 explicitly references the latest approved AMS-III.G version; current UNFCCC source lists Version 10.0 as active.
3. **BEE companion methodology:** BM WA03.002 — Flaring or use of landfill gas. Use only for activity pathways explicitly covered by WA03.002; it must not replace WA03.001's recovery methodology.
4. **BEE referenced tools:** BM-T-001, BM-T-002, BM-T-003, BM-T-004, BM-T-006, BM-T-011 and BM-T-012, as identified by BM WA03.001. Each tool remains a separate evidence/calculation dependency.
5. **Guardian methodology examples:** Guardian's US Landfill/CAR and other landfill/waste policies are implementation-pattern references only. They are not treated as Indian regulatory methodology authority.

## Policy architecture

The Guardian policy should therefore be a **WA03.001 policy with modular tool/reference gates**, not a copy of another methodology.

### Core gates

- Applicability and project boundary
- Baseline determination
- Monitoring-period and evidence integrity
- Methane recovery measurement
- Baseline methane calculation dependency (BM-T-011)
- Oxidation treatment
- Project emissions
- Leakage
- Deterministic Equation 4 calculation
- Independent verification freeze
- Provenance and external-submission boundary

### Equation 4

`ERy,calculated = (FCH4,PJ,y - FCH4,BL,y) × GWPCH4 × (1 - OX) - PEy - LEy`

The current RupayKg implementation records GWPCH4 = 29.8 tCO2e/tCH4. The Guardian workflow must consume evidence-backed values rather than create defaults.

## Cross-methodology rule

Relevant methodologies can strengthen implementation **only where their scope and version are explicitly compatible**. No methodology may silently substitute for BM WA03.001.

Examples:

- AMS-III.G → methodological lineage/reference for landfill methane recovery.
- BM WA03.002 → separate pathway for flaring/use of landfill gas where applicable.
- BM-T tools → parameter-specific calculation/evidence dependencies.
- CAR US Landfill → Guardian workflow design/reference only.

## Status

This map is an implementation architecture, not regulatory approval. The resulting Guardian policy must remain `IMPLEMENTATION_MAPPED` until complete evidence, dependent tools, independent reconciliation and controlled publication are verified.
