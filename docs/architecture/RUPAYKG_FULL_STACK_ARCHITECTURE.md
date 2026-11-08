# RupayKg Full-Stack Platform Architecture

**Status:** AUTHORITATIVE ARCHITECTURE BASELINE  
**Repository:** `vishaltradewinds/rupaykg`  
**Controlled branch:** `cto/20261107-protected-migration-ci`  
**Effective date:** 2026-11-08  
**Governing register:** `docs/standards/RUPAYKG_AUTHORITATIVE_STANDARDS.md`

## 1. Architecture purpose

RupayKg is an India-focused, pan-India **Sovereign Digital MRV & Circular Economy Infrastructure** platform implemented as a commercial innovation operating system.

The platform connects real-world environmental/resource activity to authoritative digital records:

**physical activity → identity/authority → measurement → evidence → resource-flow ledger → MRV → regulatory applicability → verification → eligible environmental outcome → governed value/settlement → audit/provenance**

The architecture must support Urban and Rural operations, multiple organizations and geographies, field/offline acquisition, EPR/compliance workflows, carbon-market pathways, ESG reporting, evidence management, verification, registry/value workflows and controlled external integrations.

This document describes the target full-stack architecture while explicitly distinguishing implemented repository capability from future/externally gated capability.

## 2. Governing architectural principles

1. **One authoritative business-state database.**
2. **Tenant authority is server-side and database-enforced.**
3. **Active organization is authoritative for organization-scoped mutations.**
4. **Geography scope is enforced server-side.**
5. **Evidence precedes value.**
6. **Measurement never becomes certified MRV evidence merely because software accepted it.**
7. **Regulatory authority is never delegated to AI or an open-source dependency.**
8. **Open-source components are controlled dependencies, not implicit authorities.**
9. **Offline field data is replayable, idempotent and provenance-preserving.**
10. **External systems are integration boundaries, not internal truth sources.**
11. **Production claims require evidence at the applicable gate.**
12. **Software completion does not equal field validation, regulatory approval or TRL 9.**
13. **Fail closed on missing authority, identity, evidence, methodology or required configuration.**
14. **Every material transformation preserves lineage.**
15. **The same architecture must scale from SITE-JBP-01 to pan-India deployment without creating a separate product architecture per site.**

## 3. System context

```
                     ┌───────────────────────────────────┐
                     │      External authorities        │
                     │ BEE / CPCB / MoEFCC / regulators │
                     └─────────────────┬─────────────────┘
                                       │ controlled references
                                       ▼
┌───────────────┐      ┌────────────────────────────────────────┐
│ Field sites   │      │             RupayKg Platform           │
│ instruments   │─────▶│                                        │
│ devices       │      │ Identity → Tenant → Operations → MRV  │
│ operators     │      │       → Evidence → Value → Audit      │
└───────────────┘      └───────────────────┬────────────────────┘
                                           │
                  ┌────────────────────────┼───────────────────────┐
                  ▼                        ▼                       ▼
           External MRV/registry     Guardian/Hedera        Reporting/export
           /authority boundaries     provenance boundary    /institutional APIs
```

External systems may provide authoritative external evidence, but the platform preserves the corresponding external identifiers, timestamps, responses and provenance rather than treating an unverified integration response as truth.

## 4. Logical full-stack layers

### Layer 0 — Real-world domain

Sources include:

- municipal solid waste operations;
- collection/transport;
- material recovery and processing;
- landfill/disposal facilities;
- biomass/resource flows;
- EPR-relevant activities;
- carbon-relevant activities;
- field instruments;
- operators, verifiers and organizational authorities.

The digital platform must never invent a physical event.

### Layer 1 — Field and edge

```
Instrument / sensor
      ↓
isolated RS-232 / RS-485 / pulse / digital I/O
      ↓
edge acquisition controller
      ↓
local acquisition service
      ↓
canonical measurement envelope
      ↓
field-device sync API
```

The controlled hardware baseline is documented in `docs/hardware/RUPAYKG_FIELD_EDGE_STACK.md`.

The edge layer provides acquisition, local buffering, identity, timestamps, sequence numbers, hashes, quality flags and replay support.

It does not provide statutory certification by itself.

### Layer 2 — Connectivity

Supported deployment patterns:

- HTTPS API;
- Ethernet;
- Wi-Fi;
- cellular;
- offline-first local queue;
- controlled replay;
- future site-specific gateways where required.

Connectivity failure must not silently destroy field evidence.

### Layer 3 — Application/API

The current backend package is `@rupaykg/api`, built with:

- TypeScript;
- Fastify;
- PostgreSQL driver;
- Fastify CORS/static modules;
- gRPC capability;
- controlled external SDK integrations.

The API is the authoritative application boundary for identity, authorization, tenant scope, operational mutations and domain workflows.

### Layer 4 — Domain services/packages

The repository workspace separates domain capabilities into packages including:

- `@rupaykg/domain`
- `@rupaykg/carbon`
- `@rupaykg/compliance`
- `@rupaykg/esg`
- `@rupaykg/intelligence`

The architecture keeps domain logic separated from transport and UI concerns.

### Layer 5 — Authoritative data plane

PostgreSQL is the authoritative business-state store.

Core concepts include:

- organizations/tenants;
- identities and memberships;
- geography/scope;
- activities;
- resource/waste flows;
- measurements;
- evidence;
- verification;
- carbon calculations;
- EPR/compliance obligations;
- registry events;
- settlement state;
- field devices and sync envelopes;
- audit events;
- regulatory/methodology metadata.

The database is not merely a persistence cache. It is the authoritative state boundary.

### Layer 6 — Security and authorization plane

Security is defense in depth:

```
Identity
  ↓
Authenticated session
  ↓
Verified organization membership
  ↓
Active organization authority
  ↓
Geography scope
  ↓
Permission / role
  ↓
Domain lifecycle state
  ↓
Database authorization / RLS
  ↓
Audit event
```

High-risk actions must be protected at the database boundary as well as the HTTP/application boundary.

Runtime database roles must not rely on owner/BYPASSRLS privileges for normal application execution.

### Layer 7 — Evidence and provenance

Every material environmental claim should have a lineage chain:

```
source
  ↓
raw record
  ↓
measurement
  ↓
activity/resource flow
  ↓
evidence
  ↓
normalized parameter
  ↓
calculation
  ↓
verification
  ↓
eligible outcome
```

For hardware-originated data:

```
instrument
→ device identity
→ raw reading
→ canonical measurement
→ evidence
→ MRV calculation
→ verification
→ audit event
```

No transformation may erase the source reference.

### Layer 8 — MRV and methodology engine

The MRV layer is deterministic where the governing methodology requires deterministic calculation.

Methodology lifecycle:

`SOURCE_LOCKED → IMPLEMENTATION_MAPPED → NUMERICALLY_RECONCILED → REGRESSION_VERIFIED → PRODUCTION_ELIGIBLE`

Each methodology implementation must retain:

- authority;
- exact code;
- version;
- effective date;
- applicability;
- boundary;
- baseline;
- parameter dictionary;
- units;
- source evidence;
- equations;
- intermediate values;
- calculation result;
- evidence hashes;
- verification state.

For BM WA03.001, the current repository contains an implementation of the core Equation 4 adapter, but this does not by itself establish complete methodology production eligibility.

### Layer 9 — Regulatory/compliance engine

Regulatory workflows are separated from generic environmental transactions.

Key dimensions include:

- applicable law/regulation;
- authority;
- mechanism;
- methodology;
- reporting period;
- geography;
- organization;
- evidence requirements;
- verification requirements;
- submission status.

Carbon market mechanism is explicitly separated into compliance, offset and other pathways.

EPR and carbon attributes are not silently conflated.

### Layer 10 — Value and settlement

Value workflows are downstream of evidence and authorization:

```
physical activity
→ authoritative record
→ verified evidence
→ eligible environmental attribute
→ governed issuance/registry state
→ transfer/retirement where permitted
→ settlement
→ reconciliation
```

Settlement cannot jump directly to a final state without the required external confirmation, confirmation evidence and reconciliation controls.

### Layer 11 — External trust and registry integrations

Potential/controlled integration boundaries include:

- Hedera/HCS;
- Hedera Mirror Node;
- Guardian;
- government/regulatory interfaces;
- external registries;
- accredited verification actors;
- institutional APIs.

Integration states must distinguish:

`NOT_CONNECTED → MANUAL_CONTROLLED → CONNECTED_TESTED → PRODUCTION_CONNECTED`

A mock response is never treated as real authority evidence.

### Layer 12 — Intelligence/AI

AI/intelligence is advisory and assistive.

Possible functions:

- anomaly detection;
- evidence classification;
- document extraction;
- workflow assistance;
- operational recommendations;
- analytics;
- natural-language interfaces.

AI must not silently mutate authoritative lifecycle state, create statutory evidence, invent measurements, substitute regulatory decisions, or bypass authorization.

Model identity/version, provenance, licensing, evaluation and limitations must be controlled under Shakti Standards.

### Layer 13 — Presentation/UI

The web application is a separate workspace package:

`@rupaykg/web`

The UI consumes backend-authorized state.

It must:

- respect organization scope;
- respect geography scope;
- display authoritative lifecycle state;
- distinguish calculated from verified/issued outcomes;
- avoid simulated/demo data in production;
- surface evidence and provenance where appropriate.

UI is not an authority layer.

## 5. Frontend architecture

Target structure:

```
Browser / PWA
   │
   ├── Authentication/session
   ├── Organization switcher
   ├── Geography context
   ├── Operational workspace
   ├── Field/sync workspace
   ├── Evidence workspace
   ├── MRV workspace
   ├── Compliance/EPR workspace
   ├── Carbon workspace
   ├── ESG/reporting workspace
   ├── Verification workspace
   ├── Registry/value workspace
   └── Administration/audit workspace
             │
             ▼
        Authoritative API
```

The frontend must not calculate authoritative business state independently of the backend.

## 6. Backend architecture

```
Fastify API
│
├── Authentication/session
├── Organization/membership
├── Geography authorization
├── Activity/resource flow
├── Measurement
├── Evidence
├── Verification
├── Carbon
├── EPR/compliance
├── ESG
├── Field-device enrollment
├── Offline synchronization
├── Registry/value
├── Settlement
├── Audit
└── External integration boundaries
```

Cross-cutting middleware/services:

- identity context;
- active-tenant authority;
- authorization;
- input validation;
- transaction boundaries;
- audit logging;
- idempotency;
- provenance;
- error normalization;
- rate limiting where required;
- security headers/configuration.

## 7. Database architecture

PostgreSQL is the canonical business database.

Logical separation should follow:

```
Identity / Authority
        ↓
Tenant / Geography
        ↓
Operational Ledger
        ↓
Measurements
        ↓
Evidence
        ↓
Verification
        ↓
MRV / Methodologies
        ↓
Regulatory / EPR / ESG
        ↓
Registry / Value / Settlement
        ↓
Audit / Provenance
```

Tenant isolation must be enforced through database controls where applicable, not only through application code.

The application runtime must use a least-privilege role that is not the database owner and does not possess BYPASSRLS.

## 8. Field/offline architecture

The field stack must support:

- device registration;
- unique device identity;
- organization binding;
- operator identity;
- measurement sequence;
- timestamp;
- local queue;
- retry;
- replay;
- idempotency;
- duplicate suppression;
- device revocation;
- raw evidence references;
- firmware/hardware/calibration metadata.

Canonical envelope:

```
deviceId
measurementId
capturedAt
source
value
unit
method
quality
rawReference
firmwareVersion
hardwareSku
calibrationReference
sequence
payloadHash
```

Field acceptance sequence:

**H1 component evidence → H2 bench interface → H3 edge resilience → H4 software integration → H5 site acceptance → H6 continuous assurance**

## 9. Security architecture

Security controls span:

### Identity

- authenticated identity;
- session expiry/revocation;
- verified organization membership;
- explicit active organization.

### Authorization

- role/permission;
- geography;
- tenant;
- lifecycle;
- high-risk action authorization.

### Database

- RLS where applicable;
- least-privilege runtime;
- protected security-definer functions where required;
- no BYPASSRLS application runtime;
- migration integrity.

### Application

- input validation;
- secure CORS;
- secure production configuration;
- dependency control;
- secrets outside source;
- auditability;
- replay protection.

### Field

- unique device identity;
- revocation;
- firmware provenance;
- protected credentials;
- controlled debug access;
- authenticated updates where deployed.

## 10. Deployment architecture

The repository currently defines a deployment path around containerized production services and managed PostgreSQL.

Target topology:

```
                    Internet
                       │
                 HTTPS ingress
                       │
              ┌────────▼────────┐
              │ RupayKg Web/API │
              │ production svc  │
              └────────┬────────┘
                       │
              least-privilege DB
                       │
              ┌────────▼────────┐
              │   PostgreSQL    │
              │ authoritative   │
              └─────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    Field sync     MRV/value      Audit/evidence
        │              │              │
        └────── controlled external ──┘
                 integrations
```

Deployment environments must be isolated.

Production configuration must be explicit for:

- database URL/TLS;
- allowed web origins;
- authentication;
- secrets;
- external integrations;
- observability;
- rate limits;
- runtime identity;
- database role.

## 11. CI/CD architecture

The repository CI must validate, as applicable:

1. migration integrity;
2. disposable PostgreSQL;
3. runtime role flags;
4. protected Shakti migrations;
5. identity-context behavior;
6. RLS behavior;
7. tenant isolation;
8. active-tenant authority;
9. field-sync contracts;
10. security-definer contracts;
11. typecheck;
12. build;
13. browser smoke;
14. domain tests;
15. database integration tests;
16. production container build;
17. hardware/software boundary contracts;
18. open-source ecosystem control.

CI evidence is repository evidence. It is not regulator approval or field certification.

## 12. Observability and assurance

Production observability should cover:

- request health;
- authentication failures;
- authorization denials;
- database failures;
- sync backlog;
- duplicate/replay events;
- measurement anomalies;
- evidence integrity failures;
- methodology calculation failures;
- external integration failures;
- settlement reconciliation failures;
- device health;
- calibration expiry;
- firmware versions;
- audit-chain integrity.

Operational alerts must distinguish security incidents, data-quality incidents, regulatory-control failures and infrastructure failures.

## 13. Data lifecycle

```
Capture
  ↓
Validate
  ↓
Normalize
  ↓
Store
  ↓
Evidence-link
  ↓
Verify
  ↓
Calculate
  ↓
Freeze
  ↓
Submit/issue where authorised
  ↓
Transfer/retire where authorised
  ↓
Reconcile
  ↓
Archive/retain according to applicable policy
```

No irreversible state transition should occur without the required evidence and authorization.

## 14. Multi-tenancy model

RupayKg is organization-scoped.

Primary security boundary:

`identity → membership → active organization → geography → permission → database row`

A request carrying another organization's identifier cannot override the authenticated active organization.

For field operations:

`device → organization → authorized identity → activity/geography → measurement`

This prevents cross-tenant data injection and unauthorized field-device use.

## 15. Regulatory architecture

Regulatory source data must be versioned and provenance-preserving.

For each regulatory source retain:

- authority;
- source identifier;
- exact title;
- version/effective date;
- retrieval/source reference;
- applicability;
- internal mapping;
- reconciliation status;
- supersession status.

Regulatory updates must be reconciled before production behavior is changed.

## 16. Open-source architecture

Open-source components are selected through the Shakti OSS/Digital-Ecosystem Record.

Selection preference:

**open standard/protocol → mature OSS implementation → Indian/open ecosystem implementation → maintained interoperable alternative → proprietary component where evidence requires it**

Every adopted component must retain:

`component → version → license → source → security evidence → test evidence → deployment evidence → owner → replacement path`

Open-source dependencies must be pinned in controlled production baselines.

## 17. Hardware/software sovereignty track

The architecture supports an indigenous/open hardware path without making unsupported certification claims.

Candidate architecture:

```
Approved instrument
      ↓
isolated interface
      ↓
ESP32-class or suitable open RISC-V edge controller
      ↓
local acquisition software
      ↓
canonical envelope
      ↓
RupayKg sync
      ↓
authoritative PostgreSQL
```

Indian/open processor options such as SHAKTI may be evaluated where the exact SoC/board satisfies interface, performance, security, environmental, supply and certification requirements.

The architecture does not claim that a particular board, sensor or controller is already field-certified or Indian-manufactured unless evidence exists.

## 18. Resilience and disaster recovery

The platform should be designed around:

- transactional database integrity;
- migration reproducibility;
- backup/restore;
- point-in-time recovery where supported;
- field offline buffering;
- replay-safe synchronization;
- idempotent external submissions;
- immutable audit events where required;
- versioned methodology/calculation snapshots;
- controlled rollback;
- deployment artifact traceability.

Recovery testing must be evidence-backed rather than assumed.

## 19. Performance and scalability

The architecture separates:

- stateless API compute;
- authoritative transactional database;
- field ingestion;
- evidence storage;
- asynchronous processing;
- analytics/reporting;
- external integrations.

Scaling must preserve tenant isolation and transaction integrity.

Do not scale by introducing a second conflicting source of truth.

## 20. Reference implementation status

### Implemented/controlled in the current repository

- TypeScript monorepo/workspaces.
- Fastify API.
- PostgreSQL data plane.
- Domain packages for domain, carbon, compliance, ESG and intelligence.
- Organization and geography authorization controls.
- Active-tenant authority controls.
- Field-device enrollment/synchronization controls.
- Evidence/MRV domain controls.
- Carbon methodology implementation controls.
- EPR/compliance controls.
- Registry/value/settlement security controls.
- RLS/security-definer contract tests.
- CI security/migration/database validation.
- Controlled hardware/software boundary.
- Shakti open-source ecosystem control.
- Authoritative standards register.

### Implemented but requiring external/runtime/field acceptance

- production database role provisioning;
- production PostgreSQL/TLS acceptance;
- physical instrumentation;
- site installation and calibration;
- external carbon-market interfaces;
- external Guardian/Hedera live acceptance;
- authority/registry acceptance;
- field operational validation.

### Not to be inferred

The architecture does not, by itself, establish:

- regulatory certification;
- official carbon-credit issuance;
- accredited verification;
- hardware certification;
- calibration;
- live field acceptance;
- national operational deployment;
- TRL 9.

## 21. End-to-end transaction architecture

A canonical environmental transaction follows:

```
1. Organization / identity established
          ↓
2. Authorized activity created
          ↓
3. Physical resource flow recorded
          ↓
4. Field measurement captured
          ↓
5. Measurement validated
          ↓
6. Evidence attached
          ↓
7. Evidence integrity/provenance checked
          ↓
8. Regulatory applicability evaluated
          ↓
9. Methodology selected and source-locked
          ↓
10. Deterministic MRV calculation
          ↓
11. Verification workflow
          ↓
12. Verification freeze
          ↓
13. Eligible outcome decision
          ↓
14. External authority/registry interaction where applicable
          ↓
15. External issuance/identifier reconciled
          ↓
16. Transfer/retirement/value action where authorised
          ↓
17. Settlement and reconciliation
          ↓
18. Immutable audit/provenance record
```

A failure at any mandatory gate stops the transaction from advancing.

## 22. Architecture acceptance gates

The full-stack architecture is accepted only progressively:

**A1 — Repository integrity**  
Correct authoritative repository and branch.

**A2 — Build integrity**  
Typecheck/build/test.

**A3 — Database integrity**  
Clean migrations, runtime-role controls and tenant isolation.

**A4 — Security integrity**  
Identity, authorization, RLS and high-risk database boundaries.

**A5 — Domain integrity**  
Activity → measurement → evidence → verification → value lifecycle.

**A6 — Methodology integrity**  
Source lock, applicability, parameter mapping, deterministic calculation and reconciliation.

**A7 — Field integrity**  
Instrument → edge → sync → measurement → evidence.

**A8 — External integrity**  
Real external acceptance, not mocks.

**A9 — Production integrity**  
Runtime configuration, identity, TLS, observability and deployment acceptance.

**A10 — Operational/TRL evidence**  
Real site operation, sustained use and complete applicable TRL evidence.

## 23. Architecture decision rules

When future engineering introduces a new component:

1. identify the business capability;
2. identify the authoritative state;
3. identify the security boundary;
4. identify the regulatory boundary;
5. identify the evidence required;
6. evaluate open-source/ecosystem options;
7. define failure behavior;
8. define offline/replay behavior where relevant;
9. define audit/provenance;
10. define tests;
11. define field/external acceptance;
12. update this architecture and the authoritative standards register.

No new subsystem may create a parallel authority for business state.

## 24. Final architecture rule

The platform is not merely a web application.

It is a layered environmental transaction system:

**Real-world activity → Edge → Connectivity → API → Domain → Authoritative PostgreSQL → Evidence → MRV → Regulatory control → Verification → External trust/registry → Value/settlement → Audit → Continuous assurance**

Every layer has a defined authority boundary.

Every claim has an evidence state.

Every external dependency has an integration boundary.

Every production transition has a gate.

**No layer may be skipped.**


## 25. Architecture-to-engineering execution rule

This architecture is now the controlling technical baseline for subsequent repository engineering. New implementation work shall map to the layers and gates above before introducing new infrastructure, databases, authority paths or parallel sources of truth.

### 25.1 Immediate engineering priorities

1. Preserve the single authoritative PostgreSQL business-state boundary.
2. Complete protected-core tenant/RLS behavioral acceptance, including multi-party transaction paths.
3. Keep production database and runtime changes READ-ONLY/HOLD until applicable cutover evidence is complete.
4. Continue field hardware and software integration in parallel, using the canonical measurement envelope and H1-H6 acceptance sequence.
5. Expand methodology implementations only from source-locked official methodology evidence.
6. Treat CPCB SWM Rules 2026 and its centralized online portal as external regulatory boundaries; do not claim portal integration until a real integration is implemented and evidenced. The SWM Rules 2026 came into force on 1 April 2026 and establish centralized online tracking/reporting requirements. citeturn707902search0turn707902search5
7. Maintain explicit separation between CCTS compliance/offset mechanisms and internal carbon calculations. BEE maintains the CCTS methodology and accredited verification ecosystem. citeturn707902search2turn707902search10
8. Treat EPR as a category-specific regulatory workflow; do not generalize one EPR regime across all waste streams. Government sources identify multiple category-specific EPR frameworks. citeturn707902search3
9. Every completed engineering increment must update evidence state, tests and the authoritative standards/architecture register where its governance changes.

### 25.2 No architectural drift

The following are prohibited without a controlled architecture decision:

- introducing another authoritative production database;
- creating a second tenant-authority mechanism;
- bypassing database authorization for convenience;
- storing authoritative business state only in external registries;
- coupling UI state directly to regulatory authority;
- treating AI output as statutory evidence;
- treating mock integrations as production integrations;
- adding hardware without device identity, provenance and acceptance requirements;
- claiming production, certification, field validation or TRL 9 solely from code completion.

### 25.3 Definition of done

A feature is not architecturally complete merely when code compiles. The minimum definition of done is:

**architecture mapping → implementation → security → deterministic tests → integration evidence → operational/field evidence where applicable → lifecycle-state update → production gate where applicable.**
