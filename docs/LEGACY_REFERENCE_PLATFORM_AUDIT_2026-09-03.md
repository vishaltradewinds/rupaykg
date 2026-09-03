# RupayKG Legacy-Reference Platform Audit — 2026-09-03

## Purpose

This audit applies the agreed legacy-reference approach: `vishaltradewinds/rupaykg-aistudio` is used to recover useful domain requirements, workflow discipline, reconciliation practices and documentation structure, while `vishaltradewinds/rupaykg` `main` remains the only authoritative implementation and production source of truth.

Legacy documentation is evidence of a prior design intent, not evidence that the current platform implements or is approved for the same capability.

## Audit basis

### Current canonical repository

Reviewed against the current `main` branch, including:

- production target and readiness documentation;
- authoritative PostgreSQL schema;
- API authorization and geography controls;
- value routes for carbon, EPR and ESG;
- field-device/offline synchronization controls;
- settlement and registry guardrails;
- current carbon package implementation.

### Legacy reference repository

The following legacy documents were used as requirement/reference inputs:

- `docs/CARBON_OS_INTEGRATION_AUDIT.md` — prior architecture/integration inventory;
- `docs/CARBON_OS_MIGRATION_MATRIX.md` — prior reuse/adapt/replace/new capability mapping;
- `docs/CARBON_OS_RC1_FREEZE.md` — deterministic calculation and immutability discipline;
- `docs/BM_T011_BEE_REFERENCE_EVIDENCE.md` — source-lock, parameter evidence and reconciliation discipline;
- prior BM WA03.001 / BM WA03.002 mathematical and implementation-mapping documents.

The legacy integration audit describes a much less mature architecture with multiple stores, Firebase/JWT authentication, basic waste records, placeholder external integrations and limited testing. It is therefore useful as historical context, but it is not a basis for importing that architecture into the current repository. citeturn74file0

The legacy migration matrix identifies several valuable target concepts: a formal methodology registry, a deterministic calculation engine, dedicated validation/verification workflow, versioned PDD generation, GIS adaptation, AI advisory boundaries, and replacement of basic carbon-value fields with methodology-driven calculations. citeturn75file0

The legacy RC1 freeze adds a stronger reproducibility requirement: methodology formulas should be versioned/immutable, calculations should bind to dataset/formula hashes, and golden/reference fixtures must preserve mathematical reconciliation. citeturn85file0

The legacy BM-T-011 evidence register explicitly distinguishes software integrity from regulatory equivalence and requires source/version evidence, parameter provenance, intermediate calculation trace and independently reconciled reference fixtures before regulatory-equivalent status. citeturn76file0

## Findings

### 1. Core platform architecture — GREEN

The current repository is materially stronger than the legacy architecture for authoritative operations: PostgreSQL is the business-state source of truth, lifecycle state is backend-controlled, organization membership and geography scope are enforced server-side, and the UI is not treated as an authoritative state store. The current readiness matrix records these controls as GREEN. fileciteturn73file0

### 2. MRV/evidence/verification — GREEN

The current model has separate activities, measurements, evidence and verifications, with authorization and geography checks around operational writes. This is aligned with the legacy requirement to evolve the old flat `records`/`mrvStatus` concept into a governed MRV/evidence chain rather than copying the legacy schema. The current readiness matrix records MRV, evidence and verification as GREEN. fileciteturn73file0

### 3. Carbon methodology implementation — AMBER, material implementation gap

The current carbon package is a deterministic generic reduction calculation requiring a methodology code/version, but it returns only aggregate gross/net/uncertainty results and a pending-verification status. fileciteturn78file0

The API correctly requires the methodology version to exist in PostgreSQL before calculation and stores the calculation against that methodology version. However, the current implementation does not yet demonstrate the richer legacy-reference standard of:

`source_version → input_id → normalized_parameter → intermediate_value → equation_id → result → evidence_hash`

nor the RC1-style binding of the calculation to immutable dataset/formula hashes. The current readiness matrix already keeps methodology-specific adapters AMBER for this reason. fileciteturn73file0

**Decision:** do not label the generic calculation as a regulatory methodology implementation. The next implementation increment should add calculation provenance/trace and immutable version binding before any methodology-specific adapter is promoted to production eligibility.

### 4. BM-T-011 / BM WA03.001 / BM WA03.002 — AMBER until independently reconciled

The legacy evidence register is deliberately conservative: it records source verification and equation/parameter evidence, but does not claim end-to-end numerical equivalence without a complete authoritative or independently verified reference fixture. fileciteturn76file0

**Decision:** current RupayKG must preserve this distinction. Legacy numerical examples are test/reference material only and must not be represented as official BEE results, approved methodology output, live pilot results or production certificates without current source/version/applicability and reconciliation evidence.

### 5. Registry / credential lifecycle — GREEN for current internal controls; external trust rail NOT_VERIFIED

The current platform has explicit registry lifecycle controls and database-level high-risk authorization. The readiness matrix records issuance, transfer, retirement and registry auditability as GREEN. External trust rails are intentionally NOT_VERIFIED unless implemented and accepted in the current repository/environment. fileciteturn73file0

The legacy architecture's Hedera Guardian and other external trust integrations must therefore remain reference-only unless independently reintroduced and tested. The historical integration audit lists those integrations, but its own architecture predates the current authoritative PostgreSQL/security model. citeturn74file0

### 6. Settlement — GREEN for internal authoritative gate

Current settlement requires authorization and external settlement evidence before finalization, with database immutability protection for confirmation/reconciliation evidence. This is consistent with the legacy discipline of treating settlement as a governed lifecycle rather than a UI-side status change. The current readiness matrix records settlement finalization and evidence immutability as GREEN. fileciteturn73file0

### 7. Offline field operations — GREEN for current authoritative boundary

The current platform's field-device model requires controlled enrollment/verification and keeps authoritative persistence server-side. This is preferable to importing the legacy local-cache/SQLite/Redis architecture described in the old integration audit. citeturn74file0

### 8. Regulatory source catalog — AMBER

The current catalog is PostgreSQL-backed, but real regulatory/reference data must be provisioned and maintained. This remains a production configuration/data-quality gate rather than something that should be filled with invented or stale legacy data. fileciteturn73file0

### 9. External carbon-market submission — AMBER

The legacy repository described a manual controlled submission adapter alongside an unconnected official API adapter. That is a useful operational pattern, but it does not prove a current external integration exists. Current RupayKG should retain a controlled/manual boundary until an official external interface is actually connected, authenticated, tested and accepted. citeturn76file0

### 10. Production provisioning and runtime acceptance — AMBER

The code/readiness layer is substantially hardened, but actual production identity/role/geography/device provisioning and live runtime acceptance remain gates. The current readiness matrix explicitly requires real-environment acceptance before Cloud Run deployment. fileciteturn73file0

## Implementation priorities derived from the legacy reference

### P0 — Calculation provenance and immutability

Implement in the canonical repository:

1. immutable methodology-version identity suitable for calculation binding;
2. canonicalized calculation input/dataset hash;
3. methodology-rules/formula hash;
4. deterministic calculation trace containing normalized inputs, intermediate values, equation identifiers and result;
5. database guardrails preventing provenance hashes/trace from being silently changed after calculation creation/finalization;
6. tests proving replay/reproducibility and mutation rejection.

This is the highest-value legacy-derived improvement because it strengthens auditability without importing obsolete legacy architecture.

### P1 — Methodology adapter lifecycle

For each methodology actually intended for production, require:

`SOURCE_LOCKED → IMPLEMENTATION_MAPPED → NUMERICALLY_RECONCILED → REGRESSION_VERIFIED → PRODUCTION_ELIGIBLE`

No methodology should become production-eligible merely because its code compiles or unit tests pass.

### P1 — Reference/evidence package

Add current-repository support for an auditable methodology reference package containing source/version, parameter dictionary, applicability decision, calculation trace, evidence hashes and independent reconciliation status. Keep synthetic vectors explicitly non-authoritative.

### P2 — Operational audit package

Use the legacy audit-package concept as a design reference for a current backend-generated audit bundle covering activity, MRV, evidence, verification, value calculation, credential/registry events and settlement evidence. Do not copy legacy claims or external integrations unless implemented and tested.

### P2 — Production regulatory data governance

Define provisioning/refresh expectations for the regulatory source catalog and methodology registry, including source URL, publication/effective dates, version, verification date, jurisdiction and affected module.

### P3 — External integrations

Only after internal authoritative workflows are complete should official external registry, market, trust-rail or physical-instrument integrations be evaluated. Each must have explicit connection state, credentials/configuration, acceptance tests and external confirmation semantics.

## Release rule

The legacy-reference approach is now part of the platform engineering method:

`LEGACY REFERENCE → CURRENT REQUIREMENT → CURRENT IMPLEMENTATION → TEST/PROVENANCE → RUNTIME ACCEPTANCE → PRODUCTION ELIGIBILITY`

A legacy document can identify a requirement or useful design pattern. It cannot by itself establish that the current RupayKG implementation exists, works, is regulatorily approved, or is production-ready.

Cloud Run remains the final deployment gate.
