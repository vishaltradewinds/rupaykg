# RupayKG Legacy AI Studio Domain Reference

## Purpose

This document preserves the useful domain and operational structure from the former `rupaykg-aistudio` repository while keeping the current `vishaltradewinds/rupaykg` repository authoritative for implementation.

The legacy repository contains materially richer operational documentation around Carbon OS, MRV, evidence, regulatory workflow, pilot readiness, deterministic calculations, audit packages and external acceptance. Those concepts are useful design references, but legacy implementation claims are **not automatically current capabilities**.

## Source-of-truth rule

1. `vishaltradewinds/rupaykg` `main` is the only implementation source of truth.
2. `docs/PRODUCTION_TARGET.md` defines the current lifecycle and truth model.
3. This document is a requirements/reference bridge, not a second specification.
4. A legacy feature becomes part of the current product only after it is represented by current schema, API, tests and authoritative state transitions.
5. No legacy mock, synthetic integration, credential, provider claim or production-readiness statement may be copied into the current system without verification.

## Legacy domain model worth retaining

The former AI Studio repository described RupayKG as a circular-economy and environmental MRV operating platform covering:

- real-world waste and biomass activity;
- compliance evidence;
- carbon/CCC workflows;
- stakeholder operations;
- urban ULB and rural Gram Panchayat operations;
- field evidence, GPS and offline workflows;
- ESG and stakeholder reporting;
- regulatory and methodology reference data;
- third-party verification/ACVA workflows;
- deterministic carbon calculations;
- certificate lifecycle management;
- audit/reproducibility packages;
- external trust rails and verifiable credentials as controlled integrations.

The current repository already incorporates the core operating-system version of these concepts through its PostgreSQL-authoritative lifecycle, organization/geography authorization, MRV, evidence, verification, carbon, compliance, registry, settlement and reporting architecture.

## Operational decomposition

### 1. Project / activity intake

A real operational record should establish:

- organization;
- geography/facility/site;
- activity type;
- time period;
- source records;
- measurement requirements;
- evidence requirements;
- applicable methodology or compliance framework;
- responsible actors.

Incomplete operational intake must not silently become value-bearing output.

### 2. MRV data chain

Use the following logical separation:

`RAW/CAPTURED → NORMALIZED → AUTHORITATIVE → VERIFIED → VALUE ELIGIBLE`

Measurements and evidence must retain provenance sufficient to trace the resulting calculation or compliance conclusion back to the underlying activity.

### 3. Evidence

Evidence should preserve:

- capture time;
- actor/device provenance;
- activity relationship;
- measurement relationship where applicable;
- content URI and/or content hash;
- evidence status;
- verification relationship;
- audit history.

Evidence existence alone is not verification.

### 4. Deterministic calculation

Value calculations should be reproducible from a frozen input snapshot and methodology version.

Preferred trace:

`methodology_version → input_snapshot → normalized_parameter → intermediate_value → equation/tool → result → evidence/provenance`

A calculation result must remain distinguishable from a verified or issued environmental credential.

### 5. Verification freeze

Before formal verification, the system should identify the exact dataset, calculation inputs, methodology version and evidence set being reviewed. Changes after a freeze should create a new authoritative version/event rather than silently rewriting the verified record.

### 6. Certification / issuance

Internal calculation or verification must never be presented as an official external certificate. External authority identifiers are required whenever an external registry or authority is the source of official issuance.

### 7. Registry

Registry operations should be append-only/auditable and governed by explicit high-risk authorization. Issuance, transfer and retirement must be separate authoritative events.

### 8. Settlement

A financial workflow is not proof of payment. The current repository therefore requires external settlement reference, external confirmation timestamp and reconciliation evidence before `SETTLED`.

### 9. Audit package / reproducibility

The legacy documentation correctly emphasizes reproducibility. The current implementation should evolve toward exportable audit packages containing the exact authoritative records, methodology/source versions, calculation trace, evidence hashes and audit events required for independent review.

## External integration boundary

The legacy repository documented integrations such as Hedera HCS, W3C Verifiable Credentials, Redis revocation and physical weighbridge connectivity. These are **legacy reference capabilities** only unless the current repository contains and tests the corresponding implementation.

The current repository must prefer:

`IMPLEMENTED + TESTED + CONFIGURED`

over

`DOCUMENTED + ASSUMED`.

External integrations must fail closed when they are required for an authoritative claim.

## Pilot-readiness discipline

The former AI Studio pilot documents used useful readiness categories such as:

- GREEN — implemented and verified;
- AMBER — adapter or external dependency remains;
- RED — critical unresolved issue;
- NOT_IMPLEMENTED — planned but absent.

The current repository should use these categories only when each status is backed by current code/tests/runtime evidence. CI success alone must not be treated as regulatory or external-provider approval.

## Current mapping rule

For every legacy capability considered for migration, record:

| Legacy concept | Current implementation | Evidence required before claiming complete |
|---|---|---|
| Project/activity intake | Activities + organization/geography controls | API integration test |
| MRV measurement | Measurements | API + PostgreSQL test |
| Evidence vault | Evidence + provenance fields | Persistence/authorization test |
| Verification | Verification lifecycle + verifier authorization | Integration test |
| Carbon calculation | Carbon package + value routes | Methodology-specific test |
| Compliance | EPR/compliance routes | Evidence/authorization test |
| ESG reporting | ESG routes | Organization/evidence test |
| Credential lifecycle | Credentials + registry events | DB authorization/audit test |
| Settlement | Settlement lifecycle + external evidence gates | PostgreSQL immutability/integration test |
| Offline field capture | Field devices + sync envelopes | Replay/conflict/geography test |
| External trust rail | Not assumed | Provider implementation + live acceptance |
| Physical instrumentation | Not assumed | Hardware integration + live acceptance |

## Non-negotiable conclusion

The old AI Studio repository is a **domain knowledge and documentation source**, not a competing codebase. Its richer documents should be mined for requirements, acceptance criteria, mathematical reconciliation structure, operational workflows and audit discipline, then re-expressed against the current canonical architecture.