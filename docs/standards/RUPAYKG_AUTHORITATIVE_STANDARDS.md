# RupayKg Authoritative Standards & Control Register

**Status:** AUTHORITATIVE REPOSITORY CONTROL DOCUMENT  
**Repository:** `vishaltradewinds/rupaykg`  
**Controlled branch:** `cto/20261107-protected-migration-ci`  
**Effective date:** 2026-11-08

## 1. Purpose

This document is the single authoritative index and governance map for RupayKg standards, regulatory controls, engineering controls, evidence gates, acceptance gates and production gates.

It establishes which repository documents govern which decisions and prevents distributed documentation from being mistaken for a single undifferentiated set of "certified standards".

The governing principle is:

> **ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**

RupayKg is a commercial innovation platform that uses open digital infrastructure, open-source software, open standards and external reference ecosystems. It does not become a Digital Public Good (DPG) or Digital Public Infrastructure (DPI) merely by using those ecosystems.

## 2. Authority hierarchy

The repository shall interpret its controls in this order:

1. **Applicable Indian law, statutory rules and competent-authority directions**
2. **Applicable official regulatory methodologies, procedures and registers**
3. **RupayKg Shakti Standards**
4. **Project/domain implementation standards and regulatory controls**
5. **Security, data, MRV, evidence and provenance controls**
6. **Acceptance and verification gates**
7. **Production/cutover gates**
8. **Specifications, proposals and reference architectures**
9. **External reference ecosystems and implementation patterns**

Lower layers cannot override a higher layer.

External ecosystems are reference inputs, not substitute authorities.

## 3. Mandatory Shakti Standard

### 3.1 Open-source and ecosystem control

**File:** `docs/standards/SHAKTI_OPEN_SOURCE_ECOSYSTEM_CONTROL.md`

**Class:** Mandatory Shakti engineering control.

It governs controlled use of:

- Digital Public Goods Alliance / DPG Standard
- UN Innovation Network
- FAIR Forward / BMZ
- Global DPI Repository
- relevant Indian DPI/open-source ecosystems
- RISC-V and Indian open processor ecosystems, including SHAKTI where technically appropriate

Required evidence includes component/version, source, license, provenance, maintainer health, security status, dependency graph, privacy implications, interoperability, edge suitability, Indian regulatory suitability, support/exit strategy, production evidence and replacement path.

Open source is not equated with secure; DPG is not equated with DPI; open hardware is not equated with certified hardware.

The DPGA DPG Standard is used as a reference assessment framework; its own indicators include SDG relevance, open licensing, ownership, platform independence, documentation, data extraction, privacy/applicable laws, standards/best practices and safety/security. citeturn755621search0turn755621search10

## 4. Domain and regulatory implementation standards

### 4.1 Carbon methodology implementation

**File:** `docs/CARBON_METHODOLOGY_IMPLEMENTATION_STANDARD.md`

**Class:** Domain implementation standard.

Controls methodology source locking, applicability, parameter dictionaries, deterministic calculation traces, independent reconciliation, evidence boundaries, verification freeze, certificate boundaries and methodology lifecycle:

`SOURCE_LOCKED → IMPLEMENTATION_MAPPED → NUMERICALLY_RECONCILED → REGRESSION_VERIFIED → PRODUCTION_ELIGIBLE`

It explicitly prevents software calculation completion from being represented as regulatory approval.

### 4.2 Carbon market mechanism

**File:** `docs/CARBON-MARKET-MECHANISM-CONTROL.md`

**Class:** Regulatory/domain control standard.

Controls separation of:

- compliance mechanism
- offset mechanism
- other mechanisms

Mechanism must be established before carbon value enters the workflow. EPR, ESG, waste records and carbon attributes remain distinct unless each applicable framework independently permits linkage and anti-double-counting/provenance controls are satisfied.

### 4.3 CCTS methodology registry

**File:** `docs/CCTS_METHODOLOGY_REGISTRY_FOUNDATION.md`

**Class:** Regulatory registry foundation.

The registry records official methodology/tool listings separately from project applicability, adapter implementation, validation/verification and certificate issuance.

Default status is deliberately `REGISTRY_ONLY` until project-specific applicability and calculation evidence are established.

### 4.4 CPCB SWM 2026 MRV mapping

**File:** `docs/CPCB_SWMP_2026_MRV_MAPPING.md`

**Class:** Regulatory mapping/design control.

This is an architecture/design proposal and MRV mapping. It is not itself implementation, legal opinion, portal integration or certification.

## 5. MRV, evidence and value controls

### 5.1 Carbon certificate issuance evidence gate

**File:** `docs/CCC_ISSUANCE_EVIDENCE_GATE.md`

**Class:** Value/issuance evidence gate.

Internal calculation or review state cannot be represented as an officially issued Carbon Credit Certificate. Calculated results remain pending the required verification/authority evidence.

### 5.2 Golden transaction acceptance gate

**File:** `docs/GOLDEN-TRANSACTION-ACCEPTANCE-GATE-2026.md`

**Class:** End-to-end operational acceptance gate.

Defines the minimum evidence required before an Urban/Rural transaction can be claimed as operationally proven.

### 5.3 MRV Evidence Vault

**File:** `docs/MRV_EVIDENCE_VAULT.md`

**Class:** Evidence engineering gate.

Controls organization-scoped evidence records, provenance and operational activity linkage. It does not replace the canonical waste/resource-flow ledger.

Current document status must be interpreted as engineering implementation subject to production approval gates.

## 6. Security and platform controls

### 6.1 Security requirements

**File:** `docs/SECURITY.md`

**Class:** Core security control.

Covers authentication/session controls, organization/geography-scoped authorization, high-risk permissions and prohibition of unsafe production defaults such as bundled production passwords or private keys.

### 6.2 Platform core objectives and regulatory alignment

**File:** `docs/PLATFORM-CORE-OBJECTIVES-AND-REGULATORY-ALIGNMENT-2026.md`

**Class:** Platform governance/control baseline.

Defines the platform objective around trusted environmental resource flows, measurement/evidence lineage, controlled MRV/verification and eligible outcomes.

## 7. Shakti production and runtime gates

### 7.1 Shakti production gate

**File:** `docs/SHAKTI_PRODUCTION_GATE_RUPAYKG.md`

**Class:** Production control gate.

Production treatment requires applicable Shakti gates to be satisfied. Shakti certification, where applicable, does not replace independent statutory, regulatory, contractual, infrastructure or third-party approvals.

### 7.2 Production runtime cutover gate

**File:** `docs/SHAKTI_PRODUCTION_RUNTIME_CUTOVER_GATE.md`

**Class:** Live deployment/cutover gate.

Controls evidence required for production runtime cutover, including the authoritative production service and runtime acceptance boundaries.

### 7.3 RLS activation gate

**File:** `docs/SHAKTI_RLS_ACTIVATION_GATE.md`

**Class:** Database security activation gate.

Production tenant RLS activation is conditional on runtime-role separation and proof that the application runtime does not operate as the database owner, superuser or BYPASSRLS role.

This gate is an activation artifact, not evidence that production RLS has already been activated.

### 7.4 Production readiness matrix

**File:** `docs/PRODUCTION_READINESS_MATRIX.md`

**Class:** Readiness control and evidence register.

Uses:

- GREEN = implemented/current repository evidence
- AMBER = implemented/structurally supported but external/config/runtime gate remains
- RED = critical blocker
- NOT_IMPLEMENTED = absent/not verified

The matrix must never be used to convert engineering evidence into regulatory approval or TRL 9.

## 8. Methodology-specific implementation specifications

### 8.1 WA03.001 Guardian policy specification

**File:** `docs/WA03_001_GUARDIAN_POLICY_SPEC.md`

**Class:** BUILD SPECIFICATION — NOT YET PUBLISHED.

Controlling authority is BEE BM WA03.001 v1.0. Guardian examples are implementation references only.

The specification requires real Guardian publication, real execution evidence, real Hedera consensus/provenance evidence and independent acceptance before production eligibility.

### 8.2 WA03.001 Guardian methodology map

**File:** `docs/WA03_001_GUARDIAN_METHODOLOGY_MAP.md`

**Class:** Methodology interoperability/implementation map.

It maps WA03.001 to its explicit methodological lineage, companion methodology and referenced BEE tools while preventing substitution by non-Indian methodologies.

## 9. Document classes — do not collapse them

The repository uses the following controlled classes:

| Class | Meaning |
|---|---|
| **Shakti Standard** | Mandatory cross-lifecycle engineering/governance rule |
| **Regulatory/domain standard** | Implementation control derived from an applicable regulatory/domain framework |
| **Engineering control** | Technical rule governing implementation/security/architecture |
| **Evidence gate** | Minimum evidence required for a state transition or claim |
| **Acceptance gate** | Test/field/operational evidence required to declare a capability proven |
| **Production gate** | Conditions required before live production treatment |
| **Specification** | Build target or design contract; not evidence that the target exists |
| **Mapping/reference** | Traceability or interoperability aid; not itself approval |

A document must not be promoted from specification to proven capability merely because code exists.

## 10. Mandatory lifecycle

All RupayKg project work shall be governed through:

**Discovery → Evidence → Statutory/regulatory boundary → Feasibility → Validation → Architecture → Component selection → Engineering → Security → Integration → Verification → Field validation → Approval/certification where applicable → Live deployment → Operation → Measurement → Continuous assurance**

Every material claim must identify its evidence state.

## 11. Evidence-state rule

RupayKg shall distinguish at minimum:

- **Designed** — documented target architecture/control.
- **Implemented** — code/configuration exists.
- **Tested** — controlled test evidence exists.
- **Verified** — defined verification evidence exists.
- **Field validated** — real-world site evidence exists.
- **Operationally accepted** — target operational acceptance criteria are met.
- **Regulator/authority accepted** — competent authority evidence exists.
- **Production approved** — required internal/external production gates are satisfied.
- **TRL 9** — only after the complete applicable TRL evidence package demonstrates actual operational deployment and sustained use.

No lower state may be represented as a higher state.

## 12. Production safety rule

Production remains **READ-ONLY / HOLD** whenever a required security, database, external-integration, field, regulatory or runtime acceptance gate is unresolved.

In particular:

- no production database mutation merely to make a test pass;
- no bypass of RLS or tenant isolation;
- no synthetic external registry/Guardian/Hedera response represented as real;
- no fabricated calibration/certification evidence;
- no unpinned production dependency;
- no unsupported hardware certification claim;
- no claim of TRL 9 from software completion alone.

## 13. Repository governance

This document is the authoritative register.

The individual documents listed above remain the detailed evidence/control records for their respective domains. They are not deleted merely because this register consolidates governance.

Where two repository documents appear to conflict:

1. apply the authority hierarchy in Section 2;
2. prefer the newer controlled evidence where authority is equal;
3. preserve the conflict as an explicit reconciliation issue;
4. do not silently choose the interpretation that produces the stronger readiness claim;
5. update this authoritative register and the affected source document through a controlled commit.

## 14. Change control

Any new standard/control/gate must:

1. declare its class;
2. declare its authority/source;
3. declare its scope;
4. define required evidence;
5. define prohibited claims/shortcuts;
6. define its lifecycle position;
7. identify dependencies and supersession relationships;
8. be indexed in this document.

Any retired or superseded document must remain traceable through repository history; its old status must not be reused as current evidence.

## 15. Current authoritative interpretation

The repository currently has **one formal Shakti Standard under `docs/standards/`**:

`SHAKTI_OPEN_SOURCE_ECOSYSTEM_CONTROL.md`

The other listed documents are subordinate domain standards, controls, gates, specifications or mappings governed by this register.

Therefore, the phrase **"RupayKg standards"** shall mean the controlled system represented by this document and its indexed subordinate records—not a claim that every listed document is a certified external standard.

## 16. Final governing rule

**ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**

Open ecosystems provide reusable technology, standards and implementation knowledge.

Indian statutory/regulatory authorities provide applicable legal authority.

RupayKg Shakti Standards provide the engineering governance layer.

Evidence gates determine what can be claimed.

Production gates determine what can go live.

Field and external evidence determine what is actually proven.

No layer may be skipped.
