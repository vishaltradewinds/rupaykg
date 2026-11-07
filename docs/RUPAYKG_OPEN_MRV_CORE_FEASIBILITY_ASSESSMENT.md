# RupayKg Open MRV Core — Feasibility and DPG Eligibility Assessment

**Assessment date:** 2026-11-07  
**Repository assessed:** vishaltradewinds/rupaykg  
**Branch assessed:** main  
**Assessment commit:** 3e2643e4ed1e0232f214c80223ddf1d1bb2aca46  
**Decision:** GO for scoped discovery and extraction design; NO-GO for public release or DPGA nomination

## 1. Executive decision

RupayKg has useful modular TypeScript domain and carbon workspaces from which a reusable MRV component may be designed. The current repository does **not** establish that these packages are open source or independently eligible for DPG recognition.

Repository evidence establishes that:

- no root LICENSE, COPYING or equivalent open-licence file is present in the inspected repository tree;
- the root package.json declares private true;
- packages/domain/package.json and packages/carbon/package.json also declare private true;
- the carbon package contains both generic calculation primitives and BEE methodology-specific implementation/screening logic;
- the domain package contains CCTS methodology registry snapshot content and platform-domain types;
- production platform documentation describes identity, tenant/geography, database, deployment and provider configuration that must not be copied wholesale into an open library.

A public GitHub repository or source-visible package does not by itself grant reuse rights. Do not add an open-source licence or publish extracted code until ownership, contributor rights and dependency compatibility are established.

## 2. Candidate definition

**Open MRV Core** is a proposed, separately bounded, reusable software component and specification set for describing and exchanging environmental activity, measurement, evidence references, verification decisions and reproducible calculation traces.

Its purpose is to provide neutral, interoperable digital building blocks that different waste, biomass, circular-economy and environmental measurement systems can use.

This is a proposal. No standalone package, independently released product, DPG recognition or DPGA review is claimed to exist.

### 2.1 Initial candidate scope

The first release should be limited to portable, sector-neutral building blocks:

1. **Activity contract** — activity type, time interval, place reference, actor/organisation reference and resource relationship using opaque identifiers.
2. **Resource-flow contract** — origin/destination references, material/resource code, quantity and unit, transfer relationship and chain-of-custody link.
3. **Measurement contract** — measured quantity, unit, method/reference, time, instrument/source reference, quality state and uncertainty where applicable.
4. **Evidence reference contract** — evidence type, content hash, media type, capture time, issuer/source reference and version relationship; no hosted evidence vault or user data.
5. **Verification reference contract** — verifier reference, scope, decision, rationale reference, date and evidence-set version; no self-approval or authority impersonation.
6. **Methodology reference contract** — methodology identifier, publisher, version, source URI, effective period and applicability status; no unreviewed statutory formula catalogue.
7. **Calculation trace contract** — normalized input references, parameter/unit definitions, equation identifiers, intermediate values, rounding rules, output and reproducibility hashes.
8. **Provenance event contract** — append-only event envelope, actor/system reference, correlation/idempotency reference and integrity hash.
9. **Interchange specifications** — versioned JSON Schema and documented JSON/CSV import/export mappings, with compatibility and validation fixtures.

The first package should be deterministic and side-effect free. It should not require a database, web framework, cloud account, blockchain provider, AI service or commercial platform subscription.

## 3. Explicit exclusions from the Open MRV Core boundary

The following remain outside the first open-core candidate unless separately evaluated and approved:

- tenant-specific records, personal data, contact details, credentials, session tokens, organisation membership and production datasets;
- RupayKg commercial UI, dashboards, sales, billing, managed services, proprietary workflow orchestration and enterprise customer-specific logic;
- production database schema, migrations, credentials, access policies and control-plane services;
- Firebase, Render, Neon or other provider-specific hosting/authentication implementation;
- Hedera, Guardian, W3C VC issuer keys and external trust-provider adapters;
- CPCB, BEE, CCTS, EPR or other statutory/regulatory text and methodology-specific formula/tool content until rights, authoritative source/version, applicability and technical validation are separately established;
- carbon-credit issuance, official certificates, regulator acceptance, ACVA verification and settlement claims;
- production evidence file bytes and the current PostgreSQL evidence-vault implementation.

The open library must never imply that a schema, trace, hash, calculation or internal verification creates statutory status, official carbon credits or regulator-issued certificates.

## 4. Repository evidence and boundary analysis

### 4.1 Existing workspaces

| Repository item | Observed evidence | Assessment |
|---|---|---|
| Root package | npm workspaces; private true; no root licence found | Not currently an open package |
| packages/domain | TypeScript package; private true; exports lifecycle, regulatory, resource-flow, geography, field-operation and CCTS modules | Useful source material, but broad platform domain and regulatory data are mixed |
| packages/carbon | TypeScript package; private true; exports calculation and market-mechanism code | Useful source material, but not safe to publish wholesale |
| packages/carbon/src/index.ts | Uses Node node:crypto; contains generic baseline/project arithmetic and BM WA03.001 calculation/applicability logic; calculation state remains pending verification | Requires split between neutral primitives and methodology-specific implementation |
| packages/domain/src/ccts-methodologies.ts | Contains a BEE methodology/tool registry snapshot, source URLs, dates and REGISTRY_ONLY status | Keep out of initial generic core until content/source rights and update process are reviewed |
| docs/MRV.md | Defines Activity → Measurement → Evidence → Verification → Calculation → Credential chain | Useful design reference; not proof of an independently releasable package |
| docs/MRV_EVIDENCE_VAULT.md | Current evidence file store has bounded PostgreSQL implementation and explicit production limitations | Keep production storage and user evidence out of the open core |
| docs/PRODUCTION_TARGET.md | Describes production identity, organisation/geography, provider, trust-rail and deployment boundaries | The commercial production app is not the candidate product |

### 4.2 Legal and licensing blockers

1. No explicit approved open licence was found at the repository root.
2. The root, domain and carbon package manifests are marked private.
3. No standalone ownership and stewardship statement for Open MRV Core is present.
4. No complete contributor-rights and third-party dependency licence report was included in this assessment.
5. No approved decision exists to license any portion of the existing commercial repository for public reuse.

**Result: Open-licensing indicator is BLOCKED; ownership indicator is NOT ASSESSED.**

Do not infer that repository administrator access proves complete intellectual-property title or contributor rights.

### 4.3 Technical feasibility

The current separation into TypeScript workspaces is a favourable starting point for extraction, but package boundaries alone do not prove that a component is independent.

Before extraction, determine:

- whether all candidate source is pure domain logic or reaches into platform-specific modules;
- which imports and runtime APIs are required;
- whether the Node crypto dependency should become a portable interface or remain a supported runtime adapter;
- whether code and source data can be separated cleanly;
- whether deterministic canonicalization and hashes have stable cross-runtime test vectors;
- whether the candidate can build, test and run from a clean checkout without accessing RupayKg production infrastructure.

Technical feasibility: **PROMISING, NOT YET PROVEN**.

## 5. Proposed target architecture

The future candidate should have an explicit boundary similar to:

- schemas: activity, resource-flow, measurement, evidence-reference, verification-reference, methodology-reference, calculation-trace, provenance-event;
- packages: contracts, validation, canonicalization, trace, interchange;
- fixtures: valid, invalid, round-trip, deterministic-hash;
- documentation: architecture, data dictionary, API, security, privacy and deployment;
- governance: licence, ownership, contribution and security policy.

This is a target design, not an existing repository tree. Do not create a second production deployment or migrate current production data as part of this work.

## 6. DPG Standard preliminary evidence matrix

| DPGA indicator | Current candidate status | Required next evidence |
|---|---|---|
| 1. SDG relevance | PARTIAL | Select evidence-backed SDG outcome(s), baseline and impact measures |
| 2. Open licensing | BLOCKED | Rights-holder decision, contributor/IP review, approved licence and notices |
| 3. Clear ownership | NOT ASSESSED | Steward, owner, copyright and contribution-rights records |
| 4. Platform independence | NOT ASSESSED | Full dependency inventory and standalone operation proof |
| 5. Documentation | PARTIAL | Public developer, user, API, deployment, versioning and maintenance docs |
| 6. Mechanism for extracting data | NOT ASSESSED | Non-PII portable schemas and tested import/export |
| 7. Privacy and applicable laws | NOT ASSESSED | Candidate data map, privacy assessment and legal applicability review |
| 8. Standards and best practices | PARTIAL | Open-schema register, API conventions and conformance tests |
| 9A. Data privacy and security | PARTIAL | Threat model and secure-development evidence |
| 9B. Inappropriate and illegal content | NOT ASSESSED | Applicability rationale and relevant safeguards |
| 9C. Protection from harassment | NOT ASSESSED | Applicability rationale and relevant safeguards |

Because at least one mandatory indicator is blocked and several are not assessed, the candidate is **not ready for DPGA nomination**.

## 7. DPI relevance — separate, conditional assessment

The DPGA DPI collection requires:

1. Prior recognition as a DPG.
2. A reusable core capability in at least one DPI domain, designed for population-scale use.
3. DPI architecture alignment through open specifications, modular building blocks, federated deployment and infrastructure-grade security.

Potential mapping for a mature Open MRV Core is to **registries**, **data exchange** or **trust infrastructure**. This mapping requires DPGA fit confirmation and proof that independent systems can use the component.

A sector-specific MRV library or single application is not automatically a DPI building block. No national deployment, broad ecosystem adoption, federated operation or DPI collection inclusion is claimed.

## 8. Work plan and decision gates

### Batch 0 — Rights and product boundary

- Identify all code contributors and rights holders for candidate files.
- Generate complete direct/transitive SBOM and licence inventory.
- Review external data sources, standards and methodology content.
- Freeze inclusion/exclusion manifest.
- Obtain an authorised licence and stewardship decision.

**Exit:** No unresolved ownership or licence blocker.

### Batch 1 — Neutral contract specification

- Define versioned JSON Schema for the core records.
- Define stable opaque identifiers and references.
- Define measurement units, precision, timestamps and uncertainty rules.
- Define evidence/version and verification reference semantics.
- Define deterministic calculation-trace and provenance-event envelopes.

**Exit:** Reviewed specification and golden fixtures.

### Batch 2 — Isolated implementation

- Create a standalone workspace/repository boundary only after Batch 0.
- Extract only approved neutral code.
- Remove application, tenant, database, provider and methodology-specific imports.
- Provide runtime-neutral interfaces for hashing and persistence.
- Build and test from a clean environment.

**Exit:** Standalone build and tests; zero production credentials or data dependencies.

### Batch 3 — Interoperability and safety

- JSON/CSV round-trip tests.
- Schema compatibility and version-migration tests.
- Negative tests for PII leakage and unauthorised export.
- Deterministic calculation replay and hash verification.
- Threat model, dependency scanning, security policy and vulnerability process.

**Exit:** Evidence-backed independent technical review.

### Batch 4 — DPG readiness

- Complete all nine DPGA indicator evidence packs.
- Run the official DPGA eligibility tool.
- Reconcile all findings.
- Prepare and submit only when every mandatory indicator has a defensible evidence-backed response.

**Exit:** External DPGA decision, not self-awarded status.

### Batch 5 — DPI collection readiness

Only after DPG recognition:

- map the capability to an appropriate DPGA DPI domain;
- demonstrate reusable, cross-sector core functionality;
- prove open specifications and modular building-block boundaries;
- demonstrate federated deployment;
- complete infrastructure-grade security evidence;
- document independently verifiable deployments and scope.

**Exit:** Separate DPI collection assessment/decision.

## 9. Shakti controls and release boundaries

- This assessment does not change the current production or SHAKTI gate.
- Do not change the production database, RLS, tenant isolation, production credentials, deployment or release configuration for this work.
- Do not publish user, tenant, organisation, facility or field evidence.
- Do not select or apply an open-source licence without the documented rights-holder decision.
- Do not publish BEE/CPCB/CCTS/EPR methodology text or formulas as original RupayKg content.
- Do not label internal calculations or records as official certificates, credits, statutory acceptance or external verification.
- Keep DPG recognition, DPI collection assessment, local deployment acceptance, statutory approval and TRL evidence distinct.

## 10. Final assessment

| Dimension | Decision |
|---|---|
| Existing RupayKg as a whole DPG | NO-GO at present |
| Existing private domain/carbon workspaces as DPGs | NO-GO at present |
| Open MRV Core concept | FEASIBLE FOR DISCOVERY |
| Open MRV Core current DPG eligibility | NOT READY |
| Open MRV Core current DPI collection eligibility | NOT READY |
| Public release or open licence decision | NOT AUTHORISED |
| Production / TRL 9 effect | NONE |

**Recommended decision:** Continue with a tightly bounded Open MRV Core specification and legal/technical discovery. Do not open-source the whole commercial platform, publish the existing private packages wholesale, or make a DPGA nomination until the gates above have passed.

---

## References

- DPGA DPG Standard: https://www.digitalpublicgoods.net/standard
- DPGA DPGs for DPI: https://www.digitalpublicgoods.net/dpgs-for-dpi
- DPGA application FAQs: https://www.digitalpublicgoods.net/digital-public-goods/faqs
- DPGA Climate Action: https://www.digitalpublicgoods.net/dpgs-for-climate-action
- RIS, *Foundations of Digital Public Infrastructure* (2025).

**Status:** Internal feasibility assessment based on source review of the canonical repository. It is not a legal opinion, DPG recognition, DPI approval, regulatory certification or TRL 9 determination.
