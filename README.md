# RupayKg

**India's Circular Economy Operating System.**

RupayKg is a nationwide platform for urban and rural resource flows, digital MRV, carbon accounting, EPR compliance, ESG reporting, environmental credentials, registry operations and governed settlement.

## Authoritative lifecycle

`Generation → Aggregation → Measurement → Transport → Processing → Evidence → Verification → Value Calculation → Certification/Issuance → Registry → Transfer/Retirement → Settlement → Reporting`

The backend is authoritative. The platform must never present an unverified activity, measurement, compliance result, credential, registry transition or payment as completed.

## Architecture

```text
rupaykg/
├── apps/
│   ├── web/              # Operating-system UI
│   └── api/              # Authoritative API
├── packages/
│   ├── domain/           # State machines and domain invariants
│   ├── database/         # PostgreSQL access and migrations
│   ├── auth/             # Identity and authorization
│   ├── mrv/              # Evidence and verification
│   ├── carbon/           # Methodology-versioned calculations
│   ├── compliance/       # EPR and regulatory obligations
│   ├── credentials/      # Verifiable credentials
│   ├── registry/         # Asset lifecycle and registry integration
│   ├── settlement/       # Financial workflow and reconciliation
│   └── audit/            # Tamper-evident audit trail
├── migrations/
├── tests/
└── docs/
```

## Geography

India → State/UT → District → Block/Taluk → local jurisdiction → urban ward/locality or rural Gram Panchayat/village/cluster. Geography is versioned and permissions are scoped by organization and geography.

## Operating models

Urban and rural workflows share the same authoritative domain model while allowing different collection, aggregation, connectivity and processing realities.

## Design

`DESIGN.md` is the design-system contract for Google Stitch exploration and frontend implementation. UI is a projection of authoritative backend state; it is not a source of truth.

## Documentation

- `docs/PRODUCT.md` — product scope and lifecycle
- `docs/DOMAIN-MODEL.md` — core entities
- `docs/STAKEHOLDERS.md` — participants and permissions
- `docs/INDIA-GEOGRAPHY.md` — national geography model
- `docs/URBAN-RURAL.md` — urban/rural operating model
- `docs/STATE-MACHINES.md` — lifecycle invariants
- `docs/MRV.md` — measurement, evidence and verification
- `docs/CARBON.md` — carbon accounting
- `docs/EPR.md` — EPR compliance
- `docs/ESG.md` — enterprise ESG
- `docs/REGISTRY.md` — credentials and registry
- `docs/SETTLEMENT.md` — governed settlement
- `docs/SECURITY.md` — security and truthfulness controls
- `docs/PRODUCTION_TARGET.md` — production acceptance criteria and offline trust model

## Development status

The repository is being rebuilt from a clean foundation. The previous AI Studio repository is treated only as a requirements/reference source and is not copied as the production implementation.
