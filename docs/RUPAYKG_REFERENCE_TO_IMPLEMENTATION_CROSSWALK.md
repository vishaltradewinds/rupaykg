# RupayKg Reference → Implementation Crosswalk

**Status:** Controlled engineering reference — 2026-11-08  
**Canonical repository:** `vishaltradewinds/rupaykg` / `main`

## Purpose

This crosswalk converts the Shakti reference-ecosystem register into repository evidence.

**Control chain:**

`Reference → Existing implementation → Gap → Reuse opportunity → Required adaptation → Test → Evidence → Decision`

The crosswalk is an engineering assessment, not a certification, regulatory approval, DPG designation, or TRL-9 claim.

## Evidence rule

A reference is marked **EXISTING** only where the canonical repository contains a concrete implementation or control that materially performs the relevant capability.

- **EXISTING** — concrete implementation is present.
- **PARTIAL** — a related capability exists, but the reference pattern is not fully implemented or externally validated.
- **MISSING** — no material implementation evidence found.
- **DUPLICATE** — capability already exists; a second implementation would create unnecessary duplication.
- **N/A** — reference is useful as research context but not a direct platform capability.

## Crosswalk

| Reference / capability | Repository evidence | Status | Gap / required adaptation | Next action |
|---|---|---|---|---|
| DPGA DPG Standard — open licensing, ownership, documentation, privacy/security | `README.md`, Shakti reference matrix; repository has controlled architecture/docs and explicit external-reference governance | PARTIAL | No formal component-level DPG self-assessment or licence/ownership evidence pack yet | Add a reusable-component assessment template; do not claim DPG status |
| DPGA DPG Registry — reusable component discovery | Shakti adoption matrix records registry as discovery source | EXISTING as research control | No automated registry ingestion/catalogue | Keep as external discovery source; add versioned source records when components are selected |
| GovStack Building Blocks — composable modules | Architecture layer model and controlled integration boundary; API routes are already separated by domain | PARTIAL | No formal GovStack conformance profile; APIs are not uniformly specified as reusable Building Blocks | Define RupayKg adapter/component contracts before external reuse |
| GovStack Digital Registries | `apps/src/registry-routes.ts`, `apps/src/registry-routes.test.ts`, registry migrations `006`, `014`, `019`, `023`, `051`, `075` and registry UI panels | EXISTING / ADAPT | Registry capability is native RupayKg; lifecycle and external interoperability need profile-level mapping | Map existing registry lifecycle to GovStack registry concepts without replacing statutory controls |
| GovStack Information Mediator | `apps/src/sync-routes.ts`, `sync-validation.ts`, sync tests, operation-sync security tests | PARTIAL | Controlled cross-system exchange exists, but no formal mediator/event contract, versioned OpenAPI profile or external-system conformance evidence | Create a connector boundary and contract-test suite |
| GovStack Identity / Registration | `apps/src/auth.ts`, `auth-routes.ts`, onboarding routes, identity/membership migrations, tenant runtime contract | EXISTING / ADAPT | Identity is RupayKg-native; no claim of GovStack identity conformance | Preserve native identity; map only reusable registration patterns |
| Universal DPI Safeguards | Shakti lifecycle, security, tenant isolation, AI boundary, evidence and governance controls | PARTIAL | No complete safeguards-to-control matrix with measurable outcomes | Add safeguard mapping to Shakti control matrix |
| UNDP DPI Playbook | Architecture and lifecycle controls use DPI-style discovery/deployment/reuse reasoning | PARTIAL | No formal playbook crosswalk or implementation decision register | Keep as strategy/reference input |
| Global DPI Repository | Shakti reference matrix explicitly adopts it as research source | EXISTING as research control | No automated evidence catalogue | Record proven implementations and maturity evidence before reuse |
| UN Innovation Network | Shakti reference matrix records innovation-network cases as reference intelligence | EXISTING as research control | No project-specific case adoption yet | Use only when a concrete public-sector use case is relevant |
| FAIR Forward / BMZ | External ecosystem standard and adoption matrix | PARTIAL | No project-level FAIR/open-infrastructure assessment | Apply to selected open components and data/API choices |
| Relevant Indian DPI ecosystems | Regulatory/API architecture and statutory routes exist; Indian regulatory profiles are present in migrations/docs | PARTIAL | Individual external Indian API specifications and acceptance evidence are not yet attached to each connector | Build an India-first connector register with official source/version/evidence |
| W3C Verifiable Credentials 2.0 | Credential entities, issuance/settlement guards and credential ownership controls exist; `apps/test/settlement-credential-guard.test.ts` | PARTIAL | Repository credential model is not evidenced as W3C VC Data Model 2.0 interoperable; issuer/holder/verifier and proof-format conformance not established | Do not retrofit VC blindly; define VC profile only for use cases that require portable credentials |
| W3C Data Integrity | Cryptographic integrity controls and Hedera anchoring exist; `apps/src/hedera-anchor.ts`, integrity migrations | PARTIAL | Existing integrity is not evidence of W3C Data Integrity proof-suite conformance | Add only if a VC profile is approved; include tamper/verification negative tests |
| W3C PROV | Evidence and carbon provenance are implemented through evidence vault, carbon provenance migrations `020`, `022`, provenance tests and MRV provenance UI | EXISTING / ADAPT | Native provenance model is not formally expressed as PROV Entity/Activity/Agent/Derivation | Create a mapping layer/documentation and end-to-end lineage test; do not duplicate provenance storage unnecessarily |
| OGC SensorThings API | Field-device enrollment/provenance, measurements, MRV observations and field capture exist; `migrations/016`, `017`, `apps/src/field-device-panel.tsx`, MRV routes | PARTIAL | No SensorThings resource model/API contract, device-observed-property mapping or external interoperability test | Build a non-invasive SensorThings-compatible adapter at the integration boundary |
| OGC API Features | Site/geography authorization and facility/site data exist | PARTIAL | No OGC API Features implementation or conformance tests | Add only if geospatial interoperability is required by an external integration |
| OpenTelemetry | Repository has operational logging and CI/runtime tests, but no OpenTelemetry dependency/configuration was found in the canonical tree | MISSING | No trace/span/metric correlation across request → DB → MRV → registry → connector | Introduce OpenTelemetry at the service boundary; retain existing logs as application evidence |
| CAD Trust | Carbon registry and environmental-attribute controls exist; registry lifecycle is native | PARTIAL | No CAD Trust schema/exchange implementation or double-counting interoperability test | Create a mapping profile only after carbon registry data model is frozen |
| UNFCCC Article 6.4 registry patterns | Registry lifecycle, issuance/transfer/retirement-style controls and external acceptance gates exist | PARTIAL | International registry pattern cannot substitute for Indian statutory authority; external acceptance not evidenced | Map only relevant lifecycle concepts to the applicable Indian regulatory profile |
| OpenAQ | Environmental observation/data-lineage principles fit field measurement architecture | PARTIAL | No OpenAQ-specific ingestion or source-quality profile | OBSERVE; adapt only for a justified environmental-data integration |
| ICVCM Core Carbon Principles | Shakti matrix explicitly treats CCP as complementary/non-statutory | EXISTING as governance reference | No formal CCP assessment package for each methodology/project | Add benchmark mapping separately from Indian legal compliance |
| GRI | ESG/reporting panels and BRSR/ESG migrations exist | EXISTING / ADAPT | GRI mapping/version evidence is not yet a complete controlled disclosure profile | Add versioned crosswalk where a reporting customer requires GRI |
| Open standards / API reuse generally | `docs/API.md`, domain-specific routes, sync validation and controlled ecosystem layer | PARTIAL | API contracts are not yet uniformly versioned/formalized as reusable external interfaces | Establish canonical API contract/versioning rules |

## Existing capability inventory

The canonical repository already contains substantial capability that should **not** be rebuilt merely because an external ecosystem describes the same concept.

### Evidence and provenance

- Evidence vault: `apps/src/evidence-vault-routes.ts`
- Evidence integration tests: `apps/src/evidence-vault.integration.test.ts`
- Carbon provenance: `apps/test/carbon-provenance.test.ts`
- Carbon provenance migrations: `020_carbon_calculation_provenance.sql`, `022_carbon_provenance_integrity.sql`
- MRV provenance UI: `apps/web/src/mrv-provenance-panel.ts`

**Decision:** reuse native capability; add interoperability mappings rather than a second provenance subsystem.

### Identity and tenant isolation

- `apps/src/auth.ts`
- `apps/src/tenant-db.ts`
- `apps/src/tenant-isolation.integration.test.ts`
- `migrations/20261107_tenant_isolation_runtime_contract.sql`
- `migrations/20261108_shakti_rls_policy_foundation.sql`
- `docs/SHAKTI_TENANT_ISOLATION_ACTIVATION_RUNBOOK.md`

The runtime transaction context is implemented in `withTenantTransaction()`. The RLS policy foundation exists but is deliberately not enabled yet. Therefore tenant isolation remains a deployment acceptance gate.

### Registry and integrity

- `apps/src/registry-routes.ts`
- `apps/src/registry-routes.test.ts`
- `apps/src/registry-settlement-runtime.test.ts`
- Registry migrations `006`, `014`, `019`, `023`, `051`, `075)
- `apps/src/hedera-anchor.ts`
- `apps/src/guardian-mrv.ts`
- `apps/src/hedera-anchor.test.ts`

**Decision:** do not replace the registry with a generic external registry pattern. Add controlled interoperability profiles around the existing authoritative registry.

### Field measurement

- `migrations/016_field_device_enrollment.sql`
- `migrations/017_field_device_provenance.sql`
- `apps/src/field-device-panel.tsx`
- `apps/src/mrv-routes.ts`
- `apps/src/guardian-mrv.ts`
- field-sync migrations and tests

**Decision:** preserve the existing measurement/MRV boundary and add an OGC-compatible adapter rather than changing the canonical data model solely for SensorThings.

## Highest-value gaps discovered

### P0 — Security boundary

Tenant isolation is the most important dependency before new cross-system interfaces.

The repository already has the runtime context and RLS policy foundation, but the policy migration explicitly does **not** enable RLS until the application runs under a non-BYPASSRLS runtime role and cross-tenant negative tests pass in the target environment.

**Decision:** do not expose new multi-organization external interfaces as production-ready until this gate is closed.

### P1 — Operational assurance

OpenTelemetry is the clearest material missing reference capability.

**Required target:**

`Request → Fastify service → PostgreSQL → MRV/calculation → Registry → External connector`

with a common correlation/trace identifier and retained operational evidence.

### P1 — Measurement interoperability

The platform already has field-device, measurement, MRV and provenance capability.

**Required target:**

`Device → Sensor → Observed Property → Observation → Location → Timestamp → Quality → Evidence`

Implement this as an adapter/contract, not as a second measurement database.

### P1 — Provenance interoperability

RupayKg already has meaningful provenance infrastructure.

**Required target:**

`Evidence/Entity → Activity → Agent → Observation/Derivation → Calculation → Claim → Report → Registry Event`

The immediate task is semantic mapping and conformance testing, not rebuilding provenance storage.

### P2 — Portable environmental credentials

Credentials already exist in the domain model, but W3C VC 2.0 interoperability is not established.

**Decision:** keep VC implementation **PENDING/conditional**. Only implement a formal VC profile when a concrete issuer/holder/verifier interoperability requirement exists.

## Reference reuse decision

The reference ecosystem research changes the RupayKg engineering strategy in one important way:

**Do not build everything from scratch.**

Use the external ecosystem to identify proven patterns and reusable software, but keep the RupayKg core authoritative:

`Indian Regulatory Authority`
→ `RupayKg Regulatory Profile`
→ `Evidence`
→ `MRV`
→ `Measurement`
→ `Registry/Integrity`
→ `Workflow`
→ `Reporting`
→ `Controlled External Adapters`

External reference implementations remain adapters, benchmarks or reusable components unless separately validated and approved.

## Formal adoption gate

Every selected external component must have:

1. source and version;
2. licence;
3. ownership/maintainer;
4. capability mapped to RupayKg layer;
5. Indian legal/regulatory applicability;
6. privacy/security/data-governance assessment;
7. technical compatibility result;
8. local adaptation specification;
9. automated tests;
10. field/production validation where applicable;
11. residual risk and owner;
12. adoption decision;
13. control-matrix update.

## Current conclusion

The canonical RupayKg repository is **not missing the whole reference ecosystem**. It already implements substantial equivalents for evidence, provenance, identity, tenant context, MRV, field devices, registry, integrity, workflow and reporting.

The highest-value new engineering work is therefore **interoperability and assurance**, not wholesale replacement:

1. close tenant-isolation production acceptance;
2. add OpenTelemetry operational evidence;
3. formalize W3C-PROV semantic mapping over existing provenance;
4. add an OGC SensorThings-compatible measurement adapter;
5. formalize external API/event contracts;
6. add CAD Trust / applicable registry interoperability profiles;
7. add DPI Safeguards control mapping;
8. defer W3C VC/Data Integrity implementation until a real credential interoperability use case is approved.

**Shakti rule:** Reuse what is proven. Verify what is adopted. Localise what is required. Evidence what is claimed.


## Build / reuse / remove decision

### Build

Build only the gaps that create a real capability boundary:

1. **External integration mediator/adapter boundary**
   - versioned API/event contracts;
   - authentication and organization authorization;
   - idempotency and replay protection;
   - correlation IDs;
   - retry/error handling;
   - external response verification;
   - audit linkage.

2. **OpenTelemetry operational assurance**
   - request/service/database/MRV/registry/connector trace correlation;
   - metrics and alerting;
   - retained incident reconstruction evidence.

3. **OGC-compatible measurement exchange profile**
   - Device;
   - Sensor;
   - Observed Property;
   - Observation;
   - Location;
   - Datastream;
   - timestamp;
   - quality state;
   - source evidence.

4. **W3C PROV semantic/export profile**
   - map the existing provenance graph;
   - do not create a second provenance store.

5. **DPI Safeguards control mapping**
   - map safeguards to existing Shakti controls, owners and evidence.

### Reuse

Reuse existing canonical RupayKg capabilities:

- evidence vault;
- evidence/activity lineage;
- deterministic MRV;
- carbon calculation provenance;
- field-device enrollment/provenance;
- organization and identity model;
- tenant transaction context;
- registry lifecycle;
- settlement integrity;
- Guardian MRV integration;
- Hedera anchoring;
- statutory applicability and regulatory-source governance;
- existing reporting/BRSR/EPR/CPCB/CCTS domain controls.

### Remove / avoid

Do **not** introduce parallel implementations for:

- generic evidence storage;
- generic provenance storage;
- generic registry state;
- generic identity;
- generic tenant model;
- per-connector custom gateway logic;
- a second audit ledger;
- a second sensor/measurement source of truth;
- blockchain as a replacement for PostgreSQL authoritative state;
- AI-generated authority replacing deterministic MRV;
- external DPI/DPG components solely because they are fashionable or reusable.

If duplicate functionality is found during subsequent repository inspection, consolidate it behind the canonical RupayKg capability instead of adding another subsystem.

## Test matrix generated by the crosswalk

| Capability | Minimum test |
|---|---|
| Adapter/mediator | authentication, authorization, schema validation, idempotency, replay, timeout, retry, error mapping, audit correlation |
| Tenant isolation | organization A cannot read/write organization B through direct API, adapter, background job or connector path |
| Provenance | raw evidence can be traced through activity/observation/calculation/claim/registry event |
| OGC measurement | valid mapping, invalid payload rejection, duplicate/replay handling, offline recovery, source preservation |
| Registry interoperability | lifecycle transition, authorization, duplicate prevention, transfer/retirement constraints |
| OpenTelemetry | trace correlation across service/DB/MRV/registry/connector and incident reconstruction |
| VC/Data Integrity, if later approved | issuer/holder/verifier, signature verification, tamper rejection, status/revocation and key lifecycle |
| External connector | external failure cannot corrupt authoritative internal state |
| AI | model output remains advisory and cannot bypass authoritative evidence/MRV/authorization |

## Evidence required before changing control status

The crosswalk itself does **not** turn an AMBER/OPEN control GREEN.

A status change requires repository and/or runtime evidence appropriate to the control, including:

- exact implementation path and commit;
- automated test result;
- target-environment runtime result where applicable;
- external-system response where applicable;
- field evidence where applicable;
- responsible owner;
- residual risk;
- rollback/recovery evidence for production changes.

### Current high-priority status interpretation

- **Tenant isolation:** OPEN until target-production runtime role/RLS/negative proof is captured.
- **External ecosystem adoption:** AMBER until component-level adoption evidence is recorded.
- **OpenTelemetry:** MISSING implementation; no GREEN claim.
- **OGC SensorThings:** PARTIAL; adapter and conformance evidence required.
- **W3C VC/Data Integrity:** PENDING/conditional; no implementation claim.
- **W3C PROV:** EXISTING/PARTIAL; semantic interoperability mapping remains.
- **Registry:** internally strong; external interoperability remains a separate gate.
- **TRL 9:** OPEN.

## Next autonomous engineering sequence

1. Close the tenant-isolation deployment gate.
2. Formalize the external adapter/mediator contract.
3. Add OpenTelemetry to the critical transaction path.
4. Produce the W3C PROV mapping over existing provenance.
5. Produce the OGC SensorThings mapping over existing field measurements.
6. Add conformance and negative tests.
7. Map Universal DPI Safeguards to existing Shakti controls.
8. Reassess CAD Trust / external registry interoperability using the frozen internal registry model.
9. Reassess W3C VC 2.0 only if a concrete portable environmental-credential use case is approved.
10. Update the Shakti control matrix only from evidence produced by these gates.

**No architecture is promoted merely because a reference ecosystem recommends it. The canonical repository remains the implementation authority; Shakti controls the adoption decision.**
