# RupayKg Open Registry and Climate Schema Comparison

**Status:** Initial design comparison; no schema adoption approved  
**Baseline:** RupayKg main 934062ef8af2ca47bbcbf5e37c12de12a4f9f743  
**Candidates:** Sunbird RC and OpenClimate  
**Authoritative store:** existing RupayKg Neon database only

## 1. Purpose

Compare external data models to RupayKg's registry and climate-accounting responsibilities. The purpose is to identify reusable concepts and interoperability mappings, not to import another platform's database or make an external service authoritative.

## 2. Sunbird RC comparison

Sunbird RC describes an electronic registry framework for entities, authorised repositories, metadata, attestation and verifiable credentials. Its inspected core repository carries an MIT licence.

### Reusable concepts
- Configurable entity types and schema-driven registry definitions.
- Explicit issuer/attestation relationships.
- Controlled disclosure and verification.
- Stable identifiers and registry API patterns.

### RupayKg mapping candidates

| Sunbird RC concept | RupayKg domain concept | Decision |
|---|---|---|
| Registry entity | Existing RupayKg organisation, facility, processor, equipment or material records | Map to existing entity; no parallel registry |
| Entity schema | RupayKg domain validation schema | Compare constraints and versioning |
| Attestation | RupayKg evidence approval and credential issuance event | Keep approval in RupayKg; optional external credential |
| Registry API | Existing RupayKg API contracts | Reuse patterns only |
| External repository link | Evidence Vault source/provenance reference | Store a controlled source reference and digest |

### Required inspection before reuse
- Current registry entities and schema/version model in RupayKg.
- Identifier uniqueness and cross-tenant boundaries.
- Update, merge, suspension and archival semantics.
- Audit immutability and provenance.
- Credential issuance coupling and key custody.
- API authentication, authorisation and disclosure controls.

**Disposition:** architecture reference only. Do not deploy Sunbird RC or create new registry tables until a concrete gap is evidenced and mapped to existing entities.

## 3. OpenClimate comparison

OpenClimate documents climate actors, geographic hierarchy, actor relationships, actions, targets, emissions and data sources. Its API is versioned REST; its schema documentation identifies Apache-2.0 for the documented schema.

### Reusable concepts
- Actor hierarchy and geography.
- Relationships between country, subnational region, city, organisation and site.
- Explicit data-source attribution.
- Created/updated timestamps and source publication dates.
- Unit normalisation at ingestion.
- Separation of actor data from climate action and target data.

### RupayKg mapping candidates

| OpenClimate concept | RupayKg domain concept | Mapping principle |
|---|---|---|
| Actor | Organisation, authority, facility or other accountable actor | Reuse existing RupayKg identifiers |
| Actor hierarchy/parts | State, district, ULB, facility and site hierarchy | Map to verified administrative/geographic identifiers |
| Actor relationship | Organisation-facility, operator-site and authority-jurisdiction relationships | Preserve effective dates and authorisation provenance |
| DataSource | Evidence source, measurement source or external dataset | Record source, method, version, retrieval and digest |
| Emissions data | RupayKg activity data and calculated emissions | Do not copy calculated values without methodology, boundary and unit metadata |
| Climate action/target | Project intervention, reduction target or programme milestone | Keep separate from measured outcomes and verified credits |

### Critical differences

OpenClimate is a climate-data and accounting model. It is not a substitute for:
- Indian CCTS methodologies and registry requirements;
- BEE-accredited verification;
- CPCB solid-waste and EPR obligations;
- RupayKg's evidence chain and MRV calculations;
- statutory approvals or carbon-credit issuance.

OpenClimate data may be used as external context only after source, licence, geography, time period, boundary, methodology and unit compatibility are checked.

### Required inspection before reuse
- Current RupayKg actor, facility, geography, activity and emissions schemas.
- Whether any OpenClimate identifiers can be mapped without collision.
- Source and dataset licence for each imported dataset (software licence does not license data).
- Geography crosswalk quality for Indian states, districts and urban local bodies.
- Emissions boundary, gases, GWP basis, units, periods and methodology.
- Update frequency, source provenance and correction/deprecation semantics.

**Disposition:** data-model and optional API reference only. No schema import, no bulk data ingestion and no use as a statutory source.

## 4. Shared interoperability rules

1. RupayKg identifiers remain canonical internally.
2. External identifiers are stored as namespaced crosswalks only where a real integration requires them.
3. Every imported record carries source system, source identifier, retrieval timestamp, source version, provenance and integrity digest where technically possible.
4. Geographic mappings must include source, version, effective period and confidence/review state.
5. Units are explicit and normalised through controlled conversion rules; original value and unit remain traceable.
6. External emissions values are not treated as RupayKg calculations unless methodology and boundary equivalence are demonstrated.
7. No external dataset or credential overrides RupayKg's statutory and reviewer decisions.
8. Any new persistence must be justified against existing schema and approved only after disposable-branch migration tests and independent review.

## 5. Follow-on repository mapping work

The next implementation-independent review should map:
- RupayKg organisation/facility/registry entities and migrations;
- geography and jurisdiction models;
- activity, measurement and emissions schemas;
- evidence provenance and approval lifecycle;
- API routes and permission keys;
- existing external identifier and data-source fields.

Deliverable: a field-level mapping matrix with exact RupayKg file/table/column references, gaps, collision risks, migration necessity (yes/no), and test requirements. Do not propose DDL until the mapping proves it is necessary.

## 6. Source repositories

- Sunbird RC: https://github.com/Sunbird-RC/sunbird-rc-core
- OpenClimate: https://github.com/Open-Earth-Foundation/OpenClimate
- OpenClimate API specification: https://github.com/Open-Earth-Foundation/OpenClimate/blob/develop/api/API.md
- OpenClimate schema documentation: https://github.com/Open-Earth-Foundation/OpenClimate/blob/develop/api/schema/README.md

---
**Shakti Standards disposition:** comparative design only. No integration or regulatory recognition implied.
