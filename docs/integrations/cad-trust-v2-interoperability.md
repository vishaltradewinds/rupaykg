# CAD Trust Data Model v2.0.2 ↔ RupayKg Interoperability Profile

Status: **DESIGN / ADAPTER-READY MAPPING**  
Date: 2026-11-12  
Authoritative repository: `vishaltradewinds/rupaykg`

## 1. Purpose

This document defines the boundary between RupayKg's authoritative environmental MRV/evidence/provenance system and the Climate Action Data Trust (CAD Trust) carbon-market interoperability model.

CAD Trust is treated as an **external interoperability target**, not as the authoritative database for RupayKg.

CAD Trust's current public documentation states that Data Model v2.0 API documentation is available for testing and that the model is intended for registry interoperability and harmonised carbon-credit data. CAD Trust also identifies its software and data model as a Digital Public Good.

## 2. Non-negotiable architecture rule

RupayKg remains authoritative for:

- organisations and tenant state
- activities and operational records
- measurements and observations
- evidence artifacts and evidence verification
- MRV calculations
- verification decisions
- provenance
- Guardian execution state
- Hedera consensus anchors
- regulatory/compliance records

A CAD Trust adapter may **read, transform, validate, stage, submit, and reconcile external references**.

A CAD Trust response must never silently replace RupayKg authoritative state.

This follows the existing Shakti external integration contract.

## 3. Integration boundary

```
Physical activity
      ↓
Measurement / observation
      ↓
Evidence vault
      ↓
MRV calculation
      ↓
Verification
      ↓
Provenance
      ↓
Guardian / Hedera integrity rail
      ↓
RupayKg environmental asset / carbon-market record
      ↓
CAD Trust adapter
      ↓
CAD Trust Data Model v2.x
      ↓
External carbon registries / connected market infrastructure
```

CAD Trust is therefore downstream of a validated RupayKg evidence/MRV chain when RupayKg is acting as the source system.

## 4. v2.0.2 entity mapping

| CAD Trust entity | RupayKg source/boundary | Mapping status |
|---|---|---|
| program | external registry/program metadata | Adapter mapping required |
| methodology | RupayKg methodology reference / MRV methodology | Adapter mapping required |
| stakeholder | RupayKg organisation + project participants | Adapter mapping required |
| label | RupayKg eligibility/compliance labels | Adapter mapping required |
| project | RupayKg project/activity aggregate | Requires governed projection |
| project_methodology | RupayKg methodology relationship | Adapter mapping required |
| validation | RupayKg/external validation evidence and decision | Requires external-verifier semantics |
| verification | RupayKg verification record | Strong conceptual mapping |
| location | RupayKg geography/site records | Adapter mapping required |
| estimation | RupayKg methodology/calculation estimation outputs | Adapter mapping required |
| rating | external rating/assessment | External-data boundary |
| co_benefit | RupayKg impact/co-benefit records | Adapter mapping required |
| issuance | external registry issuance event | **Do not fabricate locally** |
| unit | external carbon unit/credit record | **Do not fabricate locally** |
| unit_label | RupayKg eligibility/label projection | Adapter mapping required |

## 5. Important semantic distinction

RupayKg's environmental MRV record is **not automatically a CAD Trust carbon credit**.

The following are distinct states:

1. measured environmental activity
2. MRV calculation
3. verified environmental result
4. registry-eligible project/result
5. registry issuance
6. carbon unit/credit
7. retirement/cancellation/transfer

Only an authorised registry/programme can establish the corresponding external registry lifecycle state.

Therefore:

- no CAD Trust `issuance` is created merely because an MRV calculation exists;
- no CAD Trust `unit` is created merely because a project is verified;
- no market eligibility is inferred from Guardian/Hedera anchoring;
- provenance/integrity evidence supports trust but does not itself confer regulatory or registry status.

## 6. CAD Trust v2 insert order

The adapter must respect the published v2 schema dependency order:

```
program
  ↓
methodology
  ↓
stakeholder
  ↓
label
  ↓
project
  ↓
project_methodology
  ↓
validation
  ↓
verification
  ↓
location
  ↓
estimation
  ↓
rating
  ↓
co_benefit
  ↓
issuance
  ↓
unit
  ↓
unit_label
```

The machine-readable CAD Trust schema identifies system-generated fields separately from user-input fields. The adapter must not submit fields marked `system` or `api_generated` as if they were RupayKg-authoritative inputs.

## 7. RupayKg → CAD Trust projection contract

The first implementation should be **projection-only**:

```
RupayKg authoritative state
        ↓
read-only projection
        ↓
CAD Trust validation
        ↓
staging
        ↓
explicit operator/system approval
        ↓
external submission
        ↓
external reference returned
        ↓
RupayKg integration event
```

External identifiers must be stored as references, not used to overwrite RupayKg primary identifiers.

Recommended reference fields:

- `externalSystem = CAD_TRUST`
- `externalSchemaVersion = v2.0.2`
- `externalEntityType`
- `externalEntityId`
- `externalReference`
- `externalLifecycleState`
- `lastSyncedAt`
- `sourceHash`
- `projectionVersion`

## 8. Provenance binding

Every outbound CAD Trust projection should be traceable to the RupayKg evidence/MRV chain:

```
CADT projection
   ↓
RupayKg project/activity
   ↓
measurement / observation
   ↓
evidence
   ↓
calculation
   ↓
verification
   ↓
Guardian execution (when applicable)
   ↓
Hedera consensus anchor (when applicable)
```

The existing W3C PROV interoperability profile remains the provenance representation; CAD Trust is not a replacement for that provenance layer.

## 9. Adapter API shape

The implementation should use the existing external integration boundary:

```ExternalIntegrationEnvelope
    contractVersion: 1.0
    integrationId: CADT_V2
    correlationId
    idempotencyKey
    organizationId
    sourceSystem: RUPAYKG
    targetSystem: CAD_TRUST
    schema: cadtrust:v2.0.2
    payload
```

The adapter result must distinguish:

- accepted
- authoritativeMutation
- externalReference
- retryable
- validation failure
- authentication failure
- authorization failure
- remote rejection
- conflict
- duplicate

## 10. AI mapping rule

The CAD Trust v2.0.2 machine-readable schema can support an AI/ETL mapping agent, but the agent must operate under these constraints:

1. schema is version-pinned;
2. field source is checked;
3. picklists are validated;
4. parent records precede children;
5. system-generated fields are excluded from outbound user input;
6. uncertain mappings are quarantined;
7. no semantic equivalence is inferred merely from similar field names;
8. every accepted mapping has a test fixture;
9. external submission is never performed solely from an unverified AI mapping.

## 11. Initial mapping decisions

### Direct / strong conceptual mappings

- RupayKg verification → CAD Trust verification, subject to external schema semantics.
- RupayKg methodology reference → CAD Trust methodology.
- RupayKg geography/site → CAD Trust location.
- RupayKg project/activity aggregate → CAD Trust project projection, only after project semantics are established.
- RupayKg provenance → retained independently; not collapsed into CAD Trust fields.

### Conditional mappings

- MRV calculation → estimation.
- co-benefit/impact records → co_benefit.
- compliance/eligibility labels → label.
- organisation/project participants → stakeholder.

### External-authority-only mappings

- issuance
- unit
- retirement/transfer lifecycle

These must be sourced from the authorised external registry/programme rather than invented by RupayKg.

## 12. Testing gate

Before enabling outbound CAD Trust writes:

- schema validation tests pass;
- picklist validation tests pass;
- parent/child insert-order tests pass;
- idempotency tests pass;
- tenant isolation tests pass;
- provenance traceability tests pass;
- rejection/retry tests pass;
- external reference persistence tests pass;
- no synthetic/acceptance fixture can become registry-eligible;
- live testnet/sandbox connectivity is proven;
- production external write is explicitly enabled only after approval.

## 13. TRL treatment

This document is an **architecture/integration readiness artifact**.

It does not claim:

- CAD Trust certification;
- CAD Trust registry connectivity;
- successful external issuance;
- production carbon-market eligibility;
- Article 6 authorisation;
- regulatory approval.

Those claims require live external evidence.

## 14. Shakti Standards crosswalk

| Reference | RupayKg use |
|---|---|
| CAD Trust | Carbon-market data interoperability reference |
| DPGA | Open digital-public-good reuse/reference |
| Global DPI | Interoperability and infrastructure pattern reference |
| W3C PROV | Provenance interoperability |
| Hedera Guardian | MRV policy/evidence/integrity execution rail |
| Hedera HCS | Integrity/consensus anchoring |
| CPCB/EPR/SWM | Indian regulatory authority layer |
| BRSR/ESG | Reporting/enterprise layer |
| CCTS/BEE | Carbon-market/compliance adapter layer |

## 15. Schema-conformance checkpoint (2026-11-12)\n\nThe official CAD Trust repository schema `docs/cadtrust-schema-v2.0.2.json` was inspected at source commit `577f4e394c30d4a225485b2e5f25f1c38a0fd550` (schema generated 2026-06-30). The current code validates **only the `project` entity** using its entity-specific user-input fields, exact v2.0.2 project picklists, URL/date formats, and required fields. Parent `program` and `methodology` records are separate entities and their required fields must not be incorrectly imposed on a project payload.\n\nOther entity types fail closed until their own field maps and fixtures are implemented. `issuance` and `unit` remain external-authority-only. Picklists are pinned schema snapshots; a live CADT node's `/v2/governance/meta/pickList` remains authoritative when connectivity is later implemented. This is schema-fixture validation, not live CAD Trust API validation.\n\n## 16. Next implementation slice

The next code slice should be deliberately small:

1. add CAD Trust v2 adapter contract;
2. add versioned field-map definitions;
3. add projection validator;
4. add fixture-based mapping tests;
5. add external reference persistence;
6. add read-only CAD Trust discovery/health adapter;
7. only then implement controlled staging/write support.

No production database migration is required for this design document.

---

## Evidence

- CAD Trust Data Model v2.0 API documentation is publicly available for testing.
- CAD Trust's public site describes its platform as neutral carbon-data infrastructure and its software/data model as a Digital Public Good.
- CAD Trust v2.0.2 machine-readable schema defines entity tables, field sources, picklists and insert order.

Primary references:
- https://climateactiondata.org/
- https://climateactiondata.org/cad-trust-launches-data-model-2-0-public-api-documentation/
- https://github.com/Chia-Network/cadt/blob/develop/docs/cadtrust-schema-v2.0.2.json
